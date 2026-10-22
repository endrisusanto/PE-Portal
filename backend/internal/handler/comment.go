package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"

	"pe-portal/internal/middleware"
	"pe-portal/internal/model"
	"pe-portal/internal/repository"
)

type CommentHandler struct {
	repo        *repository.CommentRepository
	storagePath string
}

func NewCommentHandler(repo *repository.CommentRepository, storagePath string) *CommentHandler {
	return &CommentHandler{
		repo:        repo,
		storagePath: storagePath,
	}
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
	Content     string          `json:"content"`
	EntityType  string          `json:"entity_type"`
	EntityID    uuid.UUID       `json:"entity_id"`
	ParentID    *uuid.UUID      `json:"parent_id"`
	Attachments json.RawMessage `json:"attachments"`
}

func (h *CommentHandler) Create(c echo.Context) error {
	var req CreateCommentRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid input")
	}

	if (req.Content == "" && len(req.Attachments) == 0) || req.EntityType == "" || req.EntityID == uuid.Nil {
		return echo.NewHTTPError(http.StatusBadRequest, "content or attachments, entity_type, and entity_id are required")
	}

	var authorID *uuid.UUID
	if uidVal := c.Get(middleware.ContextKeyUserID); uidVal != nil {
		if uid, ok := uidVal.(uuid.UUID); ok {
			authorID = &uid
		}
	}

	comment := model.Comment{
		Content:     req.Content,
		EntityType:  req.EntityType,
		EntityID:    req.EntityID,
		AuthorID:    authorID,
		ParentID:    req.ParentID,
		Attachments: req.Attachments,
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

// UploadAttachment uploads a file to be attached to a comment or milestone task body
func (h *CommentHandler) UploadAttachment(c echo.Context) error {
	file, err := c.FormFile("file")
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "No file provided")
	}

	src, err := file.Open()
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to open uploaded file")
	}
	defer src.Close()

	attachmentsDir := filepath.Join(h.storagePath, "attachments")
	if err := os.MkdirAll(attachmentsDir, 0755); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create attachments folder")
	}

	rawFilename := filepath.Base(file.Filename)
	safeCleanName := strings.ReplaceAll(rawFilename, " ", "_")
	storedName := fmt.Sprintf("%d_%s", time.Now().UnixNano(), safeCleanName)
	dstPath := filepath.Join(attachmentsDir, storedName)

	dst, err := os.Create(dstPath)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create destination file")
	}
	defer dst.Close()

	if _, err := io.Copy(dst, src); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to save file")
	}

	ext := strings.ToLower(filepath.Ext(rawFilename))
	fileType := "file"
	switch ext {
	case ".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".bmp":
		fileType = "image"
	case ".pdf":
		fileType = "pdf"
	case ".xlsx", ".xls", ".csv":
		fileType = "excel"
	case ".doc", ".docx":
		fileType = "word"
	case ".ppt", ".pptx":
		fileType = "presentation"
	case ".zip", ".tar", ".gz", ".7z", ".rar":
		fileType = "archive"
	case ".txt", ".log", ".json", ".sql", ".py", ".go", ".js", ".ts":
		fileType = "code"
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"name": rawFilename,
		"url":  fmt.Sprintf("/api/v1/comments/attachments/%s", storedName),
		"size": file.Size,
		"type": fileType,
	})
}

// ServeAttachment serves public/authenticated attachment files
func (h *CommentHandler) ServeAttachment(c echo.Context) error {
	filename := filepath.Base(c.Param("filename"))
	targetPath := filepath.Clean(filepath.Join(h.storagePath, "attachments", filename))

	if _, err := os.Stat(targetPath); os.IsNotExist(err) {
		return echo.NewHTTPError(http.StatusNotFound, "Attachment file not found")
	}

	return c.File(targetPath)
}

