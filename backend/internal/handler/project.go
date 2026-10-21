package handler

import (
	"encoding/json"
	"net/http"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"

	"pe-portal/internal/middleware"
	"pe-portal/internal/model"
	"pe-portal/internal/repository"
)

type ProjectHandler struct {
	repo *repository.ProjectRepository
}

func NewProjectHandler(repo *repository.ProjectRepository) *ProjectHandler {
	return &ProjectHandler{repo: repo}
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
	Priority       string          `json:"priority"`
	GroupPartID    *uuid.UUID      `json:"group_part_id"`
	StartDate      *string         `json:"start_date"`
	TargetDate     *string         `json:"target_date"`
	CompletionDate *string         `json:"completion_date"`
	Progress       int             `json:"progress"`
	Metadata       json.RawMessage `json:"metadata"`
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
	if uidVal := c.Get(middleware.ContextKeyUserID); uidVal != nil {
		if uid, ok := uidVal.(uuid.UUID); ok {
			ownerID = &uid
		}
	}

	p := model.Project{
		Title:       req.Title,
		Description: req.Description,
		ProjectType: req.ProjectType,
		Status:      "planning",
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
		Priority:       req.Priority,
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

// GetGbaTasks proxies GBA task manager kanban data from project_manager app (view only)
func (h *ProjectHandler) GetGbaTasks(c echo.Context) error {
	apiURL := os.Getenv("GBA_API_URL")
	if apiURL == "" {
		apiURL = "http://172.17.0.1:8089/api_kanban.php"
	}

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(apiURL)
	if err != nil {
		// Fallback for host/localhost execution
		resp, err = client.Get("http://localhost:8089/api_kanban.php")
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
