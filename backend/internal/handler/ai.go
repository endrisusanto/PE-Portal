package handler

import (
	"context"
	"encoding/json"
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
	peMCP   *service.PEMCPService
}

func NewAIHandler(repo *repository.LLMRepository, mcpRepo *repository.MCPRepository, mcpSvc *service.MCPClientService, llmSvc *service.LLMService, peMCP *service.PEMCPService) *AIHandler {
	return &AIHandler{
		repo:    repo,
		mcpRepo: mcpRepo,
		mcpSvc:  mcpSvc,
		llmSvc:  llmSvc,
		peMCP:   peMCP,
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
		if uid, ok := val.(uuid.UUID); ok && uid != uuid.Nil {
			uidPtr = &uid
		}
	}

	cfg, isCustom, err := h.repo.GetActiveLLM(c.Request().Context(), uidPtr)
	if err != nil {
		return echo.NewHTTPError(http.StatusServiceUnavailable, "LLM provider is not configured: "+err.Error())
	}

	// Extract current user info
	userName := "Engineer"
	userRole := "member"
	if uVal := c.Get(middleware.ContextKeyUserRole); uVal != nil {
		if r, ok := uVal.(string); ok && r != "" {
			userRole = r
		}
	}
	if claimsVal := c.Get(middleware.ContextKeyUserClaims); claimsVal != nil {
		if claims, ok := claimsVal.(*model.UserClaims); ok && claims.Username != "" {
			userName = claims.Username
		}
	}

	lastUserMsg := ""
	for i := len(req.Messages) - 1; i >= 0; i-- {
		if req.Messages[i].Role == "user" {
			lastUserMsg = fmt.Sprint(req.Messages[i].Content)
			break
		}
	}

	// ponytail: Inject registered active MCP servers from Settings into LLM context
	var activeMCPNames []string
	var mcpContextBuilder strings.Builder
	totalToolsCount := 0
	var primaryMCPServer *model.MCPServer
	var gbaMCPServer *model.MCPServer

	if h.mcpRepo != nil {
		servers, err := h.mcpRepo.List(c.Request().Context())
		if err == nil {
			for _, s := range servers {
				if !s.IsActive {
					continue
				}
				activeMCPNames = append(activeMCPNames, s.Name)
				if primaryMCPServer == nil {
					sCopy := s
					primaryMCPServer = &sCopy
				}
				if gbaMCPServer == nil && (strings.Contains(strings.ToLower(s.Name), "google") || strings.Contains(strings.ToLower(s.Name), "gba") || strings.Contains(s.URL, "3800")) {
					sCopy := s
					gbaMCPServer = &sCopy
				}
				desc := ""
				if s.Description != nil {
					desc = *s.Description
				}
				mcpContextBuilder.WriteString(fmt.Sprintf("\n- MCP Connector [%s] (Endpoint: %s): %s", s.Name, s.URL, desc))

				if h.mcpSvc != nil {
					tools, _ := h.mcpSvc.FetchTools(c.Request().Context(), &s)
					if len(tools) > 0 {
						totalToolsCount += len(tools)
						mcpContextBuilder.WriteString("\n  Available Tools:")
						for _, t := range tools {
							mcpContextBuilder.WriteString(fmt.Sprintf("\n  * %s: %s", t.Name, t.Description))
						}
					}
				}
			}
		}
	}

	// Check if this request comes with specialized context (e.g., PPTX summary, Document Analysis)
	hasSpecializedContext := strings.TrimSpace(req.SystemPrompt) != ""
	if !hasSpecializedContext {
		for _, m := range req.Messages {
			if m.Role == "system" && m.Content != nil && strings.TrimSpace(fmt.Sprint(m.Content)) != "" {
				hasSpecializedContext = true
				break
			}
		}
	}

	// ponytail: If active MCP server is connected (like project-manager-mcp), only forward queries that specifically target GBA / project manager tasks
	// DO NOT hijack queries when caller provided specialized context (such as PPTX defect reports)
	isMcpQuery := false
	if !hasSpecializedContext {
		lowerMsg := strings.ToLower(lastUserMsg)
		mcpKeywords := []string{"gba", "task gba", "tugas gba", "kanban gba", "project manager", "companion release"}
		for _, kw := range mcpKeywords {
			if strings.Contains(lowerMsg, kw) {
				isMcpQuery = true
				break
			}
		}
	}

	targetMcpServer := gbaMCPServer
	if targetMcpServer == nil {
		targetMcpServer = primaryMCPServer
	}

	if isMcpQuery && targetMcpServer != nil && h.mcpSvc != nil {
		mcpReply, err := h.mcpSvc.CallMCPChat(c.Request().Context(), targetMcpServer, lastUserMsg, req.Messages, userName, userRole, cfg)
		// ponytail: only return MCP reply if successful and not returning an unhandled upstream connection failure
		if err == nil && strings.TrimSpace(mcpReply) != "" && !strings.Contains(mcpReply, "Gagal terhubung ke LM Studio") {
			return c.JSON(http.StatusOK, map[string]interface{}{
				"reply":       mcpReply,
				"model":       "MCP: " + targetMcpServer.Name,
				"provider":    "MCP Connector",
				"is_custom":   true,
				"mcp_servers": activeMCPNames,
			})
		}
	}

	// Real-time PE Portal live data access via PE-Portal MCP
	if h.peMCP != nil {
		if peData := h.detectAndFetchPEData(c.Request().Context(), lastUserMsg); peData != "" {
			if req.SystemPrompt != "" {
				req.SystemPrompt += "\n\n" + peData
			} else {
				req.SystemPrompt = peData
			}
			hasPEMCPName := false
			for _, n := range activeMCPNames {
				if n == "SEIN PE Portal MCP" {
					hasPEMCPName = true
					break
				}
			}
			if !hasPEMCPName {
				activeMCPNames = append(activeMCPNames, "SEIN PE Portal MCP")
			}
		}
	}

	// For general engineering queries without custom prompt, inject active MCP servers info
	if !hasSpecializedContext && mcpContextBuilder.Len() > 0 {
		mcpNote := "You are directly connected to the following active MCP (Model Context Protocol) connectors registered in portal Settings:" +
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

	// Tool-calling loop: If LLM emits a tool call, execute it via PEMCP or external MCP servers and feed back to get final answer
	if toolName, toolArgs, ok := parseToolCall(reply); ok {
		var toolOutput string

		// 1. In-memory PE Portal MCP tools
		if h.peMCP != nil {
			if res, err := h.peMCP.CallTool(c.Request().Context(), toolName, toolArgs); err == nil {
				resBytes, _ := json.Marshal(res)
				toolOutput = string(resBytes)
			}
		}

		// 2. Remote MCP servers (e.g. GBA tools like db_list_tasks, db_create_task, etc.)
		if toolOutput == "" && h.mcpSvc != nil && h.mcpRepo != nil {
			servers, _ := h.mcpRepo.List(c.Request().Context())
			for _, s := range servers {
				if !s.IsActive {
					continue
				}
				if res, err := h.mcpSvc.CallTool(c.Request().Context(), &s, toolName, toolArgs); err == nil && strings.TrimSpace(res) != "" {
					toolOutput = res
					break
				}
			}
		}

		if toolOutput != "" {
			followUpReq := req
			followUpReq.Messages = append(followUpReq.Messages,
				model.ChatMessage{Role: "assistant", Content: reply},
				model.ChatMessage{Role: "user", Content: fmt.Sprintf("[TOOL RESULT FROM %s]:\n%s\n\nJawab pertanyaan engineer secara komprehensif, terstruktur, dan gunakan Markdown tables berdasarkan data tool di atas.", toolName, toolOutput)},
			)
			secondReply, err2 := h.llmSvc.ChatCompletion(c.Request().Context(), cfg, &followUpReq)
			if err2 == nil && strings.TrimSpace(secondReply) != "" {
				reply = secondReply
			}
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"reply":       reply,
		"model":       cfg.ModelName,
		"provider":    cfg.Name,
		"is_custom":   isCustom,
		"mcp_servers": activeMCPNames,
	})
}

// detectAndFetchPEData automatically queries relevant PE-Portal MCP tools to ground LLM responses with real portal data
func (h *AIHandler) detectAndFetchPEData(ctx context.Context, userMsg string) string {
	if h.peMCP == nil {
		return ""
	}

	lower := strings.ToLower(userMsg)

	// Check if user is asking about portal entities
	isPortalQuery := false
	keywords := []string{
		"portal", "pe portal", "sein", "model", "jadwal", "milestone",
		"schedule", "checkpoint", "task", "project", "proyek", "tugas",
		"kanban", "sample", "sampel", "pinjam", "dhl", "awb", "shipment",
		"inovasi", "innovation", "kaizen", "ringkasan", "overview",
		"summary", "statistik", "database", "unit", "mr release", "companion",
		"evt", "dvt", "pvt", "sop", "s26", "s25",
		"ecn", "eco", "engineering change", "running bom", "bom date", "child part", "remark", "smd", "mainline", "perubahan part", "perubahan komponen",
	}
	for _, kw := range keywords {
		if strings.Contains(lower, kw) {
			isPortalQuery = true
			break
		}
	}

	if !isPortalQuery {
		return ""
	}

	var dataBlocks []string

	// 1. Models & Milestones
	if strings.Contains(lower, "model") || strings.Contains(lower, "s26") || strings.Contains(lower, "s25") || strings.Contains(lower, "paradigm") {
		// Specific model details or milestones
		if strings.Contains(lower, "milestone") || strings.Contains(lower, "checkpoint") || strings.Contains(lower, "jadwal") || strings.Contains(lower, "detail") || strings.Contains(lower, "status") {
			modelName := ""
			if strings.Contains(lower, "s26") {
				modelName = "S26"
			} else if strings.Contains(lower, "s25") {
				modelName = "S25"
			} else if strings.Contains(lower, "paradigm") {
				modelName = "Paradigm"
			} else {
				for _, w := range strings.Fields(lower) {
					wClean := strings.Trim(w, `",.?!'()[]`)
					if strings.HasPrefix(wClean, "sm-") || strings.HasPrefix(wClean, "a1") || strings.HasPrefix(wClean, "a0") || strings.HasPrefix(wClean, "on") {
						modelName = wClean
						break
					}
				}
			}
			if modelName != "" {
				res, err := h.peMCP.CallTool(ctx, "pe_get_model_details", map[string]interface{}{"model_name": modelName})
				if err == nil {
					b, _ := json.Marshal(res)
					dataBlocks = append(dataBlocks, fmt.Sprintf("=== TOOL: pe_get_model_details (%s) ===\n%s", modelName, string(b)))
				}
			}
		}
		// Also list models
		res, err := h.peMCP.CallTool(ctx, "pe_list_new_models", map[string]interface{}{"limit": float64(20)})
		if err == nil {
			b, _ := json.Marshal(res)
			dataBlocks = append(dataBlocks, fmt.Sprintf("=== TOOL: pe_list_new_models ===\n%s", string(b)))
		}
	}

	// 2. Schedules / Calendar / Milestones
	if strings.Contains(lower, "jadwal") || strings.Contains(lower, "schedule") || strings.Contains(lower, "milestone") || strings.Contains(lower, "timeline") || strings.Contains(lower, "kalender") {
		alreadyFetched := false
		for _, b := range dataBlocks {
			if strings.Contains(b, "pe_get_model_schedules") {
				alreadyFetched = true
				break
			}
		}
		if !alreadyFetched {
			res, err := h.peMCP.CallTool(ctx, "pe_get_model_schedules", map[string]interface{}{"limit": float64(50)})
			if err == nil {
				b, _ := json.Marshal(res)
				dataBlocks = append(dataBlocks, fmt.Sprintf("=== TOOL: pe_get_model_schedules ===\n%s", string(b)))
			}
		}
	}

	// 3. Projects & Tasks
	if strings.Contains(lower, "task") || strings.Contains(lower, "project") || strings.Contains(lower, "tugas") || strings.Contains(lower, "proyek") || strings.Contains(lower, "kanban") {
		res, err := h.peMCP.CallTool(ctx, "pe_list_projects_and_tasks", map[string]interface{}{"limit": float64(30)})
		if err == nil {
			b, _ := json.Marshal(res)
			dataBlocks = append(dataBlocks, fmt.Sprintf("=== TOOL: pe_list_projects_and_tasks ===\n%s", string(b)))
		}
	}

	// 4. Samples
	if strings.Contains(lower, "sample") || strings.Contains(lower, "sampel") || strings.Contains(lower, "pinjam") || strings.Contains(lower, "unit") {
		res, err := h.peMCP.CallTool(ctx, "pe_list_samples", map[string]interface{}{"limit": float64(30)})
		if err == nil {
			b, _ := json.Marshal(res)
			dataBlocks = append(dataBlocks, fmt.Sprintf("=== TOOL: pe_list_samples ===\n%s", string(b)))
		}
	}

	// 5. Innovations
	if strings.Contains(lower, "inovasi") || strings.Contains(lower, "innovation") || strings.Contains(lower, "kaizen") || strings.Contains(lower, "ide") {
		res, err := h.peMCP.CallTool(ctx, "pe_list_innovations", map[string]interface{}{"limit": float64(25)})
		if err == nil {
			b, _ := json.Marshal(res)
			dataBlocks = append(dataBlocks, fmt.Sprintf("=== TOOL: pe_list_innovations ===\n%s", string(b)))
		}
	}

	// 6. DHL Shipments
	if strings.Contains(lower, "dhl") || strings.Contains(lower, "awb") || strings.Contains(lower, "tracking") || strings.Contains(lower, "kirim") || strings.Contains(lower, "shipment") {
		res, err := h.peMCP.CallTool(ctx, "pe_list_dhl_shipments", map[string]interface{}{"limit": float64(25)})
		if err == nil {
			b, _ := json.Marshal(res)
			dataBlocks = append(dataBlocks, fmt.Sprintf("=== TOOL: pe_list_dhl_shipments ===\n%s", string(b)))
		}
	}

	// 7. ECN (Engineering Change Notice) Monitoring - Full Database Access via MCP
	if strings.Contains(lower, "ecn") || strings.Contains(lower, "eco") || strings.Contains(lower, "running bom") || strings.Contains(lower, "remark") || strings.Contains(lower, "bom date") || strings.Contains(lower, "engineering change") || strings.Contains(lower, "perubahan part") || strings.Contains(lower, "perubahan komponen") {
		statArgs := map[string]interface{}{}
		for _, w := range strings.Fields(lower) {
			wClean := strings.Trim(w, `",.?!'()[]`)
			if strings.HasPrefix(wClean, "sm-") || strings.HasPrefix(wClean, "a5") || strings.HasPrefix(wClean, "a1") || strings.HasPrefix(wClean, "a0") {
				statArgs["model"] = wClean
				break
			}
		}
		if sRes, err := h.peMCP.CallTool(ctx, "pe_get_ecn_statistics", statArgs); err == nil {
			b, _ := json.Marshal(sRes)
			dataBlocks = append(dataBlocks, fmt.Sprintf("=== TOOL: pe_get_ecn_statistics ===\n%s", string(b)))
		}

		searchArgs := map[string]interface{}{"limit": float64(40)}
		if mVal, ok := statArgs["model"]; ok {
			searchArgs["model"] = mVal
		}
		if strings.Contains(lower, "cancel") {
			searchArgs["status"] = "cancel"
		} else if strings.Contains(lower, "progress") {
			// ponytail: match DB status "Progress" without requiring exact "in progress" prefix
			searchArgs["status"] = "progress"
		} else if strings.Contains(lower, "pending") {
			searchArgs["status"] = "pending"
		} else if strings.Contains(lower, "completed") || strings.Contains(lower, "selesai") {
			searchArgs["status"] = "completed"
		}

		if strings.Contains(lower, "smd") {
			searchArgs["process"] = "SMD"
		} else if strings.Contains(lower, "mainline") {
			searchArgs["process"] = "Mainline"
		} else if strings.Contains(lower, "vendor") {
			searchArgs["process"] = "Vendor"
		}

		for _, kw := range []string{"fet", "ic", "diode", "resistor", "pcb", "sub", "main", "conn", "cable", "supplier", "material"} {
			if strings.Contains(lower, kw) {
				searchArgs["search"] = kw
				break
			}
		}

		if ecnRes, err := h.peMCP.CallTool(ctx, "pe_search_ecn", searchArgs); err == nil {
			b, _ := json.Marshal(ecnRes)
			dataBlocks = append(dataBlocks, fmt.Sprintf("=== TOOL: pe_search_ecn (args: %+v) ===\n%s", searchArgs, string(b)))
		}
	}

	// 8. Overview fallback / pulse
	if len(dataBlocks) == 0 || strings.Contains(lower, "overview") || strings.Contains(lower, "summary") || strings.Contains(lower, "ringkasan") || strings.Contains(lower, "statistik") || strings.Contains(lower, "portal") {
		res, err := h.peMCP.CallTool(ctx, "pe_get_portal_overview", map[string]interface{}{})
		if err == nil {
			b, _ := json.Marshal(res)
			dataBlocks = append([]string{fmt.Sprintf("=== TOOL: pe_get_portal_overview ===\n%s", string(b))}, dataBlocks...)
		}
	}

	if len(dataBlocks) == 0 {
		return ""
	}

	return "\n\n[REAL-TIME DATA ACCESSED VIA SEIN PE-PORTAL MCP SERVER]:\n" +
		strings.Join(dataBlocks, "\n\n") +
		"\n[INSTRUCTION]: You have direct, live access to the PE Portal database via PE-Portal MCP. The above live data was retrieved in real-time from the database for this query. Answer authoritatively using this real data. Format lists, stages, milestones, dates, or comparisons using clean, well-aligned Markdown tables."
}

// parseToolCall detects and parses tool-call syntax emitted by fine-tuned LLMs (Gemma, Llama, Ollama, OpenAI)
func parseToolCall(reply string) (string, map[string]interface{}, bool) {
	clean := strings.TrimSpace(reply)

	// Check if wrapped in <|tool_call>...<tool_call|> or <tool_call>...</tool_call>
	callStr := clean
	if idx := strings.Index(clean, "<|tool_call>"); idx >= 0 {
		endIdx := strings.Index(clean, "<tool_call|>")
		if endIdx > idx {
			callStr = strings.TrimSpace(clean[idx+len("<|tool_call>") : endIdx])
		} else {
			callStr = strings.TrimSpace(clean[idx+len("<|tool_call>"):])
		}
	} else if idx := strings.Index(clean, "<tool_call>"); idx >= 0 {
		endIdx := strings.Index(clean, "</tool_call>")
		if endIdx > idx {
			callStr = strings.TrimSpace(clean[idx+len("<tool_call>") : endIdx])
		} else {
			callStr = strings.TrimSpace(clean[idx+len("<tool_call>"):])
		}
	}

	callStr = strings.TrimPrefix(callStr, "call:")
	callStr = strings.TrimSpace(callStr)

	// Match: tool_name(arg1="val1", arg2="val2")
	parenStart := strings.Index(callStr, "(")
	parenEnd := strings.LastIndex(callStr, ")")
	if parenStart > 0 && parenEnd > parenStart {
		toolName := strings.TrimSpace(callStr[:parenStart])
		argsRaw := strings.TrimSpace(callStr[parenStart+1 : parenEnd])
		args := make(map[string]interface{})

		if argsRaw != "" {
			parts := strings.Split(argsRaw, ",")
			for _, p := range parts {
				kv := strings.SplitN(p, "=", 2)
				if len(kv) == 2 {
					k := strings.TrimSpace(kv[0])
					v := strings.TrimSpace(kv[1])
					v = strings.Trim(v, `"' `)
					args[k] = v
				}
			}
		}
		return toolName, args, true
	}

	// JSON fallback: {"name": "...", "arguments": {...}}
	var jsonCall struct {
		Name      string                 `json:"name"`
		Arguments map[string]interface{} `json:"arguments"`
	}
	if err := json.Unmarshal([]byte(callStr), &jsonCall); err == nil && jsonCall.Name != "" {
		if jsonCall.Arguments == nil {
			jsonCall.Arguments = make(map[string]interface{})
		}
		return jsonCall.Name, jsonCall.Arguments, true
	}

	return "", nil, false
}
