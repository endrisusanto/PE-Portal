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

type ArticleHandler struct {
	repo *repository.ArticleRepository
}

func NewArticleHandler(repo *repository.ArticleRepository) *ArticleHandler {
	return &ArticleHandler{repo: repo}
}

// Backward compatibility alias
type ImeiHandler = ArticleHandler

func NewImeiHandler(repo *repository.ImeiRepository) *ImeiHandler {
	return NewArticleHandler(repo)
}

func (h *ArticleHandler) List(c echo.Context) error {
	var modelID, projectID, authorID *uuid.UUID
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
	if aStr := c.QueryParam("author_id"); aStr != "" {
		if id, err := uuid.Parse(aStr); err == nil {
			authorID = &id
		}
	}
	search := c.QueryParam("search")

	var viewerID *uuid.UUID
	isAdmin := false
	if uidVal := c.Get(middleware.ContextKeyUserID); uidVal != nil {
		if uid, ok := uidVal.(uuid.UUID); ok {
			viewerID = &uid
		}
	}
	if roleVal := c.Get(middleware.ContextKeyUserRole); roleVal != nil {
		if r, ok := roleVal.(string); ok && (r == "admin" || r == "manager") {
			isAdmin = true
		}
	}

	articles, err := h.repo.List(c.Request().Context(), modelID, projectID, authorID, search, viewerID, isAdmin)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, articles)
}

func (h *ArticleHandler) Get(c echo.Context) error {
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

type CreateArticleRequest struct {
	Title     string          `json:"title"`
	Content   string          `json:"content"`
	ModelID   *uuid.UUID      `json:"model_id"`
	ProjectID *uuid.UUID      `json:"project_id"`
	Tags      json.RawMessage `json:"tags"`
	IsPinned  bool            `json:"is_pinned"`
	Status    string          `json:"status"` // 'published' | 'draft'
}

// Backward compatibility alias
type CreateImeiRequest = CreateArticleRequest

func (h *ArticleHandler) Create(c echo.Context) error {
	var req CreateArticleRequest
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

	status := req.Status
	if status == "" {
		status = "published"
	}

	a := model.ImeiArticle{
		Title:     req.Title,
		Content:   req.Content,
		ModelID:   req.ModelID,
		ProjectID: req.ProjectID,
		AuthorID:  authorID,
		Tags:      req.Tags,
		IsPinned:  req.IsPinned,
		Status:    status,
	}

	created, err := h.repo.Create(c.Request().Context(), &a)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusCreated, created)
}

func (h *ArticleHandler) Update(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid article id")
	}

	existing, err := h.repo.GetByID(c.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "article not found")
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
	isAuthorized := role == "admin" || role == "manager" || (existing.AuthorID != nil && *existing.AuthorID == currentUserID)
	if !isAuthorized {
		return echo.NewHTTPError(http.StatusForbidden, "you are not authorized to update this article")
	}

	var req CreateArticleRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid input")
	}

	status := req.Status
	if status == "" {
		status = existing.Status
	}
	if status == "" {
		status = "published"
	}

	a := model.ImeiArticle{
		ID:        id,
		Title:     req.Title,
		Content:   req.Content,
		ModelID:   req.ModelID,
		ProjectID: req.ProjectID,
		Tags:      req.Tags,
		IsPinned:  req.IsPinned,
		Status:    status,
	}

	updated, err := h.repo.Update(c.Request().Context(), &a)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, updated)
}

func (h *ArticleHandler) Delete(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid article id")
	}

	existing, err := h.repo.GetByID(c.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "article not found")
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
	isAuthorized := role == "admin" || role == "manager" || (existing.AuthorID != nil && *existing.AuthorID == currentUserID)
	if !isAuthorized {
		return echo.NewHTTPError(http.StatusForbidden, "you are not authorized to delete this article")
	}

	if err := h.repo.Delete(c.Request().Context(), id); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "deleted successfully"})
}
