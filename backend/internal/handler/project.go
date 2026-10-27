package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"html"
	"net/http"
	"os"
	"strings"
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
	repo        *repository.ProjectRepository
	userRepo    *repository.UserRepository
	reportRepo  *repository.ReportRepository
	commentRepo *repository.CommentRepository
	smtpSvc     *service.SMTPService
}

func NewProjectHandler(
	repo *repository.ProjectRepository,
	userRepo *repository.UserRepository,
	reportRepo *repository.ReportRepository,
	commentRepo *repository.CommentRepository,
	smtpSvc *service.SMTPService,
) *ProjectHandler {
	return &ProjectHandler{
		repo:        repo,
		userRepo:    userRepo,
		reportRepo:  reportRepo,
		commentRepo: commentRepo,
		smtpSvc:     smtpSvc,
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

type technicalReportHelper struct {
	Drafter                  string `json:"drafter"`
	PartLeader               string `json:"part_leader"`
	GroupLeader              string `json:"group_leader"`
	Model                    string `json:"model"`
	DefectDate               string `json:"defect_date"`
	DefectLocation           string `json:"defect_location"`
	Problem                  string `json:"problem"`
	CN                       string `json:"cn"`
	DefectQty                string `json:"defect_qty"`
	SymptomsAnalysis         string `json:"symptoms_analysis"`
	Symptoms                 string `json:"symptoms"`
	ConclusionCountermeasure string `json:"conclusion_countermeasure"`
	Countermeasure           string `json:"countermeasure"`
}

type taskAttachmentHelper struct {
	Name string `json:"name"`
	Size int64  `json:"size"`
	URL  string `json:"url"`
}

type projectMetadataHelper struct {
	Visibility      string                 `json:"visibility"`
	CreatedByID     string                 `json:"created_by_id"`
	CreatedByName   string                 `json:"created_by_name"`
	AssignedPics    []struct {
		ID       string `json:"id"`
		FullName string `json:"full_name"`
		Name     string `json:"name"`
		Email    string `json:"email"`
		Role     string `json:"role"`
	} `json:"assigned_pics"`
	TechnicalReport *technicalReportHelper `json:"technical_report"`
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
			go func(recipients []string, proj *model.Project) {
				ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
				defer cancel()

				smtpCfg, err := h.reportRepo.GetDefaultSMTP(ctx)
				if err != nil || smtpCfg == nil || smtpCfg.Host == "" {
					return
				}

				subject := fmt.Sprintf("[PE ToDo List] Penugasan Baru: %s", proj.Title)
				htmlBody := buildProjectDetailEmailHTML(proj, nil, "Penugasan baru milestone task analyst.")
				_ = h.smtpSvc.SendEmail(smtpCfg, recipients, nil, subject, htmlBody)
			}(toEmails, created)
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

// ponytail: buildProjectDetailEmailHTML constructs a rich HTML email formatted exactly like the Detail ToDo / Task Analyst modal view, including full comments
func buildProjectDetailEmailHTML(p *model.Project, comments []model.Comment, senderNote string) string {
	// Parse metadata
	var metaHelper projectMetadataHelper
	if len(p.Metadata) > 0 {
		_ = json.Unmarshal(p.Metadata, &metaHelper)
	}

	// Determine milestone step & label
	step := 1
	stepLabel := "1. Issue Identified"
	if p.Progress >= 100 {
		step = 5
		stepLabel = "5. Closed & Standardized"
	} else if p.Progress >= 80 {
		step = 4
		stepLabel = "4. Verification & Yield"
	} else if p.Progress >= 60 {
		step = 3
		stepLabel = "3. Trial Countermeasure"
	} else if p.Progress >= 40 {
		step = 2
		stepLabel = "2. Root Cause Analysis"
	}

	// Priority badge styling
	priorityBg := "#eff6ff"
	priorityColor := "#2563eb"
	if p.Priority == "urgent" || p.Priority == "high" {
		priorityBg = "#fef2f2"
		priorityColor = "#dc2626"
	} else if p.Priority == "medium" {
		priorityBg = "#fffbeb"
		priorityColor = "#d97706"
	}

	// Status badge
	statusLabel := strings.ToUpper(p.Status)
	if statusLabel == "" {
		statusLabel = "PLANNING"
	}

	// Visibility badge
	visLabel := "Publik"
	visBg := "#f0fdf4"
	visColor := "#16a34a"
	if metaHelper.Visibility == "private_pic" {
		visLabel = "Privat PIC"
		visBg = "#fef2f2"
		visColor = "#dc2626"
	} else if metaHelper.Visibility == "manager" {
		visLabel = "Manager & PIC"
		visBg = "#fffbeb"
		visColor = "#d97706"
	}

	// Assigned PICs string
	var assignedNames []string
	for _, pic := range metaHelper.AssignedPics {
		name := strings.TrimSpace(pic.FullName)
		if name == "" {
			name = strings.TrimSpace(pic.Name)
		}
		if name == "" {
			name = strings.TrimSpace(pic.Email)
		}
		if name != "" {
			assignedNames = append(assignedNames, name)
		}
	}
	assignedStr := "Unassigned"
	if len(assignedNames) > 0 {
		assignedStr = strings.Join(assignedNames, ", ")
	} else if p.OwnerName != nil && *p.OwnerName != "" {
		assignedStr = *p.OwnerName
	}

	// Created by
	createdByStr := "Team Member"
	if metaHelper.CreatedByName != "" {
		createdByStr = metaHelper.CreatedByName
	}

	// Target date & Created date
	targetDateStr := "Tidak ada target"
	if p.TargetDate != nil && *p.TargetDate != "" {
		targetDateStr = *p.TargetDate
	}
	createdAtStr := p.CreatedAt.Format("02 Jan 2006, 15:04 WIB")

	// 5-Stage Stepper HTML
	stages := []struct {
		num   int
		label string
	}{
		{1, "1. Issue Identified"},
		{2, "2. Root Cause"},
		{3, "3. Trial Action"},
		{4, "4. Verification"},
		{5, "5. Standardized"},
	}
	var stepperCols strings.Builder
	for _, s := range stages {
		colStyle := "background: #f8fafc; color: #94a3b8; border: 1px solid #e2e8f0;"
		numPrefix := fmt.Sprintf("%d", s.num)
		if s.num == step {
			colStyle = "background: #2563eb; color: #ffffff; border: 1px solid #1d4ed8; font-weight: 700;"
		} else if s.num < step {
			colStyle = "background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; font-weight: 600;"
			numPrefix = "✓"
		}
		stepperCols.WriteString(fmt.Sprintf(
			`<td style="padding: 7px 4px; border-radius: 6px; text-align: center; %s">
				<span style="font-size: 10px; display: block; opacity: 0.85;">%s</span>
				<span style="font-size: 11px;">%s</span>
			</td>`,
			colStyle, numPrefix, s.label,
		))
	}

	// Technical report section (OQC)
	techReportHTML := ""
	if tr := metaHelper.TechnicalReport; tr != nil {
		drafter := tr.Drafter
		if drafter == "" && p.OwnerName != nil {
			drafter = *p.OwnerName
		}
		if drafter == "" {
			drafter = "—"
		}
		partLeader := tr.PartLeader
		if partLeader == "" {
			partLeader = "—"
		}
		groupLeader := tr.GroupLeader
		if groupLeader == "" {
			groupLeader = "hendra.n@samsung.com"
		}

		modelVal := tr.Model
		if modelVal == "" {
			modelVal = "—"
		}
		defectDate := tr.DefectDate
		if defectDate == "" && p.StartDate != nil {
			defectDate = *p.StartDate
		}
		if defectDate == "" {
			defectDate = "—"
		}
		defectLoc := tr.DefectLocation
		if defectLoc == "" {
			defectLoc = "—"
		}
		problemTitle := tr.Problem
		if problemTitle == "" {
			problemTitle = p.Title
		}
		cnVal := tr.CN
		if cnVal == "" {
			cnVal = "—"
		}
		qtyVal := tr.DefectQty
		if qtyVal == "" {
			qtyVal = "—"
		}

		symptoms := tr.SymptomsAnalysis
		if symptoms == "" {
			symptoms = tr.Symptoms
		}
		symptomsHTML := ""
		if strings.TrimSpace(symptoms) != "" {
			symptomsHTML = fmt.Sprintf(`
				<div style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; background: #ffffff;">
					<div style="font-size: 11px; font-weight: 700; color: #1e3a8a; text-transform: uppercase; margin-bottom: 4px;">1. Symptoms &amp; Analysis</div>
					<div style="font-size: 12px; color: #1e293b; line-height: 1.5; white-space: pre-wrap;">%s</div>
				</div>`,
				html.EscapeString(symptoms),
			)
		}

		countermeasure := tr.ConclusionCountermeasure
		if countermeasure == "" {
			countermeasure = tr.Countermeasure
		}
		countermeasureHTML := ""
		if strings.TrimSpace(countermeasure) != "" {
			countermeasureHTML = fmt.Sprintf(`
				<div style="padding: 10px 12px; background: #ffffff;">
					<div style="font-size: 11px; font-weight: 700; color: #1e3a8a; text-transform: uppercase; margin-bottom: 4px;">2. Conclusion &amp; Countermeasure</div>
					<div style="font-size: 12px; color: #1e293b; line-height: 1.5; white-space: pre-wrap;">%s</div>
				</div>`,
				html.EscapeString(countermeasure),
			)
		}

		techReportHTML = fmt.Sprintf(`
			<div style="border: 2px solid #1e3a8a; border-radius: 6px; overflow: hidden; margin-bottom: 18px; background: #ffffff;">
				<div style="background: #2563eb; color: #ffffff; font-size: 12px; font-weight: 800; text-align: center; padding: 6px 8px; letter-spacing: 0.06em; text-transform: uppercase;">
					OQC TECHNICAL REPORT
				</div>
				<table style="width: 100%%; border-collapse: collapse; font-size: 11.5px; border-bottom: 1px solid #cbd5e1;">
					<tr style="background: #f8fafc;">
						<td style="width: 12%%; padding: 6px 8px; font-weight: 700; color: #475569; border-right: 1px solid #e2e8f0;">Drafter</td>
						<td style="width: 21%%; padding: 6px 8px; font-weight: 600; color: #0f172a; border-right: 1px solid #e2e8f0;">%s</td>
						<td style="width: 14%%; padding: 6px 8px; font-weight: 700; color: #475569; border-right: 1px solid #e2e8f0;">Part Leader</td>
						<td style="width: 20%%; padding: 6px 8px; font-weight: 600; color: #0f172a; border-right: 1px solid #e2e8f0;">%s</td>
						<td style="width: 14%%; padding: 6px 8px; font-weight: 700; color: #475569; border-right: 1px solid #e2e8f0;">Group Leader</td>
						<td style="width: 19%%; padding: 6px 8px; font-weight: 600; color: #0f172a;">%s</td>
					</tr>
				</table>
				<div style="background: #2563eb; color: #ffffff; font-size: 11px; font-weight: 800; text-align: center; padding: 5px 8px; letter-spacing: 0.06em; text-transform: uppercase;">
					PROBLEM INFORMATION
				</div>
				<table style="width: 100%%; border-collapse: collapse; font-size: 11.5px;">
					<tr>
						<td style="width: 15%%; padding: 6px 8px; font-weight: 700; color: #475569; background: #f8fafc; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">Model</td>
						<td style="width: 35%%; padding: 6px 8px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">%s</td>
						<td style="width: 18%%; padding: 6px 8px; font-weight: 700; color: #475569; background: #f8fafc; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">Defect Date</td>
						<td style="width: 32%%; padding: 6px 8px; color: #0f172a; border-bottom: 1px solid #e2e8f0;">%s</td>
					</tr>
					<tr>
						<td style="padding: 6px 8px; font-weight: 700; color: #475569; background: #f8fafc; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">Problem</td>
						<td colspan="3" style="padding: 6px 8px; font-weight: 600; color: #0f172a; border-bottom: 1px solid #e2e8f0;">%s</td>
					</tr>
					<tr>
						<td style="padding: 6px 8px; font-weight: 700; color: #475569; background: #f8fafc; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">Defect Location</td>
						<td style="padding: 6px 8px; color: #0f172a; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">%s</td>
						<td style="padding: 6px 8px; font-weight: 700; color: #475569; background: #f8fafc; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">CN / Qty</td>
						<td style="padding: 6px 8px; color: #0f172a; border-bottom: 1px solid #e2e8f0;">%s (Qty: %s)</td>
					</tr>
				</table>
				%s
				%s
			</div>`,
			html.EscapeString(drafter),
			html.EscapeString(partLeader),
			html.EscapeString(groupLeader),
			html.EscapeString(modelVal),
			html.EscapeString(defectDate),
			html.EscapeString(problemTitle),
			html.EscapeString(defectLoc),
			html.EscapeString(cnVal),
			html.EscapeString(qtyVal),
			symptomsHTML,
			countermeasureHTML,
		)
	}

	// Task description & attachments
	descVal := "Belum ada catatan investigasi atau countermeasure yang dicatat untuk task ini."
	if p.Description != nil && strings.TrimSpace(*p.Description) != "" {
		descVal = *p.Description
	}

	attachmentsHTML := ""
	var taskAttachments []taskAttachmentHelper
	if len(p.Attachments) > 0 {
		_ = json.Unmarshal(p.Attachments, &taskAttachments)
	}
	if len(taskAttachments) > 0 {
		var attItems strings.Builder
		for _, a := range taskAttachments {
			sizeKB := a.Size / 1024
			attItems.WriteString(fmt.Sprintf(`<li style="margin-bottom: 2px;">📎 %s (%d KB)</li>`, html.EscapeString(a.Name), sizeKB))
		}
		attachmentsHTML = fmt.Sprintf(`
			<div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 11.5px; color: #475569;">
				<strong>Lampiran Bukti &amp; Dokumen (%d):</strong>
				<ul style="margin: 4px 0 0; padding-left: 18px;">
					%s
				</ul>
			</div>`,
			len(taskAttachments),
			attItems.String(),
		)
	}

	// Sender note if present
	senderNoteHTML := ""
	if strings.TrimSpace(senderNote) != "" {
		senderNoteHTML = fmt.Sprintf(`
			<div style="margin-bottom: 18px; padding: 12px 14px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 6px; font-size: 13px; color: #92400e;">
				<strong>Catatan Tambahan Pengirim:</strong><br/>
				<span style="white-space: pre-wrap;">%s</span>
			</div>`,
			html.EscapeString(senderNote),
		)
	}

	// Full Comments & Timeline Section
	commentsHTML := ""
	if len(comments) == 0 {
		commentsHTML = `<div style="font-size: 12px; color: #94a3b8; font-style: italic; padding: 8px 0;">Belum ada komentar diskusi pada task ini.</div>`
	} else {
		var commBuilder strings.Builder
		for _, c := range comments {
			authorName := "Team Member"
			if c.AuthorName != nil && *c.AuthorName != "" {
				authorName = *c.AuthorName
			}
			timeStr := c.CreatedAt.Format("02 Jan 2006, 15:04 WIB")
			contentHTML := strings.ReplaceAll(html.EscapeString(c.Content), "\n", "<br/>")

			// Check comment attachments
			var cAtts []taskAttachmentHelper
			if len(c.Attachments) > 0 {
				_ = json.Unmarshal(c.Attachments, &cAtts)
			}
			attStr := ""
			if len(cAtts) > 0 {
				var aNames []string
				for _, ca := range cAtts {
					aNames = append(aNames, html.EscapeString(ca.Name))
				}
				attStr = fmt.Sprintf(`<div style="margin-top: 5px; font-size: 11px; color: #64748b;">📎 %s</div>`, strings.Join(aNames, ", "))
			}

			commBuilder.WriteString(fmt.Sprintf(`
				<div style="margin-bottom: 10px; padding: 10px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
					<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; font-size: 12px;">
						<strong style="color: #0f172a;">%s</strong>
						<span style="color: #64748b; font-size: 11px;">%s</span>
					</div>
					<div style="font-size: 12.5px; color: #334155; line-height: 1.45;">%s</div>
					%s
				</div>`,
				html.EscapeString(authorName),
				timeStr,
				contentHTML,
				attStr,
			))
		}
		commentsHTML = commBuilder.String()
	}

	return fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
</head>
<body style="margin: 0; padding: 20px 10px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <div style="max-width: 680px; margin: 0 auto; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06);">
    
    <!-- Top Branding Header -->
    <div style="background: #1e293b; padding: 18px 22px; border-bottom: 3px solid #2563eb;">
      <table style="width: 100%%; border-collapse: collapse;">
        <tr>
          <td>
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #60a5fa; font-weight: 700;">SEIN Production Engineer Portal</div>
            <div style="font-size: 17px; font-weight: 800; color: #ffffff; margin-top: 2px;">Detail ToDo / Task Analyst Report</div>
          </td>
          <td style="text-align: right; vertical-align: middle;">
            <span style="display: inline-block; padding: 4px 12px; background: rgba(37, 99, 235, 0.25); border: 1px solid #3b82f6; border-radius: 20px; font-size: 12px; font-weight: 700; color: #93c5fd;">
              Tahap %d (%d%%%%)
            </span>
          </td>
        </tr>
      </table>
    </div>

    <div style="padding: 20px 22px;">

      <!-- Hero Card with Badges & Metadata -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 18px; margin-bottom: 18px;">
        <div style="margin-bottom: 10px;">
          <span style="display: inline-block; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 3px 8px; border-radius: 4px; background: #e0f2fe; color: #0369a1; margin-right: 6px;">%s</span>
          <span style="display: inline-block; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 3px 8px; border-radius: 4px; background: %s; color: %s; margin-right: 6px;">%s</span>
          <span style="display: inline-block; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 3px 8px; border-radius: 4px; background: #f1f5f9; color: #475569; margin-right: 6px;">%s</span>
          <span style="display: inline-block; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 4px; background: %s; color: %s;">%s</span>
        </div>

        <h2 style="margin: 0 0 12px 0; font-size: 17px; font-weight: 800; color: #0f172a; line-height: 1.35;">%s</h2>

        <table style="width: 100%%; border-collapse: collapse; font-size: 12.5px; border-top: 1px solid #e2e8f0;">
          <tr>
            <td style="padding: 5px 0; color: #64748b; width: 130px; font-weight: 600;">Assigned PIC:</td>
            <td style="padding: 5px 0; color: #0f172a; font-weight: 700;">%s</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; color: #64748b; font-weight: 600;">Pembuat Task:</td>
            <td style="padding: 5px 0; color: #0f172a;">%s</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; color: #64748b; font-weight: 600;">Target Selesai:</td>
            <td style="padding: 5px 0; color: #0f172a;">%s</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; color: #64748b; font-weight: 600;">Tanggal Dibuat:</td>
            <td style="padding: 5px 0; color: #0f172a;">%s</td>
          </tr>
        </table>
      </div>

      <!-- Milestone 5-Tahap Stepper -->
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; margin-bottom: 18px;">
        <div style="font-size: 11.5px; font-weight: 700; color: #475569; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.04em;">
          Milestone Breadcrumb Trail (5-Tahap) — <span style="color: #2563eb;">%s</span>
        </div>
        <table style="width: 100%%; border-collapse: separate; border-spacing: 4px; font-size: 11px;">
          <tr>
            %s
          </tr>
        </table>
      </div>

      <!-- Technical Report Section (OQC Format) if present -->
      %s

      <!-- Catatan Analisis / Investigasi Teknis -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; margin-bottom: 18px;">
        <div style="font-size: 12px; font-weight: 700; color: #1e293b; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px;">
          Catatan Analisis / Investigasi Teknis
        </div>
        <div style="font-size: 12.5px; color: #334155; line-height: 1.5; white-space: pre-wrap; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px;">%s</div>
        %s
      </div>

      <!-- Sender Note if provided -->
      %s

      <!-- FULL COMMENTS & DISCUSSION SECTION -->
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; margin-bottom: 18px;">
        <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 12px;">
          Histori Diskusi &amp; Komentar Tim (%d)
        </div>
        %s
      </div>

      <!-- Footer Note -->
      <div style="padding-top: 14px; border-top: 1px solid #e2e8f0; font-size: 11.5px; color: #64748b; line-height: 1.5;">
        <p style="margin: 0;">Silakan akses <strong>SEIN PE-Portal &gt; ToDo List</strong> untuk memperbarui progress atau menanggapi diskusi.</p>
        <p style="margin: 4px 0 0; color: #94a3b8;">Email ini dikirim otomatis melalui SEIN PE Portal Mail Gateway.</p>
      </div>

    </div>
  </div>
</body>
</html>`,
		step,
		p.Progress,
		html.EscapeString(p.ProjectType),
		priorityBg,
		priorityColor,
		html.EscapeString(p.Priority),
		html.EscapeString(statusLabel),
		visBg,
		visColor,
		html.EscapeString(visLabel),
		html.EscapeString(p.Title),
		html.EscapeString(assignedStr),
		html.EscapeString(createdByStr),
		html.EscapeString(targetDateStr),
		createdAtStr,
		html.EscapeString(stepLabel),
		stepperCols.String(),
		techReportHTML,
		html.EscapeString(descVal),
		attachmentsHTML,
		senderNoteHTML,
		len(comments),
		commentsHTML,
	)
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

		// Also check if technical report specifies a valid group leader / part leader email
		var metaHelper projectMetadataHelper
		if len(p.Metadata) > 0 {
			if err := json.Unmarshal(p.Metadata, &metaHelper); err == nil && metaHelper.TechnicalReport != nil {
				gl := strings.TrimSpace(metaHelper.TechnicalReport.GroupLeader)
				if strings.Contains(gl, "@") {
					exists := false
					for _, em := range toEmails {
						if strings.EqualFold(em, gl) {
							exists = true
							break
						}
					}
					if !exists {
						toEmails = append(toEmails, gl)
					}
				}
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

	// Prepare milestone label for subject
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

	// ponytail: Fetch comments and timeline for complete email body
	var comments []model.Comment
	if h.commentRepo != nil {
		if cList, err := h.commentRepo.ListByEntity(c.Request().Context(), "project", p.ID); err == nil {
			comments = cList
		}
	}

	htmlBody := buildProjectDetailEmailHTML(p, comments, req.Note)

	if err := h.smtpSvc.SendEmail(smtpCfg, toEmails, nil, subject, htmlBody); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Gagal mengirim email: "+err.Error())
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"message":    fmt.Sprintf("Email berhasil dikirim ke %d penerima (%s)", len(toEmails), toEmails[0]),
		"recipients": toEmails,
	})
}

// ponytail: PreviewEmail returns the rendered HTML email or JSON for preview
func (h *ProjectHandler) PreviewEmail(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid project id")
	}

	p, err := h.repo.GetByID(c.Request().Context(), id)
	if err != nil || p == nil {
		return echo.NewHTTPError(http.StatusNotFound, "task not found")
	}

	var comments []model.Comment
	if h.commentRepo != nil {
		if cList, err := h.commentRepo.ListByEntity(c.Request().Context(), "project", p.ID); err == nil {
			comments = cList
		}
	}

	senderNote := c.QueryParam("note")
	htmlBody := buildProjectDetailEmailHTML(p, comments, senderNote)

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

	if c.QueryParam("format") == "json" {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"subject": subject,
			"html":    htmlBody,
		})
	}

	return c.HTML(http.StatusOK, htmlBody)
}
