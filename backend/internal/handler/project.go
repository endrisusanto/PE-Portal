package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
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
	SendEmail      bool            `json:"send_email"`
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
	}

	created, err := h.repo.Create(c.Request().Context(), &p)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	// Send SMTP assignment notification if requested and PIC is assigned
	if req.SendEmail && ownerID != nil && h.userRepo != nil && h.reportRepo != nil && h.smtpSvc != nil {
		go func(targetUserID uuid.UUID, projectTitle string, pType string, priority string, progress int, targetDateStr string, desc string) {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()

			assignee, err := h.userRepo.GetByID(ctx, targetUserID)
			if err != nil || assignee == nil || assignee.Email == "" {
				return
			}

			smtpCfg, err := h.reportRepo.GetDefaultSMTP(ctx)
			if err != nil || smtpCfg == nil || smtpCfg.Host == "" {
				return
			}

			subject := fmt.Sprintf("[PE Milestone Task] Penugasan Issue Baru: %s", projectTitle)
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
    <p style="margin: 4px 0 0; color: #94a3b8; font-size: 13px;">Notifikasi Penugasan Issue / Milestone Task Analisis</p>
  </div>
  <div style="padding: 24px;">
    <p style="font-size: 14px; color: #1e293b; margin-top: 0;">Halo <strong>%s</strong>,</p>
    <p style="font-size: 14px; color: #475569; line-height: 1.5;">Anda telah ditugaskan sebagai PIC untuk menganalisa dan memantau progress issue produksi berikut:</p>
    
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 18px 0;">
      <table style="width: 100%%; border-collapse: collapse; font-size: 13.5px;">
        <tr>
          <td style="padding: 6px 0; color: #64748b; width: 140px; font-weight: 600;">Judul Issue:</td>
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
      <p style="margin: 0;">Silakan akses <strong>PE-Portal</strong> untuk memperbarui milestone stepper, catatan investigasi, dan uji coba countermeasure.</p>
      <p style="margin: 4px 0 0; color: #94a3b8;">Email ini dikirim otomatis oleh SEIN PE Portal Mail Gateway.</p>
    </div>
  </div>
</div>`,
				assignee.FullName,
				projectTitle,
				pType,
				priorityColor,
				priority,
				progress,
				targetDateStr,
				descHTML,
			)

			_ = h.smtpSvc.SendEmail(smtpCfg, []string{assignee.Email}, nil, subject, htmlBody)
		}(*ownerID, p.Title, p.ProjectType, p.Priority, p.Progress, func() string {
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

// GetGbaTasks proxies GBA task manager kanban data from intranet project_manager app (view only)
func (h *ProjectHandler) GetGbaTasks(c echo.Context) error {
	apiURL := os.Getenv("GBA_API_URL")
	if apiURL == "" {
		apiURL = "http://107.102.39.55/tkdn/api_kanban.php"
	}

	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get(apiURL)
	if err != nil {
		// Fallback for local docker/host execution when intranet 107.102.39.55 is unreachable
		resp, err = client.Get("http://172.17.0.1:8089/api_kanban.php")
		if err != nil {
			resp, err = client.Get("http://localhost:8089/api_kanban.php")
		}
	}
	if err != nil {
		return echo.NewHTTPError(http.StatusBadGateway, "Failed to connect to GBA Task Manager: "+err.Error())
	}
	defer resp.Body.Close()

	var data map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to decode GBA tasks: "+err.Error())
	}

	return c.JSON(http.StatusOK, data)
}
