package handler

import (
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
}

func NewReportHandler(repo *repository.ReportRepository, smtpSvc *service.SMTPService, scheduler *service.ReportScheduler) *ReportHandler {
	return &ReportHandler{
		repo:      repo,
		smtpSvc:   smtpSvc,
		scheduler: scheduler,
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

	// Build structured Notion-style blocks
	type Block struct {
		Type    string      `json:"type"`
		Content string      `json:"content,omitempty"`
		Widget  string      `json:"widget,omitempty"`
		Title   string      `json:"title,omitempty"`
		Items   interface{} `json:"items,omitempty"`
	}

	var blocks []Block

	// Header summary block
	todayStr := time.Now().Format("Monday, 02 Jan 2006")
	blocks = append(blocks, Block{
		Type:    "heading",
		Content: fmt.Sprintf("1. Daily Operations & Task Progress (%s)", todayStr),
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
		blocks = append(blocks, Block{
			Type:  "checklist",
			Items: taskItems,
		})
	} else {
		blocks = append(blocks, Block{
			Type:    "paragraph",
			Content: "No assigned tasks recorded for this period. General line support was conducted.",
		})
	}

	// Live database widget for projects
	if len(activities.Projects) > 0 {
		blocks = append(blocks, Block{
			Type:    "heading",
			Content: "2. Active Projects Status",
		})
		blocks = append(blocks, Block{
			Type:   "db_widget",
			Widget: "projects",
			Title:  "Assigned Projects Overview",
		})
	}

	// Live database widget for new models
	if len(activities.Models) > 0 {
		blocks = append(blocks, Block{
			Type:    "heading",
			Content: "3. New Model Stage Milestones",
		})
		blocks = append(blocks, Block{
			Type:   "db_widget",
			Widget: "models",
			Title:  "Current Model Development Stages",
		})
	}

	// Blockers & Notes
	blocks = append(blocks, Block{
		Type:    "heading",
		Content: "4. Line Issues / Tomorrow Plan",
	})
	blocks = append(blocks, Block{
		Type:    "paragraph",
		Content: "Continue normal production support, monitor parameter drifts, and coordinate with R&D on open actions.",
	})

	return c.JSON(http.StatusOK, map[string]interface{}{
		"title":  fmt.Sprintf("Work Report - %s (%s)", activities.User.FullName, time.Now().Format("2006-01-02")),
		"blocks": blocks,
	})
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
