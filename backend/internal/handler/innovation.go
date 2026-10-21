package handler

import (
	"encoding/json"
	"net/http"

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
	var groupID *uuid.UUID
	if gStr := c.QueryParam("group_id"); gStr != "" {
		if id, err := uuid.Parse(gStr); err == nil {
			groupID = &id
		}
	}

	items, err := h.repo.List(c.Request().Context(), category, status, groupID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, items)
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
	Category    string          `json:"category"` // innovation, best_practice
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

	item := model.Innovation{
		ID:          id,
		Title:       req.Title,
		Description: req.Description,
		Category:    req.Category,
		GroupPartID: req.GroupPartID,
		ImpactScore: req.ImpactScore,
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
