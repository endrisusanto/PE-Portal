package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"

	"pe-portal/internal/middleware"
	"pe-portal/internal/model"
	"pe-portal/internal/repository"
	"pe-portal/internal/service"
)

type ProjectHandler struct {
	repo       *repository.ProjectRepository
	userRepo   *repository.UserRepository
	reportRepo *repository.ReportRepository
	smtpSvc    *service.SMTPService
}

func NewProjectHandler(
	repo *repository.ProjectRepository,
	userRepo *repository.UserRepository,
	reportRepo *repository.ReportRepository,
	smtpSvc *service.SMTPService,
) *ProjectHandler {
	return &ProjectHandler{
		repo:       repo,
		userRepo:   userRepo,
		reportRepo: reportRepo,
		smtpSvc:    smtpSvc,
	}
}

func (h *ProjectHandler) List(c echo.Context) error {
	projectType := c.QueryParam("project_type")
	status := c.QueryParam("status")
	var groupID *uuid.UUID
	if gStr := c.QueryParam("group_id"); gStr != "" {
		if id, err := uuid.Parse(gStr); err == nil {
			groupID = &id
		}
	}

	projects, err := h.repo.List(c.Request().Context(), projectType, status, groupID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, projects)
}

func (h *ProjectHandler) Get(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid project id")
	}

	p, err := h.repo.GetByID(c.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "project not found")
	}
	return c.JSON(http.StatusOK, p)
}

type CreateProjectRequest struct {
	Title          string          `json:"title"`
	Description    *string         `json:"description"`
	ProjectType    string          `json:"project_type"`
	Status         string          `json:"status"`
	Priority       string          `json:"priority"`
	OwnerID        *uuid.UUID      `json:"owner_id"`
	GroupPartID    *uuid.UUID      `json:"group_part_id"`
	StartDate      *string         `json:"start_date"`
	TargetDate     *string         `json:"target_date"`
	CompletionDate *string         `json:"completion_date"`
	Progress       int             `json:"progress"`
	Metadata       json.RawMessage `json:"metadata"`
	Attachments    json.RawMessage `json:"attachments"`
	SendEmail      bool            `json:"send_email"`
}

type projectMetadataHelper struct {
	Visibility    string `json:"visibility"`
	CreatedByID   string `json:"created_by_id"`
	CreatedByName string `json:"created_by_name"`
	AssignedPics  []struct {
		ID       string `json:"id"`
		FullName string `json:"full_name"`
		Name     string `json:"name"`
		Email    string `json:"email"`
		Role     string `json:"role"`
	} `json:"assigned_pics"`
}

// ponytail: helper to extract distinct emails from assigned_pics
func extractAssignedEmails(metadata json.RawMessage) []string {
	if len(metadata) == 0 {
		return nil
	}
	var helper projectMetadataHelper
	if err := json.Unmarshal(metadata, &helper); err != nil {
		return nil
	}
	var emails []string
	seen := make(map[string]bool)
	for _, pic := range helper.AssignedPics {
		if pic.Email != "" && !seen[pic.Email] {
			seen[pic.Email] = true
			emails = append(emails, pic.Email)
		}
	}
	return emails
}

func (h *ProjectHandler) Create(c echo.Context) error {
	var req CreateProjectRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid input")
	}

	if req.Title == "" || req.ProjectType == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "title and project_type are required")
	}

	var ownerID *uuid.UUID
	if req.OwnerID != nil && *req.OwnerID != uuid.Nil {
		ownerID = req.OwnerID
	} else if uidVal := c.Get(middleware.ContextKeyUserID); uidVal != nil {
		if uid, ok := uidVal.(uuid.UUID); ok {
			ownerID = &uid
		}
	}

	status := req.Status
	if status == "" {
		status = "planning"
	}

	p := model.Project{
		Title:       req.Title,
		Description: req.Description,
		ProjectType: req.ProjectType,
		Status:      status,
		Priority:    req.Priority,
		OwnerID:     ownerID,
		GroupPartID: req.GroupPartID,
		StartDate:   req.StartDate,
		TargetDate:  req.TargetDate,
		Progress:    req.Progress,
		Metadata:    req.Metadata,
		Attachments: req.Attachments,
	}

	created, err := h.repo.Create(c.Request().Context(), &p)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	// Send SMTP assignment notification if requested and PIC is assigned (supports multiple PICs)
	if req.SendEmail && h.userRepo != nil && h.reportRepo != nil && h.smtpSvc != nil {
		toEmails := extractAssignedEmails(req.Metadata)
		if len(toEmails) == 0 && ownerID != nil {
			assignee, err := h.userRepo.GetByID(c.Request().Context(), *ownerID)
			if err == nil && assignee != nil && assignee.Email != "" {
				toEmails = append(toEmails, assignee.Email)
			}
		}

		if len(toEmails) > 0 {
			go func(recipients []string, projectTitle string, pType string, priority string, progress int, targetDateStr string, desc string) {
				ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
				defer cancel()

				smtpCfg, err := h.reportRepo.GetDefaultSMTP(ctx)
				if err != nil || smtpCfg == nil || smtpCfg.Host == "" {
					return
				}

				subject := fmt.Sprintf("[PE ToDo List] Penugasan Baru: %s", projectTitle)
				priorityColor := "#3b82f6"
				if priority == "urgent" || priority == "high" {
					priorityColor = "#ef4444"
				}

				descHTML := ""
				if desc != "" {
					descHTML = fmt.Sprintf(`<div style="margin: 16px 0; padding: 12px 14px; background: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px; font-size: 13px; color: #1e3a8a;"><strong>Catatan Investigasi / Detail:</strong><br/><span style="white-space: pre-wrap;">%s</span></div>`, desc)
				}

				htmlBody := fmt.Sprintf(`
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
  <div style="background: #1e293b; padding: 20px 24px; border-bottom: 3px solid #3b82f6;">
    <h2 style="margin: 0; color: #ffffff; font-size: 18px; font-weight: 700;">SEIN Production Engineer Portal</h2>
    <p style="margin: 4px 0 0; color: #94a3b8; font-size: 13px;">Notifikasi Penugasan ToDo List / Milestone Task</p>
  </div>
  <div style="padding: 24px;">
    <p style="font-size: 14px; color: #1e293b; margin-top: 0;">Halo Rekan Engineer,</p>
    <p style="font-size: 14px; color: #475569; line-height: 1.5;">Anda telah ditugaskan sebagai PIC untuk menganalisa, memproses, dan memantau progress task berikut:</p>
    
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 18px 0;">
      <table style="width: 100%%; border-collapse: collapse; font-size: 13.5px;">
        <tr>
          <td style="padding: 6px 0; color: #64748b; width: 140px; font-weight: 600;">Judul Task:</td>
          <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">%s</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Kategori / Tipe:</td>
          <td style="padding: 6px 0; color: #0f172a; text-transform: capitalize;">%s</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Prioritas:</td>
          <td style="padding: 6px 0;"><span style="color: %s; font-weight: 700; text-transform: uppercase;">%s</span></td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Milestone Awal:</td>
          <td style="padding: 6px 0; color: #0f172a;">Progress: %d%%</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Target Selesai:</td>
          <td style="padding: 6px 0; color: #0f172a;">%s</td>
        </tr>
      </table>
    </div>

    %s

    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.4;">
      <p style="margin: 0;">Silakan akses <strong>PE-Portal &gt; ToDo List</strong> untuk memperbarui progress, timeline diskusi, dan uji coba.</p>
      <p style="margin: 4px 0 0; color: #94a3b8;">Email ini dikirim otomatis oleh SEIN PE Portal Mail Gateway.</p>
    </div>
  </div>
</div>`,
					projectTitle,
					pType,
					priorityColor,
					priority,
					progress,
					targetDateStr,
					descHTML,
				)

				_ = h.smtpSvc.SendEmail(smtpCfg, recipients, nil, subject, htmlBody)
			}(toEmails, p.Title, p.ProjectType, p.Priority, p.Progress, func() string {
				if p.TargetDate != nil {
					return *p.TargetDate
				}
				return "-"
			}(), func() string {
				if p.Description != nil {
					return *p.Description
				}
				return ""
			}())
		}
	}

	return c.JSON(http.StatusCreated, created)
}

func (h *ProjectHandler) Update(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid project id")
	}

	var req CreateProjectRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid input")
	}

	p := model.Project{
		ID:             id,
		Title:          req.Title,
		Description:    req.Description,
		ProjectType:    req.ProjectType,
		Status:         req.Status,
		Priority:       req.Priority,
		OwnerID:        req.OwnerID,
		GroupPartID:    req.GroupPartID,
		StartDate:      req.StartDate,
		TargetDate:     req.TargetDate,
		CompletionDate: req.CompletionDate,
		Progress:       req.Progress,
		Metadata:       req.Metadata,
		Attachments:    req.Attachments,
	}

	updated, err := h.repo.Update(c.Request().Context(), &p)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, updated)
}

func (h *ProjectHandler) Delete(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid project id")
	}

	p, err := h.repo.GetByID(c.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "project not found")
	}

	role := ""
	if roleVal := c.Get(middleware.ContextKeyUserRole); roleVal != nil {
		if r, ok := roleVal.(string); ok {
			role = r
		}
	}

	var currentUserID uuid.UUID
	if uidVal := c.Get(middleware.ContextKeyUserID); uidVal != nil {
		if uid, ok := uidVal.(uuid.UUID); ok {
			currentUserID = uid
		}
	}

	isAuthorized := role == "admin" || role == "manager"
	if !isAuthorized && currentUserID != uuid.Nil {
		if p.OwnerID != nil && *p.OwnerID == currentUserID {
			isAuthorized = true
		} else if len(p.Metadata) > 0 {
			var meta map[string]interface{}
			if err := json.Unmarshal(p.Metadata, &meta); err == nil {
				if createdByID, ok := meta["created_by_id"].(string); ok && createdByID == currentUserID.String() {
					isAuthorized = true
				}
			}
		}
	}

	if !isAuthorized {
		return echo.NewHTTPError(http.StatusForbidden, "you are not authorized to delete this project")
	}

	if err := h.repo.Delete(c.Request().Context(), id); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "deleted successfully"})
}

// Tasks
func (h *ProjectHandler) ListTasks(c echo.Context) error {
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid project id")
	}

	tasks, err := h.repo.ListTasks(c.Request().Context(), projectID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, tasks)
}

type CreateTaskRequest struct {
	Title       string     `json:"title"`
	Description *string    `json:"description"`
	Status      string     `json:"status"`
	AssigneeID  *uuid.UUID `json:"assignee_id"`
	DueDate     *string    `json:"due_date"`
	SortOrder   int        `json:"sort_order"`
}

func (h *ProjectHandler) CreateTask(c echo.Context) error {
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid project id")
	}

	var req CreateTaskRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid input")
	}

	if req.Title == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "title is required")
	}

	task := model.ProjectTask{
		ProjectID:   projectID,
		Title:       req.Title,
		Description: req.Description,
		Status:      req.Status,
		AssigneeID:  req.AssigneeID,
		DueDate:     req.DueDate,
		SortOrder:   req.SortOrder,
	}

	created, err := h.repo.CreateTask(c.Request().Context(), &task)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusCreated, created)
}

func (h *ProjectHandler) UpdateTaskStatus(c echo.Context) error {
	taskID, err := uuid.Parse(c.Param("taskId"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid task id")
	}

	var req struct {
		Status string `json:"status"`
	}
	if err := c.Bind(&req); err != nil || req.Status == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "status is required")
	}

	if err := h.repo.UpdateTaskStatus(c.Request().Context(), taskID, req.Status); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "task status updated"})
}

var (
	gbaCacheData    map[string]interface{}
	gbaCacheTime    time.Time
	gbaCacheMu      sync.RWMutex
	gbaWorkingURL   string
	gbaWorkingURLMu sync.RWMutex
)

// GetGbaTasks proxies GBA task manager kanban data from intranet project_manager app (view only)
// ponytail: fast 2s timeout, in-memory 60s cache, and dynamic working-URL memory to eliminate 30s hangs
func (h *ProjectHandler) GetGbaTasks(c echo.Context) error {
	forceRefresh := c.QueryParam("refresh") == "true"

	if !forceRefresh {
		gbaCacheMu.RLock()
		if gbaCacheData != nil && time.Since(gbaCacheTime) < 60*time.Second {
			cached := gbaCacheData
			gbaCacheMu.RUnlock()
			return c.JSON(http.StatusOK, cached)
		}
		gbaCacheMu.RUnlock()
	}

	primaryURL := os.Getenv("GBA_API_URL")
	if primaryURL == "" {
		primaryURL = "http://107.102.39.55/tkdn/api_kanban.php"
	}

	client := &http.Client{Timeout: 2 * time.Second}

	// Build candidate URLs, prioritizing known working URL
	var candidates []string
	gbaWorkingURLMu.RLock()
	lastWorking := gbaWorkingURL
	gbaWorkingURLMu.RUnlock()

	if lastWorking != "" {
		candidates = append(candidates, lastWorking)
	}
	if primaryURL != lastWorking {
		candidates = append(candidates, primaryURL)
	}
	fallbackURLs := []string{
		"http://172.17.0.1:8089/api_kanban.php",
		"http://localhost:8089/api_kanban.php",
	}
	for _, fb := range fallbackURLs {
		if fb != lastWorking && fb != primaryURL {
			candidates = append(candidates, fb)
		}
	}

	var lastErr error
	var data map[string]interface{}

	for _, targetURL := range candidates {
		resp, err := client.Get(targetURL)
		if err != nil {
			lastErr = err
			continue
		}
		if resp.StatusCode != http.StatusOK {
			resp.Body.Close()
			lastErr = fmt.Errorf("status %d from %s", resp.StatusCode, targetURL)
			continue
		}

		err = json.NewDecoder(resp.Body).Decode(&data)
		resp.Body.Close()
		if err != nil {
			lastErr = err
			continue
		}

		// Success! Remember working URL and cache data
		gbaWorkingURLMu.Lock()
		gbaWorkingURL = targetURL
		gbaWorkingURLMu.Unlock()

		gbaCacheMu.Lock()
		gbaCacheData = data
		gbaCacheTime = time.Now()
		gbaCacheMu.Unlock()

		return c.JSON(http.StatusOK, data)
	}

	// If all network requests failed but we have stale cache, serve it
	gbaCacheMu.RLock()
	if gbaCacheData != nil {
		stale := gbaCacheData
		gbaCacheMu.RUnlock()
		return c.JSON(http.StatusOK, stale)
	}
	gbaCacheMu.RUnlock()

	return echo.NewHTTPError(http.StatusBadGateway, "Failed to connect to GBA Task Manager: "+lastErr.Error())
}

// SendEmailNotification sends an on-demand milestone progress email to the assignee or specified recipients
func (h *ProjectHandler) SendEmailNotification(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid project id")
	}

	p, err := h.repo.GetByID(c.Request().Context(), id)
	if err != nil || p == nil {
		return echo.NewHTTPError(http.StatusNotFound, "task not found")
	}

	var req struct {
		Recipients []string `json:"recipients"`
		Note       string   `json:"note"`
	}
	_ = c.Bind(&req)

	var toEmails []string
	if len(req.Recipients) > 0 {
		toEmails = req.Recipients
	} else {
		toEmails = extractAssignedEmails(p.Metadata)
		if len(toEmails) == 0 && p.OwnerID != nil && h.userRepo != nil {
			assignee, err := h.userRepo.GetByID(c.Request().Context(), *p.OwnerID)
			if err == nil && assignee != nil && assignee.Email != "" {
				toEmails = append(toEmails, assignee.Email)
			}
		}
	}

	// Fallback to all active admin or registered users if no direct PIC email
	if len(toEmails) == 0 && h.userRepo != nil {
		users, err := h.userRepo.ListUsers(c.Request().Context(), nil, "")
		if err == nil {
			for _, u := range users {
				if u.Email != "" && (u.Role == "admin" || u.Role == "manager") {
					toEmails = append(toEmails, u.Email)
				}
			}
		}
	}

	if len(toEmails) == 0 {
		return echo.NewHTTPError(http.StatusBadRequest, "Tidak ada email penerima. Pastikan PIC memiliki email aktif atau tentukan penerima.")
	}

	smtpCfg, err := h.reportRepo.GetDefaultSMTP(c.Request().Context())
	if err != nil || smtpCfg == nil || smtpCfg.Host == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "SMTP server belum dikonfigurasi di Settings / Reports.")
	}

	// Prepare milestone label
	stageLabel := "1. Issue Identified"
	if p.Progress >= 100 {
		stageLabel = "5. Closed & Standardized"
	} else if p.Progress >= 80 {
		stageLabel = "4. Verification & Yield"
	} else if p.Progress >= 60 {
		stageLabel = "3. Trial Countermeasure"
	} else if p.Progress >= 40 {
		stageLabel = "2. Root Cause Analysis"
	}

	subject := fmt.Sprintf("[Milestone Task Update] %s (Progress: %d%% - %s)", p.Title, p.Progress, stageLabel)

	priorityColor := "#3b82f6"
	if p.Priority == "urgent" || p.Priority == "high" {
		priorityColor = "#ef4444"
	}

	descText := "-"
	if p.Description != nil && *p.Description != "" {
		descText = *p.Description
	}

	targetDateText := "-"
	if p.TargetDate != nil && *p.TargetDate != "" {
		targetDateText = *p.TargetDate
	}

	noteHTML := ""
	if req.Note != "" {
		noteHTML = fmt.Sprintf(`<div style="margin: 16px 0; padding: 12px 14px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px; font-size: 13px; color: #92400e;"><strong>Catatan Tambahan Pengirim:</strong><br/><span style="white-space: pre-wrap;">%s</span></div>`, req.Note)
	}

	htmlBody := fmt.Sprintf(`
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
  <div style="background: #1e293b; padding: 20px 24px; border-bottom: 3px solid #3b82f6;">
    <h2 style="margin: 0; color: #ffffff; font-size: 18px; font-weight: 700;">SEIN Production Engineer Portal</h2>
    <p style="margin: 4px 0 0; color: #94a3b8; font-size: 13px;">Laporan Milestone & Status Problem Solving Task Analyst</p>
  </div>
  <div style="padding: 24px;">
    <p style="font-size: 14px; color: #1e293b; margin-top: 0;">Berikut adalah pembaruan status dan milestone untuk issue produksi:</p>
    
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 18px 0;">
      <table style="width: 100%%; border-collapse: collapse; font-size: 13.5px;">
        <tr>
          <td style="padding: 6px 0; color: #64748b; width: 140px; font-weight: 600;">Judul Issue:</td>
          <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">%s</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Kategori:</td>
          <td style="padding: 6px 0; color: #0f172a; text-transform: capitalize;">%s</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Prioritas:</td>
          <td style="padding: 6px 0;"><span style="color: %s; font-weight: 700; text-transform: uppercase;">%s</span></td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Milestone Tahap:</td>
          <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">%s (%d%%)</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Status:</td>
          <td style="padding: 6px 0; color: #0f172a; text-transform: uppercase; font-weight: 600;">%s</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Target Selesai:</td>
          <td style="padding: 6px 0; color: #0f172a;">%s</td>
        </tr>
      </table>
    </div>

    <div style="margin: 16px 0; padding: 12px 14px; background: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px; font-size: 13px; color: #1e3a8a;">
      <strong>Catatan Investigasi & Tindakan:</strong><br/>
      <span style="white-space: pre-wrap;">%s</span>
    </div>

    %s

    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.4;">
      <p style="margin: 0;">Silakan akses <strong>PE-Portal</strong> untuk melihat histori komentar dan pembaruan log milestone.</p>
      <p style="margin: 4px 0 0; color: #94a3b8;">Email ini dikirim melalui SEIN PE Portal Mail Gateway.</p>
    </div>
  </div>
</div>`,
		p.Title,
		p.ProjectType,
		priorityColor,
		p.Priority,
		stageLabel,
		p.Progress,
		p.Status,
		targetDateText,
		descText,
		noteHTML,
	)

	if err := h.smtpSvc.SendEmail(smtpCfg, toEmails, nil, subject, htmlBody); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Gagal mengirim email: "+err.Error())
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"message":    fmt.Sprintf("Email berhasil dikirim ke %d penerima (%s)", len(toEmails), toEmails[0]),
		"recipients": toEmails,
	})
}
