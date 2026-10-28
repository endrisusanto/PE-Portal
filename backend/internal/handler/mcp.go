package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"

	"pe-portal/internal/middleware"
	"pe-portal/internal/model"
	"pe-portal/internal/repository"
	"pe-portal/internal/service"
)

type MCPHandler struct {
	repo       *repository.MCPRepository
	httpClient *http.Client
}

func NewMCPHandler(repo *repository.MCPRepository) *MCPHandler {
	return &MCPHandler{
		repo: repo,
		httpClient: &http.Client{
			Timeout: 4 * time.Second,
			Transport: &http.Transport{
				DialContext: (&net.Dialer{
					Timeout: 2 * time.Second,
				}).DialContext,
			},
		},
	}
}

func (h *MCPHandler) List(c echo.Context) error {
	servers, err := h.repo.List(c.Request().Context())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, servers)
}

func (h *MCPHandler) Get(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid MCP server id")
	}

	server, err := h.repo.GetByID(c.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "MCP server not found")
	}
	return c.JSON(http.StatusOK, server)
}

type CreateMCPRequest struct {
	Name        string  `json:"name"`
	URL         string  `json:"url"`
	Description *string `json:"description"`
	AuthType    string  `json:"auth_type"`
	AuthToken   *string `json:"auth_token"`
	IsActive    bool    `json:"is_active"`
}

func (h *MCPHandler) Create(c echo.Context) error {
	var req CreateMCPRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid input")
	}

	if req.Name == "" || req.URL == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "name and url are required")
	}

	var createdBy *uuid.UUID
	if uidVal := c.Get(middleware.ContextKeyUserID); uidVal != nil {
		if uid, ok := uidVal.(uuid.UUID); ok {
			createdBy = &uid
		}
	}

	server := model.MCPServer{
		Name:        req.Name,
		URL:         req.URL,
		Description: req.Description,
		AuthType:    req.AuthType,
		AuthToken:   req.AuthToken,
		IsActive:    req.IsActive,
		CreatedBy:   createdBy,
	}

	created, err := h.repo.Create(c.Request().Context(), &server)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusCreated, created)
}

func (h *MCPHandler) Update(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid MCP server id")
	}

	var req CreateMCPRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid input")
	}

	server := model.MCPServer{
		ID:          id,
		Name:        req.Name,
		URL:         req.URL,
		Description: req.Description,
		AuthType:    req.AuthType,
		AuthToken:   req.AuthToken,
		IsActive:    req.IsActive,
	}

	updated, err := h.repo.Update(c.Request().Context(), &server)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, updated)
}

func (h *MCPHandler) Delete(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid MCP server id")
	}

	if err := h.repo.Delete(c.Request().Context(), id); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "deleted successfully"})
}

// HealthCheck tests connectivity to the target MCP endpoint and collects evidence logs
func (h *MCPHandler) HealthCheck(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid MCP server id")
	}

	server, err := h.repo.GetByID(c.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "MCP server not found")
	}

	ctx, cancel := context.WithTimeout(c.Request().Context(), 6*time.Second)
	defer cancel()

	candidates := service.GetCandidateURLs(server.URL)
	if len(candidates) == 0 {
		candidates = []string{server.URL}
	}

	health := "unhealthy"
	statusCode := 0
	successfulURL := ""
	var responseTimeMs int64
	var toolsCount int
	var toolsSample []string
	var lastErrStr string

	for _, cand := range candidates {
		baseURL := service.GetBaseURL(cand)
		testURLs := []string{
			baseURL + "/api/mcp/tools",
			baseURL + "/health",
			baseURL + "/mcp/tools",
			cand,
			baseURL + "/",
		}

		for _, tURL := range testURLs {
			start := time.Now()
			httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, tURL, nil)
			if err != nil {
				continue
			}

			if server.AuthType == "bearer" && server.AuthToken != nil {
				httpReq.Header.Set("Authorization", "Bearer "+*server.AuthToken)
			} else if server.AuthType == "api_key" && server.AuthToken != nil {
				httpReq.Header.Set("X-API-Key", *server.AuthToken)
			}

			resp, err := h.httpClient.Do(httpReq)
			if err != nil {
				lastErrStr = err.Error()
				continue
			}

			dur := time.Since(start).Milliseconds()
			body, _ := io.ReadAll(resp.Body)
			resp.Body.Close()

			if resp.StatusCode >= 200 && resp.StatusCode < 400 {
				health = "healthy"
				statusCode = resp.StatusCode
				successfulURL = tURL
				responseTimeMs = dur

				// Parse discovered tools from response
				var parsed struct {
					Tools []struct {
						Name string `json:"name"`
					} `json:"tools"`
				}
				if json.Unmarshal(body, &parsed) == nil && len(parsed.Tools) > 0 {
					toolsCount = len(parsed.Tools)
					for i, t := range parsed.Tools {
						if i < 8 {
							toolsSample = append(toolsSample, t.Name)
						}
					}
				}
				break
			} else {
				lastErrStr = fmt.Sprintf("HTTP %d from %s", resp.StatusCode, tURL)
			}
		}
		if health == "healthy" {
			break
		}
	}

	evidenceLog := ""
	if health == "healthy" {
		if toolsCount > 0 {
			evidenceLog = fmt.Sprintf("[SUCCESS %d OK] Terhubung ke %s (%dms). Terverifikasi %d tools aktif: %s",
				statusCode, successfulURL, responseTimeMs, toolsCount, strings.Join(toolsSample, ", "))
		} else {
			evidenceLog = fmt.Sprintf("[SUCCESS %d OK] Terhubung ke endpoint %s (%dms). Layanan responsif dan siap digunakan.",
				statusCode, successfulURL, responseTimeMs)
		}
	} else {
		evidenceLog = fmt.Sprintf("[FAILED] Tidak dapat terhubung ke endpoint %s. Detail error: %s", server.URL, lastErrStr)
	}

	_ = h.repo.UpdateHealth(context.Background(), id, health)

	return c.JSON(http.StatusOK, map[string]interface{}{
		"status":           health,
		"status_code":      statusCode,
		"tested_endpoint":  successfulURL,
		"response_time_ms": responseTimeMs,
		"tools_count":      toolsCount,
		"tools_sample":     toolsSample,
		"log":              evidenceLog,
	})
}

// Proxy relays requests directly to the target MCP server securely
func (h *MCPHandler) Proxy(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid MCP server id")
	}

	server, err := h.repo.GetByID(c.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "MCP server not found")
	}

	bodyBytes, err := io.ReadAll(c.Request().Body)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "failed to read body")
	}

	candidates := service.GetCandidateURLs(server.URL)
	if len(candidates) == 0 {
		candidates = []string{server.URL}
	}

	var lastErr error
	for _, cand := range candidates {
		httpReq, err := http.NewRequestWithContext(c.Request().Context(), c.Request().Method, cand, bytes.NewReader(bodyBytes))
		if err != nil {
			lastErr = err
			continue
		}

		httpReq.Header.Set("Content-Type", c.Request().Header.Get("Content-Type"))
		if server.AuthType == "bearer" && server.AuthToken != nil {
			httpReq.Header.Set("Authorization", "Bearer "+*server.AuthToken)
		} else if server.AuthType == "api_key" && server.AuthToken != nil {
			httpReq.Header.Set("X-API-Key", *server.AuthToken)
		}

		resp, err := h.httpClient.Do(httpReq)
		if err != nil {
			lastErr = err
			continue
		}
		defer resp.Body.Close()

		respBody, err := io.ReadAll(resp.Body)
		if err != nil {
			lastErr = err
			continue
		}

		for k, v := range resp.Header {
			c.Response().Header()[k] = v
		}

		return c.Blob(resp.StatusCode, resp.Header.Get("Content-Type"), respBody)
	}

	return echo.NewHTTPError(http.StatusBadGateway, "failed to reach remote MCP server: "+lastErr.Error())
}
