package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"pe-portal/internal/model"
)

// MCPClientService connects the AI Assistant with registered MCP server connectors
type MCPClientService struct {
	httpClient *http.Client
}

func NewMCPClientService() *MCPClientService {
	return &MCPClientService{
		httpClient: &http.Client{
			Timeout: 3 * time.Second, // fast timeout so chat inference is never held up
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

// FetchTools queries tools/list on an active MCP server
func (s *MCPClientService) FetchTools(ctx context.Context, server *model.MCPServer) ([]MCPToolDef, error) {
	if server == nil || !server.IsActive || server.URL == "" {
		return nil, nil
	}

	payload := mcpJSONRPCReq{
		JSONRPC: "2.0",
		ID:      1,
		Method:  "tools/list",
		Params:  map[string]interface{}{},
	}

	reqBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, server.URL, bytes.NewReader(reqBytes))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	if server.AuthType == "bearer" && server.AuthToken != nil {
		req.Header.Set("Authorization", "Bearer "+*server.AuthToken)
	} else if server.AuthType == "api_key" && server.AuthToken != nil {
		req.Header.Set("X-API-Key", *server.AuthToken)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var rpcResp mcpToolsListResp
	if err := json.Unmarshal(body, &rpcResp); err != nil {
		return nil, err
	}

	if rpcResp.Error != nil && rpcResp.Error.Message != "" {
		return nil, fmt.Errorf("mcp error: %s", rpcResp.Error.Message)
	}

	return rpcResp.Result.Tools, nil
}

// CallTool executes a tool on the remote MCP server
func (s *MCPClientService) CallTool(ctx context.Context, server *model.MCPServer, toolName string, args map[string]interface{}) (string, error) {
	if server == nil || !server.IsActive || server.URL == "" {
		return "", fmt.Errorf("server inactive")
	}

	payload := mcpJSONRPCReq{
		JSONRPC: "2.0",
		ID:      2,
		Method:  "tools/call",
		Params: map[string]interface{}{
			"name":      toolName,
			"arguments": args,
		},
	}

	reqBytes, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, server.URL, bytes.NewReader(reqBytes))
	if err != nil {
		return "", err
	}

	req.Header.Set("Content-Type", "application/json")
	if server.AuthType == "bearer" && server.AuthToken != nil {
		req.Header.Set("Authorization", "Bearer "+*server.AuthToken)
	} else if server.AuthType == "api_key" && server.AuthToken != nil {
		req.Header.Set("X-API-Key", *server.AuthToken)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	return string(body), nil
}
