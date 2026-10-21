package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"

	"pe-portal/internal/middleware"
	"pe-portal/internal/model"
	"pe-portal/internal/repository"
)

type InnovationHandler struct {
	repo *repository.InnovationRepository
}

func NewInnovationHandler(repo *repository.InnovationRepository) *InnovationHandler {
	return &InnovationHandler{repo: repo}
}

func (h *InnovationHandler) List(c echo.Context) error {
	category := c.QueryParam("category")
	status := c.QueryParam("status")
	classType := c.QueryParam("class_type")
	var groupID *uuid.UUID
	if gStr := c.QueryParam("group_id"); gStr != "" {
		if id, err := uuid.Parse(gStr); err == nil {
			groupID = &id
		}
	}

	items, err := h.repo.List(c.Request().Context(), category, status, classType, groupID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, items)
}

func (h *InnovationHandler) GetStats(c echo.Context) error {
	year := time.Now().Year()
	if yStr := c.QueryParam("year"); yStr != "" {
		if parsed, err := strconv.Atoi(yStr); err == nil && parsed > 2000 {
			year = parsed
		}
	}

	stats, err := h.repo.GetStats(c.Request().Context(), year)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, stats)
}

type SaveTargetRequest struct {
	Year            int `json:"year"`
	Month           int `json:"month"`
	TargetRegister  int `json:"target_register"`
	TargetChallenge int `json:"target_challenge"`
}

func (h *InnovationHandler) SaveTarget(c echo.Context) error {
	var req SaveTargetRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid target input")
	}
	if req.Year <= 2000 || req.Month < 1 || req.Month > 12 {
		return echo.NewHTTPError(http.StatusBadRequest, "year and month (1-12) are required")
	}

	if err := h.repo.SaveTarget(c.Request().Context(), req.Year, req.Month, req.TargetRegister, req.TargetChallenge); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "monthly target updated successfully"})
}

func (h *InnovationHandler) Get(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid innovation id")
	}

	item, err := h.repo.GetByID(c.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "innovation not found")
	}
	return c.JSON(http.StatusOK, item)
}

type CreateInnovationRequest struct {
	Title       string          `json:"title"`
	Description *string         `json:"description"`
	Category    string          `json:"category"`   // innovation, best_practice
	ClassType   string          `json:"class_type"` // Class 3, Class 4, Class 5, Non Adopt, Under Review
	GroupPartID *uuid.UUID      `json:"group_part_id"`
	ImpactScore *int            `json:"impact_score"`
	Attachments json.RawMessage `json:"attachments"`
}

func (h *InnovationHandler) Create(c echo.Context) error {
	var req CreateInnovationRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid input")
	}

	if req.Title == "" || req.Category == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "title and category are required")
	}

	if req.ClassType == "" {
		req.ClassType = "Class 4"
	}

	var authorID *uuid.UUID
	if uidVal := c.Get(middleware.ContextKeyUserID); uidVal != nil {
		if uid, ok := uidVal.(uuid.UUID); ok {
			authorID = &uid
		}
	}

	item := model.Innovation{
		Title:       req.Title,
		Description: req.Description,
		Category:    req.Category,
		ClassType:   req.ClassType,
		Status:      "draft",
		AuthorID:    authorID,
		GroupPartID: req.GroupPartID,
		ImpactScore: req.ImpactScore,
		Attachments: req.Attachments,
	}

	created, err := h.repo.Create(c.Request().Context(), &item)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusCreated, created)
}

func (h *InnovationHandler) Update(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid innovation id")
	}

	var req CreateInnovationRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid input")
	}

	if req.ClassType == "" {
		req.ClassType = "Class 4"
	}

	item := model.Innovation{
		ID:          id,
		Title:       req.Title,
		Description: req.Description,
		Category:    req.Category,
		ClassType:   req.ClassType,
		GroupPartID: req.GroupPartID,
		ImpactScore: req.ImpactScore,
		Attachments: req.Attachments,
	}

	updated, err := h.repo.Update(c.Request().Context(), &item)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, updated)
}

func (h *InnovationHandler) UpdateStatus(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid innovation id")
	}

	var req struct {
		Status string `json:"status"`
	}
	if err := c.Bind(&req); err != nil || req.Status == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "status is required")
	}

	if err := h.repo.UpdateStatus(c.Request().Context(), id, req.Status); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "status updated successfully"})
}

func (h *InnovationHandler) Delete(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid innovation id")
	}

	if err := h.repo.Delete(c.Request().Context(), id); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "deleted successfully"})
}
