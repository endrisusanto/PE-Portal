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
	"os"
	"strings"
	"time"

	"pe-portal/internal/model"
)

// IsRunningInDocker detects if the current process is inside a container
func IsRunningInDocker() bool {
	if _, err := os.Stat("/.dockerenv"); err == nil {
		return true
	}
	if os.Getenv("RUNNING_IN_DOCKER") == "true" || os.Getenv("DOCKER_CONTAINER") == "true" {
		return true
	}
	if data, err := os.ReadFile("/proc/1/cgroup"); err == nil {
		if strings.Contains(string(data), "docker") || strings.Contains(string(data), "containerd") {
			return true
		}
	}
	return false
}

// GetCandidateURLs generates prioritized reachable URLs for both Docker & Baremetal (Windows/Linux)
func GetCandidateURLs(rawURL string) []string {
	rawURL = strings.TrimSpace(rawURL)
	if rawURL == "" {
		return nil
	}

	u, err := url.Parse(rawURL)
	if err != nil {
		return []string{rawURL}
	}

	host := u.Hostname()
	port := u.Port()
	path := u.Path

	var candidates []string

	// Check if this targets PE Portal's own backend container (port 8080 or path /api/v1/mcp)
	isInternalPEMCP := port == "8080" || strings.HasPrefix(path, "/api/v1/mcp")

	if IsRunningInDocker() {
		if isInternalPEMCP {
			// Inside container: PE Portal backend is localhost:8080
			uInternal := *u
			uInternal.Host = "127.0.0.1:8080"
			return []string{uInternal.String()}
		}

		// External MCP servers (e.g. GBA on port 3800) running on host or baremetal:
		if host == "localhost" || host == "127.0.0.1" || host == "0.0.0.0" {
			// 1. host.docker.internal (extra_hosts in docker-compose)
			u1 := *u
			u1.Host = net.JoinHostPort("host.docker.internal", port)
			candidates = append(candidates, u1.String())

			// 2. Docker default bridge gateway (172.17.0.1)
			gw := "172.17.0.1"
			if envGw := os.Getenv("DOCKER_HOST_GATEWAY"); envGw != "" {
				gw = envGw
			}
			u2 := *u
			u2.Host = net.JoinHostPort(gw, port)
			candidates = append(candidates, u2.String())

			// 3. Fallback to Windows host LAN IP
			u3 := *u
			u3.Host = net.JoinHostPort("107.102.39.55", port)
			candidates = append(candidates, u3.String())
		} else if host == "172.17.0.1" || host == "host.docker.internal" {
			candidates = append(candidates, rawURL)
			uAlt := *u
			if host == "172.17.0.1" {
				uAlt.Host = net.JoinHostPort("host.docker.internal", port)
			} else {
				uAlt.Host = net.JoinHostPort("172.17.0.1", port)
			}
			candidates = append(candidates, uAlt.String())
		} else {
			candidates = append(candidates, rawURL)
			if port == "3800" {
				uHost := *u
				uHost.Host = net.JoinHostPort("host.docker.internal", port)
				candidates = append(candidates, uHost.String())
			}
		}
	} else {
		// Baremetal (Windows / Linux host without container):
		// If DB has container-specific hostnames (172.17.0.1 or host.docker.internal), map to 127.0.0.1
		if host == "172.17.0.1" || host == "host.docker.internal" {
			uLocal := *u
			uLocal.Host = net.JoinHostPort("127.0.0.1", port)
			candidates = append(candidates, uLocal.String())
		} else {
			candidates = append(candidates, rawURL)
		}

		// Also provide 127.0.0.1 fallback if given LAN IP or vice versa
		if port == "3800" {
			if host != "127.0.0.1" && host != "localhost" {
				uLocal := *u
				uLocal.Host = net.JoinHostPort("127.0.0.1", port)
				candidates = append(candidates, uLocal.String())
			} else {
				uWin := *u
				uWin.Host = net.JoinHostPort("107.102.39.55", port)
				candidates = append(candidates, uWin.String())
			}
		}
	}

	return candidates
}

// NormalizeMCPURL adjusts hostnames for Docker container vs baremetal environments (ponytail: robust networking)
func NormalizeMCPURL(rawURL string) string {
	candidates := GetCandidateURLs(rawURL)
	if len(candidates) > 0 {
		return candidates[0]
	}
	return rawURL
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
	peMCPSvc   *PEMCPService
}

func NewMCPClientService(peMCPSvc *PEMCPService) *MCPClientService {
	return &MCPClientService{
		httpClient: &http.Client{
			Timeout: 4 * time.Second, // fast timeout so chat inference is never held up
			Transport: &http.Transport{
				DialContext: (&net.Dialer{
					Timeout: 2 * time.Second,
				}).DialContext,
			},
		},
		peMCPSvc: peMCPSvc,
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
		Message string `json:"error,omitempty"`
	} `json:"error,omitempty"`
}

// FetchTools queries tools from active MCP server, supporting both REST endpoints and JSON-RPC
func (s *MCPClientService) FetchTools(ctx context.Context, server *model.MCPServer) ([]MCPToolDef, error) {
	if server == nil || !server.IsActive || server.URL == "" {
		return nil, nil
	}

	// In-memory zero-latency lookup for PE Portal's own MCP service
	if s.peMCPSvc != nil && (server.Name == "SEIN PE Portal MCP" || strings.Contains(server.URL, "/api/v1/mcp")) {
		return s.peMCPSvc.GetTools(), nil
	}

	candidates := GetCandidateURLs(server.URL)
	if len(candidates) == 0 {
		candidates = []string{server.URL}
	}

	var lastErr error
	for _, cand := range candidates {
		baseURL := GetBaseURL(cand)

		// Endpoints to check (supports project-manager-mcp, standard MCP SSE, and JSON-RPC)
		endpoints := []struct {
			method string
			url    string
			isRPC  bool
		}{
			{method: http.MethodGet, url: baseURL + "/api/mcp/tools", isRPC: false},
			{method: http.MethodGet, url: baseURL + "/mcp/tools", isRPC: false},
			{method: http.MethodGet, url: cand + "/tools", isRPC: false},
			{method: http.MethodPost, url: cand, isRPC: true},
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
				lastErr = err
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
				lastErr = err
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
	}

	if lastErr != nil {
		return nil, fmt.Errorf("no tools discovered from MCP server %s: %v", server.Name, lastErr)
	}
	return nil, fmt.Errorf("no tools discovered from MCP server %s", server.Name)
}

// CallTool executes a tool on the remote MCP server (REST call or JSON-RPC)
func (s *MCPClientService) CallTool(ctx context.Context, server *model.MCPServer, toolName string, args map[string]interface{}) (string, error) {
	if server == nil || !server.IsActive || server.URL == "" {
		return "", fmt.Errorf("server inactive")
	}

	// In-memory execution for PE Portal's own MCP service
	if s.peMCPSvc != nil && (server.Name == "SEIN PE Portal MCP" || strings.Contains(server.URL, "/api/v1/mcp")) {
		res, err := s.peMCPSvc.CallTool(ctx, toolName, args)
		if err != nil {
			return "", err
		}
		resBytes, _ := json.MarshalIndent(res, "", "  ")
		return string(resBytes), nil
	}

	candidates := GetCandidateURLs(server.URL)
	if len(candidates) == 0 {
		candidates = []string{server.URL}
	}

	var lastErr error
	for _, cand := range candidates {
		baseURL := GetBaseURL(cand)

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
		reqRPC, err := http.NewRequestWithContext(ctx, http.MethodPost, cand, bytes.NewReader(rpcBytes))
		if err != nil {
			lastErr = err
			continue
		}
		reqRPC.Header.Set("Content-Type", "application/json")
		if server.AuthType == "bearer" && server.AuthToken != nil {
			reqRPC.Header.Set("Authorization", "Bearer "+*server.AuthToken)
		} else if server.AuthType == "api_key" && server.AuthToken != nil {
			reqRPC.Header.Set("X-API-Key", *server.AuthToken)
		}

		respRPC, err := s.httpClient.Do(reqRPC)
		if err != nil {
			lastErr = err
			continue
		}

		body, err := io.ReadAll(respRPC.Body)
		respRPC.Body.Close()
		if err != nil {
			lastErr = err
			continue
		}
		if respRPC.StatusCode == http.StatusOK {
			return string(body), nil
		}
	}

	if lastErr != nil {
		return "", lastErr
	}
	return "", fmt.Errorf("failed to call tool %s on %s", toolName, server.Name)
}

// CallMCPChat forwards the chat request to the MCP server's /api/mcp/chat endpoint (like project_manager)
func (s *MCPClientService) CallMCPChat(ctx context.Context, server *model.MCPServer, prompt string, messages []model.ChatMessage, userName, userRole string, llmCfg *model.LLMConfig) (string, error) {
	if server == nil || !server.IsActive || server.URL == "" {
		return "", fmt.Errorf("server inactive")
	}

	candidates := GetCandidateURLs(server.URL)
	if len(candidates) == 0 {
		candidates = []string{server.URL}
	}

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
	if llmCfg != nil {
		if llmCfg.BaseURL != "" {
			payload["baseUrl"] = llmCfg.BaseURL
			payload["endpoint"] = llmCfg.BaseURL
		}
		if llmCfg.APIKey != "" {
			payload["apiKey"] = llmCfg.APIKey
		}
		if llmCfg.ModelName != "" && llmCfg.ModelName != "auto" {
			payload["model"] = llmCfg.ModelName
		}
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	// 120-second timeout for full LLM inference, table calculation, and database reasoning
	chatClient := &http.Client{
		Timeout: 120 * time.Second,
		Transport: &http.Transport{
			DialContext: (&net.Dialer{
				Timeout: 3 * time.Second, // Fail fast if endpoint host is unreachable
			}).DialContext,
		},
	}

	var lastErr error
	for _, cand := range candidates {
		baseURL := GetBaseURL(cand)
		chatEndpoint := baseURL + "/api/mcp/chat"

		req, err := http.NewRequestWithContext(ctx, http.MethodPost, chatEndpoint, bytes.NewReader(bodyBytes))
		if err != nil {
			lastErr = err
			continue
		}

		req.Header.Set("Content-Type", "application/json")
		if server.AuthType == "bearer" && server.AuthToken != nil {
			req.Header.Set("Authorization", "Bearer "+*server.AuthToken)
		} else if server.AuthType == "api_key" && server.AuthToken != nil {
			req.Header.Set("X-API-Key", *server.AuthToken)
		}

		resp, err := chatClient.Do(req)
		if err != nil {
			lastErr = err
			continue
		}

		if resp.StatusCode != http.StatusOK {
			resp.Body.Close()
			lastErr = fmt.Errorf("mcp chat returned status %d from %s", resp.StatusCode, chatEndpoint)
			continue
		}

		respBody, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			lastErr = err
			continue
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

	if lastErr != nil {
		return "", lastErr
	}
	return "", fmt.Errorf("failed to reach mcp chat across candidates for %s", server.Name)
}
