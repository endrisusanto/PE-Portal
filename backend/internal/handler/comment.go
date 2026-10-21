package handler

import (
	"net/http"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"

	"pe-portal/internal/middleware"
	"pe-portal/internal/model"
	"pe-portal/internal/repository"
)

type CommentHandler struct {
	repo *repository.CommentRepository
}

func NewCommentHandler(repo *repository.CommentRepository) *CommentHandler {
	return &CommentHandler{repo: repo}
}

func (h *CommentHandler) List(c echo.Context) error {
	entityType := c.QueryParam("entity_type")
	entityIDStr := c.QueryParam("entity_id")

	if entityType == "" || entityIDStr == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "entity_type and entity_id are required")
	}

	entityID, err := uuid.Parse(entityIDStr)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid entity_id")
	}

	comments, err := h.repo.ListByEntity(c.Request().Context(), entityType, entityID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, comments)
}

type CreateCommentRequest struct {
	Content    string     `json:"content"`
	EntityType string     `json:"entity_type"`
	EntityID   uuid.UUID  `json:"entity_id"`
	ParentID   *uuid.UUID `json:"parent_id"`
}

func (h *CommentHandler) Create(c echo.Context) error {
	var req CreateCommentRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid input")
	}

	if req.Content == "" || req.EntityType == "" || req.EntityID == uuid.Nil {
		return echo.NewHTTPError(http.StatusBadRequest, "content, entity_type, and entity_id are required")
	}

	var authorID *uuid.UUID
	if uidVal := c.Get(middleware.ContextKeyUserID); uidVal != nil {
		if uid, ok := uidVal.(uuid.UUID); ok {
			authorID = &uid
		}
	}

	comment := model.Comment{
		Content:    req.Content,
		EntityType: req.EntityType,
		EntityID:   req.EntityID,
		AuthorID:   authorID,
		ParentID:   req.ParentID,
	}

	created, err := h.repo.Create(c.Request().Context(), &comment)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusCreated, created)
}

type ReactionRequest struct {
	Emoji string `json:"emoji"`
}

func (h *CommentHandler) ToggleReaction(c echo.Context) error {
	commentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid comment id")
	}

	var req ReactionRequest
	if err := c.Bind(&req); err != nil || req.Emoji == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "emoji is required")
	}

	userIDVal := c.Get(middleware.ContextKeyUserID)
	if userIDVal == nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "unauthenticated")
	}
	userID := userIDVal.(uuid.UUID)

	if err := h.repo.ToggleReaction(c.Request().Context(), commentID, userID, req.Emoji); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "reaction toggled"})
}

func (h *CommentHandler) Delete(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid comment id")
	}

	if err := h.repo.Delete(c.Request().Context(), id); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "deleted successfully"})
}
