package handler

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
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
	"pe-portal/internal/util"
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
				if retryFile, oErr := os.Open(dstPath); oErr == nil {
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

// GetMarkdown extracts or retrieves cached Markdown representation of a document
func (h *DocumentHandler) GetMarkdown(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid document id")
	}

	doc, err := h.repo.GetByID(c.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "document not found")
	}

	forceRefresh := c.QueryParam("refresh") == "true"

	// Cache directory for extracted markdown
	cacheDir := filepath.Join(h.storagePath, "markdown_cache")
	_ = os.MkdirAll(cacheDir, 0755)
	cacheFile := filepath.Join(cacheDir, fmt.Sprintf("%s.json", id.String()))

	if !forceRefresh {
		if data, err := os.ReadFile(cacheFile); err == nil {
			var cachedRes map[string]interface{}
			if err := json.Unmarshal(data, &cachedRes); err == nil {
				cachedRes["cached"] = true
				return c.JSON(http.StatusOK, cachedRes)
			}
		}
	}

	// Locate doc_to_markdown.py
	scriptPath := filepath.Join("scripts", "doc_to_markdown.py")
	if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
		scriptPath = filepath.Join("backend", "scripts", "doc_to_markdown.py")
		if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
			scriptPath = "/app/scripts/doc_to_markdown.py"
		}
	}

	pythonBin := util.FindPythonExecutable()

	ext := filepath.Ext(doc.FileName)
	if ext == "" {
		ext = filepath.Ext(doc.FilePath)
	}

	cmdArgs := []string{
		scriptPath,
		"--input", doc.FilePath,
		"--title", doc.Title,
		"--type", ext,
	}

	cmd := exec.Command(pythonBin, cmdArgs...)
	cmd.Env = append(os.Environ(),
		"PYTHONIOENCODING=utf-8",
		"PYTHONUTF8=1",
	)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Gagal mengekstrak markdown: %v", err),
			"details": string(output),
		})
	}

	outStr := strings.TrimSpace(string(output))
	startIdx := strings.Index(outStr, "{")
	endIdx := strings.LastIndex(outStr, "}")
	if startIdx >= 0 && endIdx > startIdx {
		jsonStr := outStr[startIdx : endIdx+1]
		var result map[string]interface{}
		if err := json.Unmarshal([]byte(jsonStr), &result); err == nil {
			result["cached"] = false
			result["doc_id"] = id.String()
			_ = os.WriteFile(cacheFile, []byte(jsonStr), 0644)
			return c.JSON(http.StatusOK, result)
		}
	}

	fallbackRes := map[string]interface{}{
		"success":    true,
		"doc_id":     id.String(),
		"title":      doc.Title,
		"pages":      1,
		"word_count": len(strings.Fields(outStr)),
		"markdown":   fmt.Sprintf("# %s\n\n%s", doc.Title, outStr),
		"cached":     false,
	}
	return c.JSON(http.StatusOK, fallbackRes)
}

// GetDataHubView fetches metadata, status, and extracted content from Samsung DataHub for viewing DRM/NASCA-encrypted documents
func (h *DocumentHandler) GetDataHubView(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid document id")
	}

	doc, err := h.repo.GetByID(c.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "document not found")
	}

	if doc.DataHubObjectID == nil || strings.TrimSpace(*doc.DataHubObjectID) == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "dokumen belum di-ingest ke DataHub (tidak memiliki object_id)")
	}

	objData, err := h.datahub.GetObjectDetails(c.Request().Context(), *doc.DataHubObjectID, "")
	if err != nil {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"success":    false,
			"error":      err.Error(),
			"object_id":  *doc.DataHubObjectID,
			"portal_url": "https://datahub.bigdata.samsung.com/",
		})
	}

	// If document was previously auto-retried with parsing_yn=false due to DRM encryption
	if doc.DataHubError != nil && strings.Contains(*doc.DataHubError, "DRM_ENCRYPTED_FILE") {
		pStatus, _ := objData["parse_status"].(string)
		if pStatus == "" || pStatus == "PENDING" {
			objData["parse_status"] = "SKIPPED_DRM"
			objData["drm_protected"] = true
			objData["drm_message"] = "Dokumen dilindungi enkripsi DRM / NASCA internal Samsung. Ekstraksi teks AI otomatis dilewati agar berkas tetap berhasil disimpan di storage DataHub."
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":    true,
		"object_id":  *doc.DataHubObjectID,
		"portal_url": "https://datahub.bigdata.samsung.com/",
		"object":     objData,
	})
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

// ponytail: UpdateCategory allows admin, manager, or uploader to update document category
func (h *DocumentHandler) UpdateCategory(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid document id")
	}

	doc, err := h.repo.GetByID(c.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "document not found")
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

	// Authorized: admin, manager, or original uploader
	isAuthorized := role == "admin" || role == "manager" || (doc.UploadedBy != nil && *doc.UploadedBy == currentUserID)
	if !isAuthorized {
		return echo.NewHTTPError(http.StatusForbidden, "you are not authorized to update this document category")
	}

	var req struct {
		Category string `json:"category"`
	}
	if err := c.Bind(&req); err != nil || strings.TrimSpace(req.Category) == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "category is required")
	}

	updated, err := h.repo.UpdateCategory(c.Request().Context(), id, strings.TrimSpace(req.Category))
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, updated)
}

// ponytail: DownloadZip streams multiple selected documents as a single ZIP archive using standard library archive/zip
func (h *DocumentHandler) DownloadZip(c echo.Context) error {
	var ids []uuid.UUID

	// Check JSON body if POST
	if c.Request().Method == http.MethodPost {
		var req struct {
			IDs []string `json:"ids"`
		}
		if err := c.Bind(&req); err == nil && len(req.IDs) > 0 {
			for _, s := range req.IDs {
				if id, err := uuid.Parse(s); err == nil {
					ids = append(ids, id)
				}
			}
		}
	}

	// Check query param (?ids=uuid1,uuid2)
	if len(ids) == 0 {
		idsParam := c.QueryParam("ids")
		for _, s := range strings.Split(idsParam, ",") {
			trimmed := strings.TrimSpace(s)
			if id, err := uuid.Parse(trimmed); err == nil {
				ids = append(ids, id)
			}
		}
	}

	if len(ids) == 0 {
		return echo.NewHTTPError(http.StatusBadRequest, "no valid document ids provided")
	}

	docs, err := h.repo.GetByIDs(c.Request().Context(), ids)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if len(docs) == 0 {
		return echo.NewHTTPError(http.StatusNotFound, "documents not found")
	}

	zipFileName := fmt.Sprintf("pe_documents_%s.zip", time.Now().Format("20060102_150405"))
	c.Response().Header().Set(echo.HeaderContentType, "application/zip")
	c.Response().Header().Set(echo.HeaderContentDisposition, fmt.Sprintf("attachment; filename=\"%s\"", zipFileName))
	c.Response().WriteHeader(http.StatusOK)

	zipWriter := zip.NewWriter(c.Response().Writer)
	defer zipWriter.Close()

	usedNames := make(map[string]int)

	for _, doc := range docs {
		f, err := os.Open(doc.FilePath)
		if err != nil {
			log.Printf("[DocumentZip] Skipping missing file %s: %v", doc.FilePath, err)
			continue
		}

		name := doc.FileName
		if name == "" {
			name = doc.Title
		}
		if count, exists := usedNames[name]; exists {
			usedNames[name] = count + 1
			ext := filepath.Ext(name)
			base := strings.TrimSuffix(name, ext)
			name = fmt.Sprintf("%s_%d%s", base, count+1, ext)
		} else {
			usedNames[name] = 1
		}

		w, err := zipWriter.Create(name)
		if err != nil {
			f.Close()
			continue
		}

		_, _ = io.Copy(w, f)
		f.Close()
	}

	return nil
}
