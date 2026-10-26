package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"

	"pe-portal/internal/auth"
	"pe-portal/internal/middleware"
	"pe-portal/internal/model"
	"pe-portal/internal/repository"
	"pe-portal/internal/service"
)

type DocumentHandler struct {
	repo        *repository.DocumentRepository
	storagePath string
	jwtService  *auth.JWTService
	datahub     *service.DataHubService
}

func NewDocumentHandler(repo *repository.DocumentRepository, storagePath string, jwtService *auth.JWTService, datahub *service.DataHubService) *DocumentHandler {
	_ = os.MkdirAll(storagePath, 0755)
	if datahub == nil {
		datahub = service.NewDataHubService(nil)
	}
	return &DocumentHandler{repo: repo, storagePath: storagePath, jwtService: jwtService, datahub: datahub}
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

	uploadToDatahub := c.FormValue("upload_to_datahub") == "true" || c.FormValue("upload_to_datahub") == "1"
	datahubStatus := "skipped"
	if uploadToDatahub {
		datahubStatus = "pending"
	}

	doc := model.Document{
		ID:            docID,
		Title:         title,
		FileName:      file.Filename,
		FilePath:      dstPath,
		FileSize:      file.Size,
		MimeType:      mimeType,
		FileType:      fileType,
		Category:      &category,
		Tags:          json.RawMessage("[]"),
		UploadedBy:    uploaderID,
		GroupPartID:   groupID,
		ProjectID:     projectID,
		ModelID:       modelID,
		DataHubStatus: datahubStatus,
	}

	created, err := h.repo.Create(c.Request().Context(), &doc)
	if err != nil {
		_ = os.Remove(dstPath)
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	// Ingest to DataHub if user opted in
	if uploadToDatahub && h.datahub != nil {
		fReader, openErr := os.Open(dstPath)
		if openErr == nil {
			defer fReader.Close()

			var pii *bool
			if piiStr := c.FormValue("datahub_pii"); piiStr != "" {
				b := piiStr == "true"
				pii = &b
			}

			var tags []string
			if tagsStr := c.FormValue("datahub_tags"); tagsStr != "" {
				for _, t := range strings.Split(tagsStr, ",") {
					if trimmed := strings.TrimSpace(t); trimmed != "" {
						tags = append(tags, trimmed)
					}
				}
			}

			params := service.DataHubIngestParams{
				ProjectID:     c.FormValue("datahub_project_id"),
				FolderID:      c.FormValue("datahub_folder_id"),
				Title:         created.Title,
				Description:   c.FormValue("datahub_description"),
				Tags:          tags,
				Overwrite:     c.FormValue("datahub_overwrite") != "false",
				ParsingYN:     c.FormValue("datahub_parsing") != "false",
				PIITagEnabled: pii,
				OCREnabled:    c.FormValue("datahub_ocr") == "true",
			}

			res, dhErr := h.datahub.IngestObject(c.Request().Context(), fReader, created.FileName, params, "")
			if dhErr != nil && strings.Contains(dhErr.Error(), "DRM_ENCRYPTED_FILE") && params.ParsingYN {
				log.Printf("[DataHub] Ingest rejected with DRM_ENCRYPTED_FILE. Retrying without parsing (raw storage)...")
				params.ParsingYN = false
				params.PIITagEnabled = nil
				if retryFile, oErr := os.Open(created.FilePath); oErr == nil {
					defer retryFile.Close()
					res, dhErr = h.datahub.IngestObject(c.Request().Context(), retryFile, created.FileName, params, "")
				}
			}
			if dhErr != nil {
				errMsg := dhErr.Error()
				log.Printf("[DataHub] Ingest failed: %v", errMsg)
				status := "failed"
				_ = h.repo.UpdateDataHubStatus(c.Request().Context(), created.ID, status, nil, nil, &errMsg)
				created.DataHubStatus = status
				created.DataHubError = &errMsg
			} else {
				status := "synced"
				now := time.Now()
				_ = h.repo.UpdateDataHubStatus(c.Request().Context(), created.ID, status, &res.ObjectID, &now, nil)
				created.DataHubStatus = status
				created.DataHubObjectID = &res.ObjectID
				created.DataHubSyncedAt = &now
				created.DataHubError = nil
			}
		}
	}

	return c.JSON(http.StatusCreated, created)
}

func (h *DocumentHandler) SyncToDataHub(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid document id")
	}

	doc, err := h.repo.GetByID(c.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "document not found")
	}

	fReader, err := os.Open(doc.FilePath)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "document file is not accessible on disk")
	}
	defer fReader.Close()

	projectID := c.FormValue("datahub_project_id")
	if projectID == "" {
		projectID = c.QueryParam("project_id")
	}
	folderID := c.FormValue("datahub_folder_id")
	if folderID == "" {
		folderID = c.QueryParam("folder_id")
	}

	var pii *bool
	if piiStr := c.FormValue("datahub_pii"); piiStr != "" {
		b := piiStr == "true"
		pii = &b
	}

	parsingYN := true
	if pStr := c.FormValue("datahub_parsing"); pStr != "" {
		parsingYN = pStr != "false"
	}

	params := service.DataHubIngestParams{
		ProjectID:     projectID,
		FolderID:      folderID,
		Title:         doc.Title,
		Overwrite:     c.FormValue("datahub_overwrite") != "false",
		ParsingYN:     parsingYN,
		PIITagEnabled: pii,
		OCREnabled:    c.FormValue("datahub_ocr") == "true",
	}

	res, dhErr := h.datahub.IngestObject(c.Request().Context(), fReader, doc.FileName, params, "")
	if dhErr != nil && strings.Contains(dhErr.Error(), "DRM_ENCRYPTED_FILE") && params.ParsingYN {
		log.Printf("[DataHub] Ingest rejected with DRM_ENCRYPTED_FILE. Retrying without parsing (raw storage)...")
		params.ParsingYN = false
		params.PIITagEnabled = nil
		if retryFile, oErr := os.Open(doc.FilePath); oErr == nil {
			defer retryFile.Close()
			res, dhErr = h.datahub.IngestObject(c.Request().Context(), retryFile, doc.FileName, params, "")
		}
	}
	if dhErr != nil {
		errMsg := dhErr.Error()
		status := "failed"
		_ = h.repo.UpdateDataHubStatus(c.Request().Context(), doc.ID, status, nil, nil, &errMsg)
		doc.DataHubStatus = status
		doc.DataHubError = &errMsg
		return c.JSON(http.StatusOK, map[string]interface{}{
			"success":  false,
			"message":  errMsg,
			"document": doc,
		})
	}

	status := "synced"
	now := time.Now()
	_ = h.repo.UpdateDataHubStatus(c.Request().Context(), doc.ID, status, &res.ObjectID, &now, nil)
	doc.DataHubStatus = status
	doc.DataHubObjectID = &res.ObjectID
	doc.DataHubSyncedAt = &now
	doc.DataHubError = nil

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":  true,
		"message":  "Successfully synced to DataHub",
		"document": doc,
	})
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

// CreateOrUpdateShare handles creating or updating a document share rule
func (h *DocumentHandler) CreateOrUpdateShare(c echo.Context) error {
	docID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid document id")
	}

	var req model.CreateShareRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	var userID *uuid.UUID
	if uidVal := c.Get(middleware.ContextKeyUserID); uidVal != nil {
		if uid, ok := uidVal.(uuid.UUID); ok {
			userID = &uid
		}
	}

	share, err := h.repo.CreateOrUpdateShare(c.Request().Context(), docID, &req, userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, share)
}

// GetShare gets the current share configuration of a document
func (h *DocumentHandler) GetShare(c echo.Context) error {
	docID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid document id")
	}

	share, err := h.repo.GetShareByDocID(c.Request().Context(), docID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if share == nil {
		return c.JSON(http.StatusOK, map[string]interface{}{"share": nil})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"share": share})
}

// RevokeShare deletes the share configuration
func (h *DocumentHandler) RevokeShare(c echo.Context) error {
	docID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid document id")
	}

	if err := h.repo.RevokeShare(c.Request().Context(), docID); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, map[string]string{"message": "link sharing berhasil dinonaktifkan"})
}

// GetPublicShare returns share & document public info by token
func (h *DocumentHandler) GetPublicShare(c echo.Context) error {
	token := c.Param("token")
	if token == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "token required")
	}

	share, err := h.repo.GetShareByToken(c.Request().Context(), token)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, err.Error())
	}

	return c.JSON(http.StatusOK, share)
}

// VerifySharePassword verifies a password for password-protected share
func (h *DocumentHandler) VerifySharePassword(c echo.Context) error {
	token := c.Param("token")
	var req model.VerifySharePasswordRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request")
	}

	valid, err := h.repo.VerifySharePassword(c.Request().Context(), token, req.Password)
	if err != nil || !valid {
		return echo.NewHTTPError(http.StatusUnauthorized, map[string]interface{}{
			"valid":   false,
			"message": "Password salah. Silakan coba lagi.",
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"valid":   true,
		"message": "Password diverifikasi",
	})
}

// checkShareAccess validates whether the caller can download/preview the shared document
func (h *DocumentHandler) checkShareAccess(c echo.Context, share *model.DocumentShare) error {
	switch share.AccessRule {
	case "public":
		return nil

	case "login_required":
		tokenStr := ""
		authHeader := c.Request().Header.Get("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") {
			tokenStr = strings.TrimPrefix(authHeader, "Bearer ")
		} else if qToken := c.QueryParam("token"); qToken != "" {
			tokenStr = qToken
		}

		if tokenStr == "" || h.jwtService == nil {
			return echo.NewHTTPError(http.StatusUnauthorized, map[string]interface{}{
				"error":   "login_required",
				"message": "Login diperlukan untuk mengakses dokumen ini.",
			})
		}

		_, err := h.jwtService.ValidateToken(tokenStr)
		if err != nil {
			return echo.NewHTTPError(http.StatusUnauthorized, map[string]interface{}{
				"error":   "login_required",
				"message": "Sesi Anda telah kedaluwarsa atau belum login.",
			})
		}
		return nil

	case "password":
		pwd := c.Request().Header.Get("X-Share-Password")
		if pwd == "" {
			pwd = c.QueryParam("password")
		}

		if pwd == "" {
			return echo.NewHTTPError(http.StatusUnauthorized, map[string]interface{}{
				"error":   "password_required",
				"message": "Password diperlukan untuk mengakses file ini.",
			})
		}

		valid, err := h.repo.VerifySharePassword(c.Request().Context(), share.ShareToken, pwd)
		if err != nil || !valid {
			return echo.NewHTTPError(http.StatusUnauthorized, map[string]interface{}{
				"error":   "invalid_password",
				"message": "Password yang Anda masukkan salah.",
			})
		}
		return nil

	default:
		return nil
	}
}

// DownloadSharedFile streams download for shared document
func (h *DocumentHandler) DownloadSharedFile(c echo.Context) error {
	token := c.Param("token")
	share, err := h.repo.GetShareByToken(c.Request().Context(), token)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, err.Error())
	}

	if !share.AllowDownload {
		return echo.NewHTTPError(http.StatusForbidden, "Unduhan dinonaktifkan untuk file ini.")
	}

	if err := h.checkShareAccess(c, share); err != nil {
		return err
	}

	_ = h.repo.IncrementShareDownload(c.Request().Context(), token)
	return c.Attachment(share.Document.FilePath, share.Document.FileName)
}

// PreviewSharedFile streams preview for shared document
func (h *DocumentHandler) PreviewSharedFile(c echo.Context) error {
	token := c.Param("token")
	share, err := h.repo.GetShareByToken(c.Request().Context(), token)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, err.Error())
	}

	if err := h.checkShareAccess(c, share); err != nil {
		return err
	}

	return c.File(share.Document.FilePath)
}
