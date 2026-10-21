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

type ImeiHandler struct {
	repo *repository.ImeiRepository
}

func NewImeiHandler(repo *repository.ImeiRepository) *ImeiHandler {
	return &ImeiHandler{repo: repo}
}

func (h *ImeiHandler) List(c echo.Context) error {
	var modelID, projectID *uuid.UUID
	if mStr := c.QueryParam("model_id"); mStr != "" {
		if id, err := uuid.Parse(mStr); err == nil {
			modelID = &id
		}
	}
	if pStr := c.QueryParam("project_id"); pStr != "" {
		if id, err := uuid.Parse(pStr); err == nil {
			projectID = &id
		}
	}
	search := c.QueryParam("search")

	articles, err := h.repo.List(c.Request().Context(), modelID, projectID, search)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, articles)
}

func (h *ImeiHandler) Get(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid article id")
	}

	a, err := h.repo.GetByID(c.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "article not found")
	}
	return c.JSON(http.StatusOK, a)
}

type CreateImeiRequest struct {
	Title     string          `json:"title"`
	Content   string          `json:"content"`
	ModelID   *uuid.UUID      `json:"model_id"`
	ProjectID *uuid.UUID      `json:"project_id"`
	Tags      json.RawMessage `json:"tags"`
	IsPinned  bool            `json:"is_pinned"`
}

func (h *ImeiHandler) Create(c echo.Context) error {
	var req CreateImeiRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid input")
	}

	if req.Title == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "title is required")
	}

	var authorID *uuid.UUID
	if uidVal := c.Get(middleware.ContextKeyUserID); uidVal != nil {
		if uid, ok := uidVal.(uuid.UUID); ok {
			authorID = &uid
		}
	}

	a := model.ImeiArticle{
		Title:     req.Title,
		Content:   req.Content,
		ModelID:   req.ModelID,
		ProjectID: req.ProjectID,
		AuthorID:  authorID,
		Tags:      req.Tags,
		IsPinned:  req.IsPinned,
	}

	created, err := h.repo.Create(c.Request().Context(), &a)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusCreated, created)
}

func (h *ImeiHandler) Update(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid article id")
	}

	var req CreateImeiRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid input")
	}

	a := model.ImeiArticle{
		ID:        id,
		Title:     req.Title,
		Content:   req.Content,
		ModelID:   req.ModelID,
		ProjectID: req.ProjectID,
		Tags:      req.Tags,
		IsPinned:  req.IsPinned,
	}

	updated, err := h.repo.Update(c.Request().Context(), &a)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, updated)
}

func (h *ImeiHandler) Delete(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid article id")
	}

	if err := h.repo.Delete(c.Request().Context(), id); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "deleted successfully"})
}
