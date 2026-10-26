package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"pe-portal/internal/model"
)

// NormalizeMCPURL adjusts hostnames for Docker container environments (ponytail: robust networking)
func NormalizeMCPURL(rawURL string) string {
	rawURL = strings.TrimSpace(rawURL)
	if rawURL == "" {
		return ""
	}

	u, err := url.Parse(rawURL)
	if err != nil {
		return rawURL
	}

	host := u.Hostname()
	port := u.Port()

	// Inside Docker container, localhost/127.0.0.1 or unreachable local IPs route to host gateway
	if host == "localhost" || host == "127.0.0.1" || host == "107.102.39.55" {
		targetHost := "172.17.0.1" // Default Docker bridge gateway to host machine
		if port != "" {
			u.Host = net.JoinHostPort(targetHost, port)
		} else {
			u.Host = targetHost
		}
	}

	return u.String()
}

// GetBaseURL extracts the protocol and host from a target endpoint
func GetBaseURL(rawURL string) string {
	u, err := url.Parse(rawURL)
	if err != nil {
		return rawURL
	}
	return fmt.Sprintf("%s://%s", u.Scheme, u.Host)
}

// MCPClientService connects the AI Assistant with registered MCP server connectors
type MCPClientService struct {
	httpClient *http.Client
}

func NewMCPClientService() *MCPClientService {
	return &MCPClientService{
		httpClient: &http.Client{
			Timeout: 4 * time.Second, // fast timeout so chat inference is never held up
		},
	}
}

type mcpJSONRPCReq struct {
	JSONRPC string      `json:"jsonrpc"`
	ID      interface{} `json:"id"`
	Method  string      `json:"method"`
	Params  interface{} `json:"params,omitempty"`
}

type MCPToolDef struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	InputSchema map[string]interface{} `json:"inputSchema,omitempty"`
}

type mcpToolsListResp struct {
	Result struct {
		Tools []MCPToolDef `json:"tools"`
	} `json:"result"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// FetchTools queries tools from active MCP server, supporting both REST endpoints and JSON-RPC
func (s *MCPClientService) FetchTools(ctx context.Context, server *model.MCPServer) ([]MCPToolDef, error) {
	if server == nil || !server.IsActive || server.URL == "" {
		return nil, nil
	}

	normalizedURL := NormalizeMCPURL(server.URL)
	baseURL := GetBaseURL(normalizedURL)

	// Endpoints to check (supports project-manager-mcp, standard MCP SSE, and JSON-RPC)
	endpoints := []struct {
		method string
		url    string
		isRPC  bool
	}{
		{method: http.MethodGet, url: baseURL + "/api/mcp/tools", isRPC: false},
		{method: http.MethodGet, url: baseURL + "/mcp/tools", isRPC: false},
		{method: http.MethodGet, url: normalizedURL + "/tools", isRPC: false},
		{method: http.MethodPost, url: normalizedURL, isRPC: true},
	}

	for _, ep := range endpoints {
		var req *http.Request
		var err error

		if ep.isRPC {
			payload := mcpJSONRPCReq{
				JSONRPC: "2.0",
				ID:      1,
				Method:  "tools/list",
				Params:  map[string]interface{}{},
			}
			reqBytes, _ := json.Marshal(payload)
			req, err = http.NewRequestWithContext(ctx, ep.method, ep.url, bytes.NewReader(reqBytes))
		} else {
			req, err = http.NewRequestWithContext(ctx, ep.method, ep.url, nil)
		}

		if err != nil {
			continue
		}

		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Accept", "application/json")
		if server.AuthType == "bearer" && server.AuthToken != nil {
			req.Header.Set("Authorization", "Bearer "+*server.AuthToken)
		} else if server.AuthType == "api_key" && server.AuthToken != nil {
			req.Header.Set("X-API-Key", *server.AuthToken)
		}

		resp, err := s.httpClient.Do(req)
		if err != nil {
			continue
		}

		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil || resp.StatusCode < 200 || resp.StatusCode >= 400 {
			continue
		}

		// 1. Direct REST format: {"success": true, "tools": [...]} or {"tools": [...]}
		var directResp struct {
			Success bool         `json:"success"`
			Tools   []MCPToolDef `json:"tools"`
		}
		if err := json.Unmarshal(body, &directResp); err == nil && len(directResp.Tools) > 0 {
			return directResp.Tools, nil
		}

		// 2. Direct array: [{ "name": "...", "description": "..." }]
		var arrayResp []MCPToolDef
		if err := json.Unmarshal(body, &arrayResp); err == nil && len(arrayResp) > 0 {
			return arrayResp, nil
		}

		// 3. JSON-RPC format: {"result": {"tools": [...]}}
		var rpcResp mcpToolsListResp
		if err := json.Unmarshal(body, &rpcResp); err == nil && len(rpcResp.Result.Tools) > 0 {
			return rpcResp.Result.Tools, nil
		}
	}

	return nil, fmt.Errorf("no tools discovered from MCP server %s", server.Name)
}

// CallTool executes a tool on the remote MCP server (REST call or JSON-RPC)
func (s *MCPClientService) CallTool(ctx context.Context, server *model.MCPServer, toolName string, args map[string]interface{}) (string, error) {
	if server == nil || !server.IsActive || server.URL == "" {
		return "", fmt.Errorf("server inactive")
	}

	normalizedURL := NormalizeMCPURL(server.URL)
	baseURL := GetBaseURL(normalizedURL)

	// Mode 1: HTTP Call Endpoint (project_manager HTTP bridge)
	callPayload := map[string]interface{}{
		"name":      toolName,
		"arguments": args,
	}
	reqBytes, _ := json.Marshal(callPayload)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+"/api/mcp/call", bytes.NewReader(reqBytes))
	if err == nil {
		req.Header.Set("Content-Type", "application/json")
		if server.AuthType == "bearer" && server.AuthToken != nil {
			req.Header.Set("Authorization", "Bearer "+*server.AuthToken)
		} else if server.AuthType == "api_key" && server.AuthToken != nil {
			req.Header.Set("X-API-Key", *server.AuthToken)
		}

		resp, err := s.httpClient.Do(req)
		if err == nil {
			body, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				return string(body), nil
			}
		}
	}

	// Mode 2: Standard JSON-RPC tools/call
	rpcPayload := mcpJSONRPCReq{
		JSONRPC: "2.0",
		ID:      2,
		Method:  "tools/call",
		Params: map[string]interface{}{
			"name":      toolName,
			"arguments": args,
		},
	}
	rpcBytes, _ := json.Marshal(rpcPayload)
	reqRPC, err := http.NewRequestWithContext(ctx, http.MethodPost, normalizedURL, bytes.NewReader(rpcBytes))
	if err != nil {
		return "", err
	}
	reqRPC.Header.Set("Content-Type", "application/json")
	if server.AuthType == "bearer" && server.AuthToken != nil {
		reqRPC.Header.Set("Authorization", "Bearer "+*server.AuthToken)
	} else if server.AuthType == "api_key" && server.AuthToken != nil {
		reqRPC.Header.Set("X-API-Key", *server.AuthToken)
	}

	respRPC, err := s.httpClient.Do(reqRPC)
	if err != nil {
		return "", err
	}
	defer respRPC.Body.Close()

	body, err := io.ReadAll(respRPC.Body)
	if err != nil {
		return "", err
	}
	return string(body), nil
}

// CallMCPChat forwards the chat request to the MCP server's /api/mcp/chat endpoint (like project_manager)
func (s *MCPClientService) CallMCPChat(ctx context.Context, server *model.MCPServer, prompt string, messages []model.ChatMessage, userName, userRole string) (string, error) {
	if server == nil || !server.IsActive || server.URL == "" {
		return "", fmt.Errorf("server inactive")
	}

	normalizedURL := NormalizeMCPURL(server.URL)
	baseURL := GetBaseURL(normalizedURL)
	chatEndpoint := baseURL + "/api/mcp/chat"

	type msgItem struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	}
	formattedMsgs := make([]msgItem, 0, len(messages))
	for _, m := range messages {
		formattedMsgs = append(formattedMsgs, msgItem{
			Role:    m.Role,
			Content: fmt.Sprint(m.Content),
		})
	}

	payload := map[string]interface{}{
		"chatInput": prompt,
		"prompt":    prompt,
		"message":   prompt,
		"messages":  formattedMsgs,
		"user":      userName,
		"role":      userRole,
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	// 60-second timeout for AI inference & database reasoning
	chatClient := &http.Client{Timeout: 60 * time.Second}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, chatEndpoint, bytes.NewReader(bodyBytes))
	if err != nil {
		return "", err
	}

	req.Header.Set("Content-Type", "application/json")
	if server.AuthType == "bearer" && server.AuthToken != nil {
		req.Header.Set("Authorization", "Bearer "+*server.AuthToken)
	} else if server.AuthType == "api_key" && server.AuthToken != nil {
		req.Header.Set("X-API-Key", *server.AuthToken)
	}

	resp, err := chatClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("mcp chat returned status %d", resp.StatusCode)
	}

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var chatResp struct {
		Output string `json:"output"`
		Reply  string `json:"reply"`
	}
	if err := json.Unmarshal(respBody, &chatResp); err == nil {
		if chatResp.Output != "" {
			return chatResp.Output, nil
		}
		if chatResp.Reply != "" {
			return chatResp.Reply, nil
		}
	}

	return string(respBody), nil
}
