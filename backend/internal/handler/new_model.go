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

type NewModelHandler struct {
	repo *repository.NewModelRepository
}

func NewNewModelHandler(repo *repository.NewModelRepository) *NewModelHandler {
	return &NewModelHandler{repo: repo}
}

func (h *NewModelHandler) List(c echo.Context) error {
	stage := c.QueryParam("stage")
	models, err := h.repo.List(c.Request().Context(), stage)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, models)
}

func (h *NewModelHandler) Get(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid model id")
	}

	m, err := h.repo.GetByID(c.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "model not found")
	}
	return c.JSON(http.StatusOK, m)
}

type CreateModelRequest struct {
	ModelName      string          `json:"model_name"`
	Codename       *string         `json:"codename"`
	Stage          string          `json:"stage"`
	Description    *string         `json:"description"`
	ProjectID      *uuid.UUID      `json:"project_id"`
	TargetRelease  *string         `json:"target_release"`
	Specifications json.RawMessage `json:"specifications"`
}

func (h *NewModelHandler) Create(c echo.Context) error {
	var req CreateModelRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid input")
	}

	if req.ModelName == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "model_name is required")
	}

	var ownerID *uuid.UUID
	if uidVal := c.Get(middleware.ContextKeyUserID); uidVal != nil {
		if uid, ok := uidVal.(uuid.UUID); ok {
			ownerID = &uid
		}
	}

	m := model.NewModel{
		ModelName:      req.ModelName,
		Codename:       req.Codename,
		Stage:          req.Stage,
		Description:    req.Description,
		ProjectID:      req.ProjectID,
		OwnerID:        ownerID,
		TargetRelease:  req.TargetRelease,
		Specifications: req.Specifications,
	}

	created, err := h.repo.Create(c.Request().Context(), &m)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusCreated, created)
}

func (h *NewModelHandler) Update(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid model id")
	}

	var req CreateModelRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid input")
	}

	m := model.NewModel{
		ID:             id,
		ModelName:      req.ModelName,
		Codename:       req.Codename,
		Description:    req.Description,
		ProjectID:      req.ProjectID,
		TargetRelease:  req.TargetRelease,
		Specifications: req.Specifications,
	}

	updated, err := h.repo.Update(c.Request().Context(), &m)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, updated)
}

func (h *NewModelHandler) ListStages(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid model id")
	}

	stages, err := h.repo.ListStages(c.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, stages)
}

type AdvanceStageRequest struct {
	Stage       string          `json:"stage"`
	Notes       string          `json:"notes"`
	Attachments json.RawMessage `json:"attachments"`
	Advance     *bool           `json:"advance"` // If false, do NOT advance stage, just update notes & attachments
}

func (h *NewModelHandler) AdvanceStage(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid model id")
	}

	existing, err := h.repo.GetByID(c.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "model not found")
	}

	var currentUserID uuid.UUID
	if uidVal := c.Get(middleware.ContextKeyUserID); uidVal != nil {
		if uid, ok := uidVal.(uuid.UUID); ok {
			currentUserID = uid
		}
	}
	role := ""
	if roleVal := c.Get(middleware.ContextKeyUserRole); roleVal != nil {
		if r, ok := roleVal.(string); ok {
			role = r
		}
	}
	isAuthorized := role == "admin" || role == "manager" || (existing.OwnerID != nil && *existing.OwnerID == currentUserID)
	if !isAuthorized {
		return echo.NewHTTPError(http.StatusForbidden, "you are not authorized to update or advance stage for this model")
	}

	var req AdvanceStageRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid input")
	}

	var approverID *uuid.UUID
	if currentUserID != uuid.Nil {
		approverID = &currentUserID
	}

	// If advance is explicitly false, update current stage notes and attachments without advancing
	if req.Advance != nil && !*req.Advance {
		if err := h.repo.UpdateCurrentStage(c.Request().Context(), id, req.Notes, req.Attachments, approverID); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
		}
		return c.JSON(http.StatusOK, map[string]string{"message": "stage data updated successfully without advancing"})
	}

	// Advance stage
	if req.Stage == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "stage is required to advance")
	}
	if err := h.repo.AdvanceStage(c.Request().Context(), id, req.Stage, req.Notes, req.Attachments, approverID); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "stage advanced successfully"})
}

func (h *NewModelHandler) UpdateStage(c echo.Context) error {
	stageID, err := uuid.Parse(c.Param("stageId"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid stage id")
	}

	var req AdvanceStageRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid input")
	}

	var approverID *uuid.UUID
	if uidVal := c.Get(middleware.ContextKeyUserID); uidVal != nil {
		if uid, ok := uidVal.(uuid.UUID); ok {
			approverID = &uid
		}
	}

	if err := h.repo.UpdateStageByID(c.Request().Context(), stageID, req.Notes, req.Attachments, approverID); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "stage updated successfully"})
}

func (h *NewModelHandler) Delete(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid model id")
	}

	existing, err := h.repo.GetByID(c.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "model not found")
	}

	var currentUserID uuid.UUID
	if uidVal := c.Get(middleware.ContextKeyUserID); uidVal != nil {
		if uid, ok := uidVal.(uuid.UUID); ok {
			currentUserID = uid
		}
	}
	role := ""
	if roleVal := c.Get(middleware.ContextKeyUserRole); roleVal != nil {
		if r, ok := roleVal.(string); ok {
			role = r
		}
	}
	isAuthorized := role == "admin" || role == "manager" || (existing.OwnerID != nil && *existing.OwnerID == currentUserID)
	if !isAuthorized {
		return echo.NewHTTPError(http.StatusForbidden, "you are not authorized to delete this model")
	}

	if err := h.repo.Delete(c.Request().Context(), id); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "deleted successfully"})
}
