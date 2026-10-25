package handler

import (
	"context"
	"encoding/json"
	"fmt"
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

type ReportHandler struct {
	repo      *repository.ReportRepository
	smtpSvc   *service.SMTPService
	scheduler *service.ReportScheduler
	llmRepo   *repository.LLMRepository
	llmSvc    *service.LLMService
}

func NewReportHandler(
	repo *repository.ReportRepository,
	smtpSvc *service.SMTPService,
	scheduler *service.ReportScheduler,
	llmRepo *repository.LLMRepository,
	llmSvc *service.LLMService,
) *ReportHandler {
	return &ReportHandler{
		repo:      repo,
		smtpSvc:   smtpSvc,
		scheduler: scheduler,
		llmRepo:   llmRepo,
		llmSvc:    llmSvc,
	}
}

func getUserID(c echo.Context) (uuid.UUID, error) {
	val := c.Get(middleware.ContextKeyUserID)
	if val == nil {
		return uuid.Nil, fmt.Errorf("user not authenticated")
	}
	uid, ok := val.(uuid.UUID)
	if !ok {
		return uuid.Nil, fmt.Errorf("invalid user id in context")
	}
	return uid, nil
}

// ==========================================
// Templates Handlers
// ==========================================

func (h *ReportHandler) ListTemplates(c echo.Context) error {
	uid, err := getUserID(c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, err.Error())
	}

	templates, err := h.repo.ListTemplates(c.Request().Context(), uid)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if templates == nil {
		templates = []model.ReportTemplate{}
	}
	return c.JSON(http.StatusOK, templates)
}

func (h *ReportHandler) GetTemplate(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid template id")
	}

	tmpl, err := h.repo.GetTemplate(c.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "template not found")
	}
	return c.JSON(http.StatusOK, tmpl)
}

type CreateTemplateRequest struct {
	Title       string          `json:"title"`
	Description *string         `json:"description"`
	Category    string          `json:"category"`
	Content     json.RawMessage `json:"content"`
	IsShared    bool            `json:"is_shared"`
}

func (h *ReportHandler) CreateTemplate(c echo.Context) error {
	uid, err := getUserID(c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, err.Error())
	}

	var req CreateTemplateRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request")
	}
	if strings.TrimSpace(req.Title) == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "title is required")
	}
	if req.Category == "" {
		req.Category = "daily"
	}

	tmpl := model.ReportTemplate{
		Title:       req.Title,
		Description: req.Description,
		Category:    req.Category,
		Content:     req.Content,
		IsShared:    req.IsShared,
		AuthorID:    &uid,
	}

	saved, err := h.repo.CreateTemplate(c.Request().Context(), &tmpl)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusCreated, saved)
}

func (h *ReportHandler) UpdateTemplate(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid template id")
	}

	var req CreateTemplateRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request")
	}

	tmpl := model.ReportTemplate{
		ID:          id,
		Title:       req.Title,
		Description: req.Description,
		Category:    req.Category,
		Content:     req.Content,
		IsShared:    req.IsShared,
	}

	updated, err := h.repo.UpdateTemplate(c.Request().Context(), &tmpl)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, updated)
}

func (h *ReportHandler) DeleteTemplate(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid template id")
	}

	if err := h.repo.DeleteTemplate(c.Request().Context(), id); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.NoContent(http.StatusNoContent)
}

// ==========================================
// Digital Reports Handlers
// ==========================================

func (h *ReportHandler) ListReports(c echo.Context) error {
	uid, err := getUserID(c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, err.Error())
	}

	reports, err := h.repo.ListReports(c.Request().Context(), uid)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if reports == nil {
		reports = []model.DigitalReport{}
	}
	return c.JSON(http.StatusOK, reports)
}

func (h *ReportHandler) GetReport(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid report id")
	}

	report, err := h.repo.GetReport(c.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "report not found")
	}
	return c.JSON(http.StatusOK, report)
}

type SaveReportRequest struct {
	Title        string          `json:"title"`
	TemplateID   *uuid.UUID      `json:"template_id"`
	ReportDate   string          `json:"report_date"`
	Status       string          `json:"status"`
	Content      json.RawMessage `json:"content"`
	RenderedHTML string          `json:"rendered_html"`
	Recipients   json.RawMessage `json:"recipients"`
}

func (h *ReportHandler) CreateReport(c echo.Context) error {
	uid, err := getUserID(c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, err.Error())
	}

	var req SaveReportRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request")
	}
	if strings.TrimSpace(req.Title) == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "title is required")
	}
	if req.ReportDate == "" {
		req.ReportDate = time.Now().Format("2006-01-02")
	}
	if req.Status == "" {
		req.Status = "draft"
	}

	report := model.DigitalReport{
		Title:        req.Title,
		TemplateID:   req.TemplateID,
		AuthorID:     &uid,
		ReportDate:   req.ReportDate,
		Status:       req.Status,
		Content:      req.Content,
		RenderedHTML: req.RenderedHTML,
		Recipients:   req.Recipients,
	}

	saved, err := h.repo.CreateReport(c.Request().Context(), &report)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusCreated, saved)
}

func (h *ReportHandler) UpdateReport(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid report id")
	}

	var req SaveReportRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request")
	}

	report := model.DigitalReport{
		ID:           id,
		Title:        req.Title,
		TemplateID:   req.TemplateID,
		ReportDate:   req.ReportDate,
		Status:       req.Status,
		Content:      req.Content,
		RenderedHTML: req.RenderedHTML,
		Recipients:   req.Recipients,
	}

	updated, err := h.repo.UpdateReport(c.Request().Context(), &report)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, updated)
}

func (h *ReportHandler) DeleteReport(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid report id")
	}

	if err := h.repo.DeleteReport(c.Request().Context(), id); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.NoContent(http.StatusNoContent)
}

// SendReport sends a saved report via SMTP immediately
func (h *ReportHandler) SendReport(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid report id")
	}

	report, err := h.repo.GetReport(c.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "report not found")
	}

	smtpCfg, err := h.repo.GetDefaultSMTP(c.Request().Context())
	if err != nil || smtpCfg == nil {
		return echo.NewHTTPError(http.StatusBadRequest, "default SMTP gateway not configured")
	}

	type RecipientList struct {
		To []string `json:"to"`
		Cc []string `json:"cc"`
	}
	var recList RecipientList
	if len(report.Recipients) > 0 {
		_ = json.Unmarshal(report.Recipients, &recList)
	}

	if len(recList.To) == 0 {
		return echo.NewHTTPError(http.StatusBadRequest, "no recipient email configured in this report")
	}

	subject := fmt.Sprintf("[%s] %s (%s)", smtpCfg.FromName, report.Title, report.ReportDate)
	htmlBody := report.RenderedHTML
	if htmlBody == "" {
		htmlBody = fmt.Sprintf("<html><body><h2>%s</h2><p>Report date: %s</p></body></html>", report.Title, report.ReportDate)
	}

	sendErr := h.smtpSvc.SendEmail(smtpCfg, recList.To, recList.Cc, subject, htmlBody)

	// Record in audit log
	status := "success"
	var errMsg *string
	if sendErr != nil {
		status = "failed"
		msg := sendErr.Error()
		errMsg = &msg
	}

	_ = h.repo.CreateLog(c.Request().Context(), &model.ReportSendLog{
		ReportID:     &report.ID,
		UserID:       report.AuthorID,
		Recipients:   report.Recipients,
		Subject:      subject,
		Status:       status,
		ErrorMessage: errMsg,
		SentAt:       time.Now(),
	})

	if sendErr != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "SMTP transmission failed: "+sendErr.Error())
	}

	// Update status to 'sent'
	report.Status = "sent"
	_, _ = h.repo.UpdateReport(c.Request().Context(), report)

	return c.JSON(http.StatusOK, map[string]interface{}{
		"status":  "sent",
		"message": "Report sent successfully via SMTP",
	})
}

// ==========================================
// Schedules Handlers
// ==========================================

func (h *ReportHandler) ListSchedules(c echo.Context) error {
	uid, err := getUserID(c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, err.Error())
	}

	schedules, err := h.repo.ListSchedules(c.Request().Context(), uid)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if schedules == nil {
		schedules = []model.ReportSchedule{}
	}
	return c.JSON(http.StatusOK, schedules)
}

type CreateScheduleRequest struct {
	Title          string          `json:"title"`
	TemplateID     *uuid.UUID      `json:"template_id"`
	CronExpression string          `json:"cron_expression"`
	Recipients     json.RawMessage `json:"recipients"`
	IsActive       bool            `json:"is_active"`
}

func (h *ReportHandler) CreateSchedule(c echo.Context) error {
	uid, err := getUserID(c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, err.Error())
	}

	var req CreateScheduleRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request")
	}

	if req.CronExpression == "" {
		req.CronExpression = "0 17 * * 1-5"
	}

	// Calculate initial next run
	next := time.Now().Add(24 * time.Hour)

	schedule := model.ReportSchedule{
		UserID:         uid,
		Title:          req.Title,
		TemplateID:     req.TemplateID,
		CronExpression: req.CronExpression,
		Recipients:     req.Recipients,
		IsActive:       req.IsActive,
		NextRunAt:      &next,
	}

	saved, err := h.repo.CreateSchedule(c.Request().Context(), &schedule)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusCreated, saved)
}

func (h *ReportHandler) UpdateSchedule(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid schedule id")
	}

	var req CreateScheduleRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request")
	}

	schedule := model.ReportSchedule{
		ID:             id,
		Title:          req.Title,
		TemplateID:     req.TemplateID,
		CronExpression: req.CronExpression,
		Recipients:     req.Recipients,
		IsActive:       req.IsActive,
	}

	updated, err := h.repo.UpdateSchedule(c.Request().Context(), &schedule)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, updated)
}

func (h *ReportHandler) DeleteSchedule(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid schedule id")
	}

	if err := h.repo.DeleteSchedule(c.Request().Context(), id); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.NoContent(http.StatusNoContent)
}

func (h *ReportHandler) TriggerSchedule(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid schedule id")
	}

	if err := h.scheduler.TriggerScheduleNow(c.Request().Context(), id); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, map[string]string{"message": "Schedule execution triggered in background"})
}

// ==========================================
// RAG & Database Scraping Handlers
// ==========================================

func (h *ReportHandler) ScrapeActivities(c echo.Context) error {
	uid, err := getUserID(c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, err.Error())
	}

	activities, err := h.repo.ScrapeMemberActivities(c.Request().Context(), uid)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, activities)
}

type SynthesizeRequest struct {
	Prompt string `json:"prompt"`
}

type SynthesizedReportResponse struct {
	Title  string                   `json:"title"`
	Blocks []map[string]interface{} `json:"blocks"`
}

// SynthesizeReport converts scraped database items into formatted report blocks
func (h *ReportHandler) SynthesizeReport(c echo.Context) error {
	uid, err := getUserID(c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, err.Error())
	}

	var req SynthesizeRequest
	_ = c.Bind(&req)

	activities, err := h.repo.ScrapeMemberActivities(c.Request().Context(), uid)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	trimmedPrompt := strings.TrimSpace(req.Prompt)

	// If prompt is empty, return standard one-click RAG draft (100% backward compatible)
	if trimmedPrompt == "" {
		return c.JSON(http.StatusOK, h.generateDefaultRAGBlocks(activities))
	}

	// Custom Prompt Mode: Try LLM first if available
	if h.llmRepo != nil && h.llmSvc != nil {
		uidPtr := &uid
		cfg, _, err := h.llmRepo.GetActiveLLM(c.Request().Context(), uidPtr)
		if err == nil && cfg != nil && cfg.IsActive {
			llmRes, err := h.callLLMForReport(c.Request().Context(), cfg, trimmedPrompt, activities)
			if err == nil && llmRes != nil && len(llmRes.Blocks) > 0 {
				return c.JSON(http.StatusOK, llmRes)
			}
		}
	}

	// Fallback: Rule-based semantic synthesis when LLM is offline/unconfigured
	return c.JSON(http.StatusOK, h.generateSemanticFallbackBlocks(trimmedPrompt, activities))
}

func (h *ReportHandler) generateDefaultRAGBlocks(activities *repository.ScrapedActivities) *SynthesizedReportResponse {
	var blocks []map[string]interface{}

	// Header summary block
	todayStr := time.Now().Format("Monday, 02 Jan 2006")
	blocks = append(blocks, map[string]interface{}{
		"type":    "heading",
		"content": fmt.Sprintf("1. Daily Operations & Task Progress (%s)", todayStr),
	})

	var taskItems []map[string]interface{}
	for _, t := range activities.Tasks {
		done := t.Status == "done"
		taskItems = append(taskItems, map[string]interface{}{
			"text":   fmt.Sprintf("[%s] %s", strings.ToUpper(t.Status), t.Title),
			"done":   done,
			"status": t.Status,
		})
	}
	if len(taskItems) > 0 {
		blocks = append(blocks, map[string]interface{}{
			"type":  "checklist",
			"items": taskItems,
		})
	} else {
		blocks = append(blocks, map[string]interface{}{
			"type":    "paragraph",
			"content": "No assigned tasks recorded for this period. General line support was conducted.",
		})
	}

	// Live database widget for projects
	if len(activities.Projects) > 0 {
		blocks = append(blocks, map[string]interface{}{
			"type":    "heading",
			"content": "2. Active Projects Status",
		})
		blocks = append(blocks, map[string]interface{}{
			"type":   "db_widget",
			"widget": "projects",
			"title":  "Assigned Projects Overview",
		})
	}

	// Live database widget for new models
	if len(activities.Models) > 0 {
		blocks = append(blocks, map[string]interface{}{
			"type":    "heading",
			"content": "3. New Model Stage Milestones",
		})
		blocks = append(blocks, map[string]interface{}{
			"type":   "db_widget",
			"widget": "models",
			"title":  "Current Model Development Stages",
		})
	}

	// Blockers & Notes
	blocks = append(blocks, map[string]interface{}{
		"type":    "heading",
		"content": "4. Line Issues / Tomorrow Plan",
	})
	blocks = append(blocks, map[string]interface{}{
		"type":    "paragraph",
		"content": "Continue normal production support, monitor parameter drifts, and coordinate with R&D on open actions.",
	})

	return &SynthesizedReportResponse{
		Title:  fmt.Sprintf("Work Report - %s (%s)", activities.User.FullName, time.Now().Format("2006-01-02")),
		Blocks: blocks,
	}
}

func (h *ReportHandler) callLLMForReport(ctx context.Context, cfg *model.LLMConfig, userPrompt string, act *repository.ScrapedActivities) (*SynthesizedReportResponse, error) {
	// Prepare context summary
	contextData, _ := json.Marshal(map[string]interface{}{
		"user":     act.User.FullName,
		"tasks":    act.Tasks,
		"projects": act.Projects,
		"models":   act.Models,
		"dhl":      act.DHL,
		"date":     time.Now().Format("2006-01-02"),
	})

	systemPrompt := `You are the SEIN PE Engineering AI Report Synthesizer.
The user wants to generate an interactive digital work report based on their prompt and real database records.
You MUST output ONLY a valid JSON object matching the schema below, without markdown blocks, explanation or conversational text:

Schema:
{
  "title": "Descriptive Report Title",
  "blocks": [
    ...
  ]
}

Supported block types in this portal:
1. Heading:
   {"type": "heading", "content": "1. Section Title"}
2. Paragraph:
   {"type": "paragraph", "content": "Detailed descriptive or technical summary text..."}
3. Checklist:
   {"type": "checklist", "items": [{"text": "[STATUS] Description", "done": false, "status": "done"}]}
4. Database Widget (renders live portal database records as either a Table or an interactive Chart):
   Widgets: "dhl", "projects", "models", "tasks", "software_mr", "gba_tasks"
   Modes:
   - For TABLE view:
     {"type": "db_widget", "widget": "dhl", "displayMode": "table", "title": "DHL Active Shipments"}
   - For CHART view:
     {"type": "db_widget", "widget": "dhl", "displayMode": "chart", "chartType": "pie"|"donut"|"bar", "title": "DHL Status Distribution"}
     (CRITICAL: When user requests a chart of database data, you MUST set displayMode to "chart" AND chartType to "pie", "donut", or "bar" matching the user's requested chart type!)
5. Standalone Charts (for custom or general statistics):
   - Pie: {"type": "chart_pie", "title": "...", "data": [{"label": "A", "value": 10, "color": "#10b981"}]}
   - Donut: {"type": "chart_donut", "title": "...", "data": [{"label": "A", "value": 10, "color": "#8b5cf6"}]}
   - Bar: {"type": "chart_bar", "title": "...", "color": "#0284c7", "data": [{"label": "A", "value": 15}]}
   - Line: {"type": "chart_line", "title": "...", "color": "#0d7377", "data": [{"label": "Mon", "value": 98.2}]}

CHART SELECTION RULES:
1. If the user mentions "pie" or "piechart", choose "pie" chartType (db_widget with displayMode: "chart", chartType: "pie", or chart_pie).
2. If the user mentions "donut" or "donutchart", choose "donut" chartType (db_widget with displayMode: "chart", chartType: "donut", or chart_donut).
3. If the user mentions "bar" or "barchart", choose "bar" chartType (db_widget with displayMode: "chart", chartType: "bar", or chart_bar).
4. If the user asks for BOTH table and chart (e.g. "tampilkan dalam table dan piechart" or "table and chart"):
   You MUST include BOTH:
   a) A table block: {"type": "db_widget", "widget": "dhl", "displayMode": "table", "title": "DHL Shipment Records"}
   b) A chart block: {"type": "db_widget", "widget": "dhl", "displayMode": "chart", "chartType": "pie", "title": "DHL Status Distribution"}`

	userMsg := fmt.Sprintf("USER INSTRUCTION: %s\n\nPORTAL REAL DATABASE CONTEXT:\n%s", userPrompt, string(contextData))

	chatReq := model.AIChatRequest{
		Messages: []model.ChatMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userMsg},
		},
		Temperature: 0.3,
		MaxTokens:   3500,
	}

	reply, err := h.llmSvc.ChatCompletion(ctx, cfg, &chatReq)
	if err != nil {
		return nil, err
	}

	cleanJSON := strings.TrimSpace(reply)
	if strings.HasPrefix(cleanJSON, "```") {
		firstLineEnd := strings.Index(cleanJSON, "\n")
		if firstLineEnd != -1 {
			cleanJSON = cleanJSON[firstLineEnd+1:]
		}
		if strings.HasSuffix(cleanJSON, "```") {
			cleanJSON = cleanJSON[:len(cleanJSON)-3]
		}
		cleanJSON = strings.TrimSpace(cleanJSON)
	}

	var resp SynthesizedReportResponse
	if err := json.Unmarshal([]byte(cleanJSON), &resp); err != nil {
		return nil, fmt.Errorf("failed to parse LLM JSON: %w (raw: %s)", err, reply)
	}

	if resp.Title == "" {
		resp.Title = fmt.Sprintf("Work Report - %s (%s)", act.User.FullName, time.Now().Format("2006-01-02"))
	}

	// Ponytail: normalize blocks to guarantee correct chart types, IDs, and table/chart pairings
	resp.Blocks = h.normalizeReportBlocks(resp.Blocks, userPrompt)

	return &resp, nil
}

// ponytail: robust normalization of LLM blocks to ensure correct chart types, IDs, and table/chart pairings
func (h *ReportHandler) normalizeReportBlocks(blocks []map[string]interface{}, prompt string) []map[string]interface{} {
	pLower := strings.ToLower(prompt)
	wantsPie := strings.Contains(pLower, "pie")
	wantsDonut := strings.Contains(pLower, "donut")
	wantsBar := strings.Contains(pLower, "bar")
	wantsTable := strings.Contains(pLower, "table") || strings.Contains(pLower, "tabel")
	wantsChart := wantsPie || wantsDonut || wantsBar || strings.Contains(pLower, "chart") || strings.Contains(pLower, "grafik")

	targetChartType := "bar"
	if wantsDonut {
		targetChartType = "donut"
	} else if wantsPie {
		targetChartType = "pie"
	}

	var normalized []map[string]interface{}
	hasAnyChart := false
	nowNano := time.Now().UnixNano()

	for idx, b := range blocks {
		if b == nil {
			continue
		}
		// Ensure unique ID
		if _, ok := b["id"]; !ok || b["id"] == nil || b["id"] == "" {
			b["id"] = fmt.Sprintf("blk_%d_%d", nowNano, idx)
		}

		bType, _ := b["type"].(string)
		bTypeLower := strings.ToLower(strings.TrimSpace(bType))

		// Normalize type aliases
		switch bTypeLower {
		case "pie", "piechart", "pie_chart":
			b["type"] = "chart_pie"
			hasAnyChart = true
		case "donut", "donutchart", "donut_chart":
			b["type"] = "chart_donut"
			hasAnyChart = true
		case "bar", "barchart", "bar_chart":
			b["type"] = "chart_bar"
			hasAnyChart = true
		case "line", "linechart", "line_chart":
			b["type"] = "chart_line"
			hasAnyChart = true
		case "chart_pie", "chart_donut", "chart_bar", "chart_line":
			hasAnyChart = true
		case "db_widget":
			dispMode, _ := b["displayMode"].(string)
			dispLower := strings.ToLower(strings.TrimSpace(dispMode))
			chartType, _ := b["chartType"].(string)

			// If LLM mistakenly passed chart type as displayMode
			if dispLower == "pie" || dispLower == "donut" || dispLower == "bar" {
				b["chartType"] = dispLower
				b["displayMode"] = "chart"
				hasAnyChart = true
			} else if dispLower == "chart" {
				hasAnyChart = true
				if chartType == "" {
					b["chartType"] = targetChartType
				}
			} else {
				// displayMode is table or empty
				b["displayMode"] = "table"
				if chartType == "" && wantsChart {
					b["chartType"] = targetChartType
				}
			}
		}

		normalized = append(normalized, b)
	}

	// If user explicitly asked for a chart, but LLM only outputted table(s) without chart
	if wantsChart && !hasAnyChart {
		foundDbWidget := false
		for i, b := range normalized {
			if b["type"] == "db_widget" {
				foundDbWidget = true
				widgetName, _ := b["widget"].(string)
				title, _ := b["title"].(string)

				if wantsTable {
					// User wanted both table AND chart, but only table was generated: append chart widget
					chartBlock := map[string]interface{}{
						"id":          fmt.Sprintf("blk_%d_chart_%d", nowNano, i),
						"type":        "db_widget",
						"widget":      widgetName,
						"displayMode": "chart",
						"chartType":   targetChartType,
						"title":       fmt.Sprintf("%s (%s Chart)", title, strings.ToUpper(targetChartType)),
					}
					normalized = append(normalized, chartBlock)
				} else {
					// User only wanted chart, but LLM made it table: switch to chart
					b["displayMode"] = "chart"
					b["chartType"] = targetChartType
				}
				break
			}
		}

		// If no db_widget was found at all, but prompt mentions DHL or projects, inject one
		if !foundDbWidget {
			widget := "tasks"
			if strings.Contains(pLower, "dhl") {
				widget = "dhl"
			} else if strings.Contains(pLower, "project") || strings.Contains(pLower, "proyek") {
				widget = "projects"
			} else if strings.Contains(pLower, "model") {
				widget = "models"
			}

			normalized = append(normalized, map[string]interface{}{
				"id":          fmt.Sprintf("blk_%d_gen_chart", nowNano),
				"type":        "db_widget",
				"widget":      widget,
				"displayMode": "chart",
				"chartType":   targetChartType,
				"title":       fmt.Sprintf("%s Status (%s Chart)", strings.ToUpper(widget), strings.ToUpper(targetChartType)),
			})
		}
	}

	return normalized
}

func (h *ReportHandler) generateSemanticFallbackBlocks(prompt string, act *repository.ScrapedActivities) *SynthesizedReportResponse {
	p := strings.ToLower(prompt)
	todayStr := time.Now().Format("Monday, 02 Jan 2006")
	var blocks []map[string]interface{}

	title := fmt.Sprintf("Report: %s - %s", prompt, time.Now().Format("2006-01-02"))
	if len(title) > 80 {
		title = fmt.Sprintf("Work Report - %s (%s)", act.User.FullName, time.Now().Format("2006-01-02"))
	}

	// DHL handling
	if strings.Contains(p, "dhl") {
		title = fmt.Sprintf("DHL Shipment & Logistics Status Report (%s)", time.Now().Format("2006-01-02"))
		blocks = append(blocks, map[string]interface{}{
			"type":    "heading",
			"content": fmt.Sprintf("1. DHL Express Logistics & Sample Hardware Status (%s)", todayStr),
		})
		deliveredCount := 0
		transitCount := 0
		exceptionCount := 0
		for _, s := range act.DHL {
			switch strings.ToLower(s.StatusCode) {
			case "delivered":
				deliveredCount++
			case "exception", "failure":
				exceptionCount++
			default:
				transitCount++
			}
		}
		totalDHL := len(act.DHL)
		blocks = append(blocks, map[string]interface{}{
			"type": "paragraph",
			"content": fmt.Sprintf("Overview of %d monitored DHL shipments for engineering samples and prototype hardware: %d delivered, %d in transit, and %d exceptions/pending.",
				totalDHL, deliveredCount, transitCount, exceptionCount),
		})

		// Table
		if strings.Contains(p, "table") || strings.Contains(p, "tabel") || !strings.Contains(p, "only") {
			blocks = append(blocks, map[string]interface{}{
				"type":        "db_widget",
				"widget":      "dhl",
				"displayMode": "table",
				"title":       "DHL Express Active Shipments",
			})
		}

		// Chart View (db_widget with chartType or chart_pie)
		if strings.Contains(p, "pie") || strings.Contains(p, "chart") || strings.Contains(p, "grafik") || strings.Contains(p, "bar") || strings.Contains(p, "donut") {
			chartType := "pie"
			if strings.Contains(p, "donut") {
				chartType = "donut"
			} else if strings.Contains(p, "bar") {
				chartType = "bar"
			}
			blocks = append(blocks, map[string]interface{}{
				"type":        "db_widget",
				"widget":      "dhl",
				"displayMode": "chart",
				"chartType":   chartType,
				"title":       fmt.Sprintf("DHL Shipment Status (%s Chart)", strings.ToUpper(chartType)),
			})
		}
	}

	// Projects handling
	if strings.Contains(p, "project") || strings.Contains(p, "proyek") {
		blocks = append(blocks, map[string]interface{}{
			"type":    "heading",
			"content": "2. Assigned Engineering Projects Status",
		})
		blocks = append(blocks, map[string]interface{}{
			"type":        "db_widget",
			"widget":      "projects",
			"displayMode": "table",
			"title":       "Active Projects",
		})
		if strings.Contains(p, "chart") || strings.Contains(p, "bar") || strings.Contains(p, "grafik") {
			var barData []map[string]interface{}
			for _, proj := range act.Projects {
				barData = append(barData, map[string]interface{}{
					"label": proj.Title,
					"value": proj.Progress,
				})
			}
			if len(barData) > 0 {
				blocks = append(blocks, map[string]interface{}{
					"type":  "chart_bar",
					"title": "Project Completion Progress (%)",
					"color": "#0284c7",
					"data":  barData,
				})
			}
		}
	}

	// Tasks handling
	if strings.Contains(p, "task") || strings.Contains(p, "tugas") || strings.Contains(p, "daily") || len(blocks) == 0 {
		blocks = append(blocks, map[string]interface{}{
			"type":    "heading",
			"content": fmt.Sprintf("Daily Task Operations (%s)", todayStr),
		})
		var taskItems []map[string]interface{}
		for _, t := range act.Tasks {
			done := t.Status == "done"
			taskItems = append(taskItems, map[string]interface{}{
				"text":   fmt.Sprintf("[%s] %s", strings.ToUpper(t.Status), t.Title),
				"done":   done,
				"status": t.Status,
			})
		}
		if len(taskItems) > 0 {
			blocks = append(blocks, map[string]interface{}{
				"type":  "checklist",
				"items": taskItems,
			})
		} else {
			blocks = append(blocks, map[string]interface{}{
				"type":    "paragraph",
				"content": "No specific tasks registered for today. Line support and JIG verifications were executed.",
			})
		}
	}

	// Action Plan
	blocks = append(blocks, map[string]interface{}{
		"type":    "heading",
		"content": "Next Action Plan & Tomorrow Objectives",
	})
	blocks = append(blocks, map[string]interface{}{
		"type":    "paragraph",
		"content": "Follow up on open milestones, ensure test line repeatability, and coordinate with team members on pending deliverables.",
	})

	return &SynthesizedReportResponse{
		Title:  title,
		Blocks: h.normalizeReportBlocks(blocks, prompt),
	}
}

// ==========================================
// SMTP & Logs Handlers
// ==========================================

func (h *ReportHandler) GetSMTPConfig(c echo.Context) error {
	cfg, err := h.repo.GetDefaultSMTP(c.Request().Context())
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "SMTP gateway configuration not found")
	}
	// Mask password for safety
	cfg.Password = "••••••••"
	return c.JSON(http.StatusOK, cfg)
}

func (h *ReportHandler) UpdateSMTPConfig(c echo.Context) error {
	var cfg model.SMTPConfig
	if err := c.Bind(&cfg); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request")
	}

	// If password masked, retain previous
	if cfg.Password == "••••••••" || cfg.Password == "" {
		existing, _ := h.repo.GetDefaultSMTP(c.Request().Context())
		if existing != nil {
			cfg.Password = existing.Password
		}
	}

	saved, err := h.repo.SaveSMTP(c.Request().Context(), &cfg)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	saved.Password = "••••••••"
	return c.JSON(http.StatusOK, saved)
}

type TestSMTPReq struct {
	Recipient string `json:"recipient"`
}

func (h *ReportHandler) TestSMTP(c echo.Context) error {
	var req TestSMTPReq
	_ = c.Bind(&req)

	cfg, err := h.repo.GetDefaultSMTP(c.Request().Context())
	if err != nil || cfg == nil {
		return echo.NewHTTPError(http.StatusBadRequest, "no SMTP configuration found")
	}

	testRecipient := req.Recipient
	if testRecipient == "" {
		testRecipient = cfg.FromEmail
	}

	if err := h.smtpSvc.TestConnection(cfg, testRecipient); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "SMTP connection test failed: "+err.Error())
	}

	return c.JSON(http.StatusOK, map[string]string{
		"status":  "success",
		"message": fmt.Sprintf("Test email successfully dispatched to %s", testRecipient),
	})
}

func (h *ReportHandler) ListLogs(c echo.Context) error {
	logs, err := h.repo.ListLogs(c.Request().Context(), nil, 50)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if logs == nil {
		logs = []model.ReportSendLog{}
	}
	return c.JSON(http.StatusOK, logs)
}
