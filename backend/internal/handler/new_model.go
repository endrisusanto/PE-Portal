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
	MarketingName  *string         `json:"marketing_name"`
	Codename       *string         `json:"codename"`
	BasicModels    json.RawMessage `json:"basic_models"`
	Stage          string          `json:"stage"`
	Description    *string         `json:"description"`
	ProjectID      *uuid.UUID      `json:"project_id"`
	OwnerID        *uuid.UUID      `json:"owner_id"`
	PICIDs         []uuid.UUID     `json:"pic_ids"`
	TargetRelease  *string         `json:"target_release"`
	Specifications json.RawMessage `json:"specifications"`
	IsActive       *bool           `json:"is_active"`
	SortOrder      *int            `json:"sort_order"`
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
	if req.OwnerID != nil {
		ownerID = req.OwnerID
	} else if len(req.PICIDs) > 0 {
		ownerID = &req.PICIDs[0]
	} else if uidVal := c.Get(middleware.ContextKeyUserID); uidVal != nil {
		if uid, ok := uidVal.(uuid.UUID); ok && uid != uuid.Nil {
			ownerID = &uid
		}
	}

	picIDs := req.PICIDs
	if len(picIDs) == 0 && ownerID != nil {
		picIDs = []uuid.UUID{*ownerID}
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}
	sortOrder := 0
	if req.SortOrder != nil {
		sortOrder = *req.SortOrder
	}

	m := model.NewModel{
		ModelName:      req.ModelName,
		MarketingName:  req.MarketingName,
		Codename:       req.Codename,
		BasicModels:    req.BasicModels,
		Stage:          req.Stage,
		Description:    req.Description,
		ProjectID:      req.ProjectID,
		OwnerID:        ownerID,
		PICIDs:         picIDs,
		TargetRelease:  req.TargetRelease,
		Specifications: req.Specifications,
		IsActive:       isActive,
		SortOrder:      sortOrder,
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

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}
	sortOrder := 0
	if req.SortOrder != nil {
		sortOrder = *req.SortOrder
	}

	m := model.NewModel{
		ID:             id,
		ModelName:      req.ModelName,
		MarketingName:  req.MarketingName,
		Codename:       req.Codename,
		BasicModels:    req.BasicModels,
		Stage:          req.Stage,
		Description:    req.Description,
		ProjectID:      req.ProjectID,
		OwnerID:        req.OwnerID,
		PICIDs:         req.PICIDs,
		TargetRelease:  req.TargetRelease,
		Specifications: req.Specifications,
		IsActive:       isActive,
		SortOrder:      sortOrder,
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

// ListSchedule returns all scheduled milestones across all new models for calendar view
func (h *NewModelHandler) ListSchedule(c echo.Context) error {
	milestones, err := h.repo.ListScheduledMilestones(c.Request().Context())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, milestones)
}

// ListMilestones returns all milestones for a model
func (h *NewModelHandler) ListMilestones(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid model id")
	}

	milestones, err := h.repo.ListMilestones(c.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, milestones)
}

// UpsertMilestone updates or creates a single milestone entry
func (h *NewModelHandler) UpsertMilestone(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid model id")
	}

	var req model.NewModelMilestone
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid input")
	}
	req.ModelID = id

	if uidVal := c.Get(middleware.ContextKeyUserID); uidVal != nil {
		if uid, ok := uidVal.(uuid.UUID); ok {
			req.UpdatedBy = &uid
		}
	}

	if err := h.repo.UpsertMilestone(c.Request().Context(), &req); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "milestone updated successfully"})
}

type BatchMilestonesRequest struct {
	Milestones []model.NewModelMilestone `json:"milestones"`
}

// BatchUpsertMilestones updates multiple milestones for a model
func (h *NewModelHandler) BatchUpsertMilestones(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid model id")
	}

	var req BatchMilestonesRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid input")
	}

	var currentUserID *uuid.UUID
	if uidVal := c.Get(middleware.ContextKeyUserID); uidVal != nil {
		if uid, ok := uidVal.(uuid.UUID); ok {
			currentUserID = &uid
		}
	}

	if err := h.repo.BatchUpsertMilestones(c.Request().Context(), id, req.Milestones, currentUserID); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	milestones, _ := h.repo.ListMilestones(c.Request().Context(), id)
	return c.JSON(http.StatusOK, milestones)
}
