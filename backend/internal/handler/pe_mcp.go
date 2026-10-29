package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v4"

	"pe-portal/internal/service"
)

type PEMCPHandler struct {
	mcpService *service.PEMCPService
}

func NewPEMCPHandler(mcpService *service.PEMCPService) *PEMCPHandler {
	return &PEMCPHandler{mcpService: mcpService}
}

type jsonRPCRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      interface{}     `json:"id"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

type jsonRPCResponse struct {
	JSONRPC string      `json:"jsonrpc"`
	ID      interface{} `json:"id"`
	Result  interface{} `json:"result,omitempty"`
	Error   *rpcError   `json:"error,omitempty"`
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// HandleRoutes handles all incoming MCP requests (JSON-RPC 2.0 & REST)
func (h *PEMCPHandler) Handle(c echo.Context) error {
	method := c.Request().Method

	if method == http.MethodGet {
		return h.handleGet(c)
	}

	if method == http.MethodPost {
		return h.handlePost(c)
	}

	return c.NoContent(http.StatusMethodNotAllowed)
}

func (h *PEMCPHandler) handleGet(c echo.Context) error {
	path := c.Request().URL.Path

	// SSE support: check path or Accept header
	isSSE := path == "/api/v1/mcp/sse" || path == "/mcp/sse" || strings.Contains(c.Request().Header.Get("Accept"), "text/event-stream")
	if isSSE {
		c.Response().Header().Set(echo.HeaderContentType, "text/event-stream")
		c.Response().Header().Set(echo.HeaderCacheControl, "no-cache")
		c.Response().Header().Set(echo.HeaderConnection, "keep-alive")

		// Emit endpoint event for POST messages
		endpoint := "/api/v1/mcp"
		if strings.HasPrefix(path, "/mcp") && !strings.HasPrefix(path, "/api/v1/mcp") {
			endpoint = "/mcp"
		}
		fmt.Fprintf(c.Response(), "event: endpoint\ndata: %s\n\n", endpoint)
		c.Response().Flush()

		// Keep SSE connection open until client disconnects
		notify := c.Request().Context().Done()
		ticker := time.NewTicker(15 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-notify:
				return nil
			case <-ticker.C:
				fmt.Fprintf(c.Response(), ": keepalive\n\n")
				c.Response().Flush()
			}
		}
	}

	tools := h.mcpService.GetTools()
	return c.JSON(http.StatusOK, map[string]interface{}{
		"status":      "healthy",
		"name":        "SEIN PE Portal MCP Server",
		"version":     "1.0.0",
		"protocol":    "MCP-2024-11-05",
		"tools_count": len(tools),
		"tools":       tools,
	})
}

func (h *PEMCPHandler) handlePost(c echo.Context) error {
	body, err := io.ReadAll(c.Request().Body)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "failed to read request body")
	}

	trimmed := bytes.TrimSpace(body)

	// Ponytail resilience: Clean Windows CMD / PowerShell single-quote wrapping e.g. '{"jsonrpc":...}'
	if len(trimmed) >= 2 && trimmed[0] == '\'' && trimmed[len(trimmed)-1] == '\'' {
		trimmed = bytes.TrimSpace(trimmed[1 : len(trimmed)-1])
	}

	// 1. Check if JSON-RPC (single request)
	var rpcReq jsonRPCRequest
	if err := json.Unmarshal(trimmed, &rpcReq); err == nil && (rpcReq.JSONRPC == "2.0" || rpcReq.Method != "") {
		return h.handleJSONRPC(c, &rpcReq)
	}

	// 2. Direct REST format: {"name": "...", "arguments": {...}}
	var directCall struct {
		Name      string                 `json:"name"`
		Arguments map[string]interface{} `json:"arguments"`
	}
	if err := json.Unmarshal(trimmed, &directCall); err == nil && directCall.Name != "" {
		result, err := h.mcpService.CallTool(c.Request().Context(), directCall.Name, directCall.Arguments)
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]interface{}{
				"success": false,
				"error":   err.Error(),
			})
		}
		return c.JSON(http.StatusOK, map[string]interface{}{
			"success": true,
			"result":  result,
		})
	}

	return echo.NewHTTPError(http.StatusBadRequest, "unsupported request format, expected JSON-RPC 2.0 or REST tool payload")
}

func (h *PEMCPHandler) handleJSONRPC(c echo.Context, req *jsonRPCRequest) error {
	ctx := c.Request().Context()

	switch req.Method {
	case "initialize":
		return c.JSON(http.StatusOK, jsonRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Result: map[string]interface{}{
				"protocolVersion": "2024-11-05",
				"serverInfo": map[string]interface{}{
					"name":    "sein-pe-portal-mcp",
					"version": "1.0.0",
				},
				"capabilities": map[string]interface{}{
					"tools": map[string]interface{}{},
				},
			},
		})

	case "tools/list":
		return c.JSON(http.StatusOK, jsonRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Result: map[string]interface{}{
				"tools": h.mcpService.GetTools(),
			},
		})

	case "tools/call":
		var callParams struct {
			Name      string                 `json:"name"`
			Arguments map[string]interface{} `json:"arguments"`
		}
		if len(req.Params) > 0 {
			_ = json.Unmarshal(req.Params, &callParams)
		}

		if callParams.Name == "" {
			return c.JSON(http.StatusOK, jsonRPCResponse{
				JSONRPC: "2.0",
				ID:      req.ID,
				Error: &rpcError{
					Code:    -32602,
					Message: "tool name is required in params",
				},
			})
		}

		result, err := h.mcpService.CallTool(ctx, callParams.Name, callParams.Arguments)
		if err != nil {
			return c.JSON(http.StatusOK, jsonRPCResponse{
				JSONRPC: "2.0",
				ID:      req.ID,
				Error: &rpcError{
					Code:    -32000,
					Message: err.Error(),
				},
			})
		}

		// MCP spec requires result.content as array of items
		resJSON, _ := json.MarshalIndent(result, "", "  ")
		return c.JSON(http.StatusOK, jsonRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Result: map[string]interface{}{
				"content": []map[string]interface{}{
					{
						"type": "text",
						"text": string(resJSON),
					},
				},
			},
		})

	case "notifications/initialized", "initialized", "notifications/cancelled":
		return c.NoContent(http.StatusOK)

	case "resources/list", "resources/templates/list":
		return c.JSON(http.StatusOK, jsonRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Result: map[string]interface{}{
				"resources": []interface{}{},
			},
		})

	case "prompts/list":
		return c.JSON(http.StatusOK, jsonRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Result: map[string]interface{}{
				"prompts": []interface{}{},
			},
		})

	case "ping":
		return c.JSON(http.StatusOK, jsonRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Result:  map[string]interface{}{},
		})

	default:
		// If request is a notification (no ID), do not send an error response
		if req.ID == nil {
			return c.NoContent(http.StatusOK)
		}
		return c.JSON(http.StatusOK, jsonRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Error: &rpcError{
				Code:    -32601,
				Message: fmt.Sprintf("method '%s' not found", req.Method),
			},
		})
	}
}
