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

type DocumentHandler struct {
	repo        *repository.DocumentRepository
	storagePath string
}

func NewDocumentHandler(repo *repository.DocumentRepository, storagePath string) *DocumentHandler {
	_ = os.MkdirAll(storagePath, 0755)
	return &DocumentHandler{repo: repo, storagePath: storagePath}
}

func (h *DocumentHandler) List(c echo.Context) error {
	fileType := c.QueryParam("file_type")
	category := c.QueryParam("category")
	search := c.QueryParam("search")

	var groupID, projectID, modelID *uuid.UUID
	if gStr := c.QueryParam("group_id"); gStr != "" {
		if id, err := uuid.Parse(gStr); err == nil {
			groupID = &id
		}
	}
	if pStr := c.QueryParam("project_id"); pStr != "" {
		if id, err := uuid.Parse(pStr); err == nil {
			projectID = &id
		}
	}
	if mStr := c.QueryParam("model_id"); mStr != "" {
		if id, err := uuid.Parse(mStr); err == nil {
			modelID = &id
		}
	}

	docs, err := h.repo.List(c.Request().Context(), fileType, category, groupID, projectID, modelID, search)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, docs)
}

func (h *DocumentHandler) Get(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid document id")
	}

	doc, err := h.repo.GetByID(c.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "document not found")
	}
	return c.JSON(http.StatusOK, doc)
}

func (h *DocumentHandler) Upload(c echo.Context) error {
	file, err := c.FormFile("file")
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "no file provided")
	}

	src, err := file.Open()
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to open uploaded file")
	}
	defer src.Close()

	ext := strings.ToLower(filepath.Ext(file.Filename))
	cleanExt := strings.TrimPrefix(ext, ".")
	fileType := getFileType(cleanExt)

	now := time.Now()
	dirRel := filepath.Join(fileType, fmt.Sprintf("%d", now.Year()), fmt.Sprintf("%02d", now.Month()))
	dirFull := filepath.Join(h.storagePath, dirRel)
	_ = os.MkdirAll(dirFull, 0755)

	docID := uuid.New()
	storedFileName := fmt.Sprintf("%s%s", docID.String(), ext)
	dstPath := filepath.Join(dirFull, storedFileName)

	dst, err := os.Create(dstPath)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to write destination file")
	}
	defer dst.Close()

	if _, err := io.Copy(dst, src); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to save file")
	}

	title := c.FormValue("title")
	if title == "" {
		title = file.Filename
	}
	category := c.FormValue("category")

	var groupID, projectID, modelID *uuid.UUID
	if gStr := c.FormValue("group_id"); gStr != "" {
		if id, err := uuid.Parse(gStr); err == nil {
			groupID = &id
		}
	}
	if pStr := c.FormValue("project_id"); pStr != "" {
		if id, err := uuid.Parse(pStr); err == nil {
			projectID = &id
		}
	}
	if mStr := c.FormValue("model_id"); mStr != "" {
		if id, err := uuid.Parse(mStr); err == nil {
			modelID = &id
		}
	}

	var uploaderID *uuid.UUID
	if uidVal := c.Get(middleware.ContextKeyUserID); uidVal != nil {
		if uid, ok := uidVal.(uuid.UUID); ok {
			uploaderID = &uid
		}
	}

	mimeType := file.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}

	doc := model.Document{
		ID:          docID,
		Title:       title,
		FileName:    file.Filename,
		FilePath:    dstPath,
		FileSize:    file.Size,
		MimeType:    mimeType,
		FileType:    fileType,
		Category:    &category,
		Tags:        json.RawMessage("[]"),
		UploadedBy:  uploaderID,
		GroupPartID: groupID,
		ProjectID:   projectID,
		ModelID:     modelID,
	}

	created, err := h.repo.Create(c.Request().Context(), &doc)
	if err != nil {
		_ = os.Remove(dstPath)
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusCreated, created)
}

func (h *DocumentHandler) Download(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid document id")
	}

	doc, err := h.repo.GetByID(c.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "document not found")
	}

	return c.Attachment(doc.FilePath, doc.FileName)
}

func (h *DocumentHandler) Preview(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid document id")
	}

	doc, err := h.repo.GetByID(c.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "document not found")
	}

	return c.File(doc.FilePath)
}

func (h *DocumentHandler) Delete(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid document id")
	}

	if err := h.repo.Delete(c.Request().Context(), id); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "deleted successfully"})
}

func getFileType(ext string) string {
	switch ext {
	case "pdf":
		return "pdf"
	case "docx", "doc":
		return "docx"
	case "xlsx", "xls":
		return "xlsx"
	case "pptx", "ppt":
		return "pptx"
	case "csv":
		return "csv"
	case "txt", "log", "json", "xml", "yaml", "yml", "md":
		return "txt"
	case "png", "jpg", "jpeg", "gif", "svg", "webp":
		return "img"
	default:
		return "bin"
	}
}
