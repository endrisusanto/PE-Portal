package handler

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"

	"pe-portal/internal/middleware"
	"pe-portal/internal/model"
	"pe-portal/internal/repository"
	"pe-portal/internal/service"
)

type AIHandler struct {
	repo    *repository.LLMRepository
	mcpRepo *repository.MCPRepository
	mcpSvc  *service.MCPClientService
	llmSvc  *service.LLMService
}

func NewAIHandler(repo *repository.LLMRepository, mcpRepo *repository.MCPRepository, mcpSvc *service.MCPClientService, llmSvc *service.LLMService) *AIHandler {
	return &AIHandler{
		repo:    repo,
		mcpRepo: mcpRepo,
		mcpSvc:  mcpSvc,
		llmSvc:  llmSvc,
	}
}

// GetConfig returns the active LLM configuration for this user
func (h *AIHandler) GetConfig(c echo.Context) error {
	var uidPtr *uuid.UUID
	if val := c.Get(middleware.ContextKeyUserID); val != nil {
		if uid, ok := val.(uuid.UUID); ok {
			uidPtr = &uid
		}
	}

	cfg, isUserCustom, err := h.repo.GetActiveLLM(c.Request().Context(), uidPtr)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "No active LLM configuration: "+err.Error())
	}

	// Safe masked copy
	masked := *cfg
	if len(masked.APIKey) > 6 {
		masked.APIKey = masked.APIKey[:3] + "••••" + masked.APIKey[len(masked.APIKey)-2:]
	} else if masked.APIKey != "" {
		masked.APIKey = "••••••••"
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"config":          masked,
		"is_user_custom":  isUserCustom,
		"has_custom_keys": isUserCustom,
	})
}

type SaveLLMReq struct {
	Name      string `json:"name"`
	Provider  string `json:"provider"`
	BaseURL   string `json:"base_url"`
	APIKey    string `json:"api_key"`
	ModelName string `json:"model_name"`
	IsActive  bool   `json:"is_active"`
	IsCustom  bool   `json:"is_custom"` // true = save as personal API override
}

// UpdateConfig handles saving portal default or user custom API keys
func (h *AIHandler) UpdateConfig(c echo.Context) error {
	var req SaveLLMReq
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request")
	}

	if req.BaseURL == "" {
		req.BaseURL = "https://lmstudio.endrisusanto.my.id/v1"
	}
	if req.Provider == "" {
		req.Provider = "openai-compatible"
	}

	var uidPtr *uuid.UUID
	if val := c.Get(middleware.ContextKeyUserID); val != nil {
		if uid, ok := val.(uuid.UUID); ok {
			uidPtr = &uid
		}
	}

	// If API key is masked, preserve existing
	if strings.Contains(req.APIKey, "••") || req.APIKey == "" {
		existing, _, _ := h.repo.GetActiveLLM(c.Request().Context(), uidPtr)
		if existing != nil {
			req.APIKey = existing.APIKey
		}
	}

	cfg := model.LLMConfig{
		Name:      req.Name,
		Provider:  req.Provider,
		BaseURL:   req.BaseURL,
		APIKey:    req.APIKey,
		ModelName: req.ModelName,
		IsActive:  req.IsActive,
	}

	if req.IsCustom && uidPtr != nil {
		// Personal custom key override for this user
		saved, err := h.repo.SaveUserLLM(c.Request().Context(), *uidPtr, &cfg)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
		}
		return c.JSON(http.StatusOK, map[string]interface{}{
			"message": "Personal LLM API configuration saved successfully",
			"config":  saved,
		})
	}

	// Portal default configuration (admin role checked in route or handler)
	saved, err := h.repo.SavePortalLLM(c.Request().Context(), &cfg)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"message": "Portal default LLM API configuration saved successfully",
		"config":  saved,
	})
}

// DeleteUserCustom removes personal custom key and reverts to portal default
func (h *AIHandler) DeleteUserCustom(c echo.Context) error {
	var uid uuid.UUID
	if val := c.Get(middleware.ContextKeyUserID); val != nil {
		if u, ok := val.(uuid.UUID); ok {
			uid = u
		}
	}
	if uid == uuid.Nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "user not authenticated")
	}

	if err := h.repo.DeleteUserLLM(c.Request().Context(), uid); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Personal custom LLM API removed. Reverted to portal default.",
	})
}

// ListModels fetches available model names from the active endpoint
func (h *AIHandler) ListModels(c echo.Context) error {
	var uidPtr *uuid.UUID
	if val := c.Get(middleware.ContextKeyUserID); val != nil {
		if uid, ok := val.(uuid.UUID); ok {
			uidPtr = &uid
		}
	}

	cfg, _, err := h.repo.GetActiveLLM(c.Request().Context(), uidPtr)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "active LLM config not found")
	}

	models, err := h.llmSvc.FetchModels(c.Request().Context(), cfg)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadGateway, "failed to query models from endpoint: "+err.Error())
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"endpoint": cfg.BaseURL,
		"models":   models,
	})
}

// GetMCPConnectors returns active MCP servers connected to the AI Assistant
func (h *AIHandler) GetMCPConnectors(c echo.Context) error {
	if h.mcpRepo == nil {
		return c.JSON(http.StatusOK, []interface{}{})
	}

	ctx := c.Request().Context()
	servers, err := h.mcpRepo.List(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to query MCP servers: "+err.Error())
	}

	type mcpSummary struct {
		ID           uuid.UUID `json:"id"`
		Name         string    `json:"name"`
		URL          string    `json:"url"`
		Description  string    `json:"description"`
		IsActive     bool      `json:"is_active"`
		HealthStatus string    `json:"health_status"`
		ToolsCount   int       `json:"tools_count"`
		Tools        []string  `json:"tools"`
	}

	result := []mcpSummary{}
	for _, s := range servers {
		if !s.IsActive {
			continue
		}
		desc := ""
		if s.Description != nil {
			desc = *s.Description
		}

		toolNames := []string{}
		if h.mcpSvc != nil {
			tools, _ := h.mcpSvc.FetchTools(ctx, &s)
			for _, t := range tools {
				toolNames = append(toolNames, t.Name)
			}
		}

		status := s.HealthStatus
		if len(toolNames) > 0 {
			status = "connected"
		}

		result = append(result, mcpSummary{
			ID:           s.ID,
			Name:         s.Name,
			URL:          s.URL,
			Description:  desc,
			IsActive:     s.IsActive,
			HealthStatus: status,
			ToolsCount:   len(toolNames),
			Tools:        toolNames,
		})
	}

	return c.JSON(http.StatusOK, result)
}

// Chat processes user questions with SEIN PE context and connected MCP tools
func (h *AIHandler) Chat(c echo.Context) error {
	var req model.AIChatRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid chat payload")
	}

	if len(req.Messages) == 0 {
		return echo.NewHTTPError(http.StatusBadRequest, "at least one message is required")
	}

	var uidPtr *uuid.UUID
	if val := c.Get(middleware.ContextKeyUserID); val != nil {
		if uid, ok := val.(uuid.UUID); ok {
			uidPtr = &uid
		}
	}

	cfg, isCustom, err := h.repo.GetActiveLLM(c.Request().Context(), uidPtr)
	if err != nil {
		return echo.NewHTTPError(http.StatusServiceUnavailable, "LLM provider is not configured: "+err.Error())
	}

	// ponytail: Inject registered active MCP servers from Settings into LLM context
	var mcpContextBuilder strings.Builder
	var activeMCPNames []string

	if h.mcpRepo != nil {
		servers, err := h.mcpRepo.List(c.Request().Context())
		if err == nil {
			for _, s := range servers {
				if !s.IsActive {
					continue
				}
				activeMCPNames = append(activeMCPNames, s.Name)
				desc := ""
				if s.Description != nil {
					desc = *s.Description
				}
				mcpContextBuilder.WriteString(fmt.Sprintf("\n- MCP Connector [%s] (Endpoint: %s): %s", s.Name, s.URL, desc))

				if h.mcpSvc != nil {
					tools, _ := h.mcpSvc.FetchTools(c.Request().Context(), &s)
					if len(tools) > 0 {
						mcpContextBuilder.WriteString(" | Available Tools: ")
						for i, t := range tools {
							if i > 0 {
								mcpContextBuilder.WriteString(", ")
							}
							mcpContextBuilder.WriteString(t.Name)
						}
					}
				}
			}
		}
	}

	if mcpContextBuilder.Len() > 0 {
		mcpNote := "You are directly connected to the following active MCP (Model Context Protocol) connectors registered in the portal Settings:" +
			mcpContextBuilder.String() +
			"\nYou can reference these MCP connectors, their tools, and data capabilities when assisting engineers. If an engineer asks about GBA approvals, build verification, or tools from these connectors, provide accurate technical details based on these MCP connectors."

		if req.SystemPrompt != "" {
			req.SystemPrompt += "\n\n" + mcpNote
		} else {
			req.SystemPrompt = mcpNote
		}
	}

	reply, err := h.llmSvc.ChatCompletion(c.Request().Context(), cfg, &req)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadGateway, fmt.Sprintf("AI inference failed: %v", err))
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"reply":       reply,
		"model":       cfg.ModelName,
		"provider":    cfg.Name,
		"is_custom":   isCustom,
		"mcp_servers": activeMCPNames,
	})
}
