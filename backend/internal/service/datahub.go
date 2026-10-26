package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"pe-portal/internal/model"
	"pe-portal/internal/repository"
)

// ponytail: Minimalist, standard-library DataHub Ingest client for Samsung Enterprise BigData (NDH Connector API v3)
// Dynamically reads custom API URL and API Key from Settings repository (database), eliminating hardcoded keys.

type DataHubIngestParams struct {
	ProjectID      string   `json:"project_id"`
	FolderID       string   `json:"folder_id"`
	Title          string   `json:"title"`
	Description    string   `json:"description"`
	Tags           []string `json:"tags"`
	Overwrite      bool     `json:"overwrite"`
	ParsingYN      bool     `json:"parsing_yn"`
	PIITagEnabled  *bool    `json:"pii_tag_enabled"`
	OCREnabled     bool     `json:"ocr_enabled"`
	MetadataValues string   `json:"metadata_values"`
	CustomInfo     string   `json:"custom_info"`
}

type DataHubIngestResult struct {
	ObjectID string `json:"object_id"`
	Status   string `json:"status"`
	Raw      string `json:"raw,omitempty"`
}

type WatchScanResult struct {
	ScannedFiles  int      `json:"scanned_files"`
	UploadedFiles int      `json:"uploaded_files"`
	FailedFiles   int      `json:"failed_files"`
	WatchFolder   string   `json:"watch_folder"`
	UploadedDir   string   `json:"uploaded_dir"`
	SuccessNames  []string `json:"success_names"`
	Errors        []string `json:"errors"`
}

type DataHubService struct {
	settingsRepo *repository.SettingsRepository
	baseURL      string
	apiKey       string
	httpClient   *http.Client
	scanMutex    sync.Mutex
}

func NewDataHubService(settingsRepo *repository.SettingsRepository) *DataHubService {
	baseURL := os.Getenv("DATAHUB_API_URL")
	if baseURL == "" {
		baseURL = "https://datahub-api.bigdata.samsung.com"
	}
	baseURL = strings.TrimRight(baseURL, "/")

	apiKey := os.Getenv("DATAHUB_API_KEY")

	return &DataHubService{
		settingsRepo: settingsRepo,
		baseURL:      baseURL,
		apiKey:       apiKey,
		// ponytail: 8-second timeout to avoid holding requests when intranet server is unreachable from external networks
		httpClient: &http.Client{
			Timeout: 8 * time.Second,
		},
	}
}

// resolveConfig retrieves active config from database settings or falls back to env/defaults
func (s *DataHubService) resolveConfig(ctx context.Context) (string, string, string, string, bool) {
	baseURL := s.baseURL
	apiKey := s.apiKey
	defaultProj := "PE_PORTAL"
	defaultFolder := ""
	isActive := true

	if s.settingsRepo != nil {
		if cfg, err := s.settingsRepo.GetDataHubConfig(ctx); err == nil && cfg != nil {
			if cfg.APIURL != "" {
				baseURL = strings.TrimRight(cfg.APIURL, "/")
			}
			if cfg.APIKey != "" {
				apiKey = cfg.APIKey
			}
			if cfg.DefaultProjectID != "" {
				defaultProj = cfg.DefaultProjectID
			}
			if cfg.DefaultFolderID != "" {
				defaultFolder = cfg.DefaultFolderID
			}
			isActive = cfg.IsActive
		}
	}

	return baseURL, apiKey, defaultProj, defaultFolder, isActive
}

// IngestObject uploads file stream to DataHub Ingest API: POST /v3/objects/ingest
func (s *DataHubService) IngestObject(ctx context.Context, fileReader io.Reader, filename string, params DataHubIngestParams, customAuthToken string) (*DataHubIngestResult, error) {
	baseURL, apiKey, defaultProj, defaultFolder, isActive := s.resolveConfig(ctx)
	if !isActive {
		return nil, fmt.Errorf("datahub integration is deactivated in portal settings")
	}

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	// 1. files * (multipart file)
	part, err := writer.CreateFormFile("files", filename)
	if err != nil {
		return nil, fmt.Errorf("failed to create multipart form file: %w", err)
	}
	if _, err := io.Copy(part, fileReader); err != nil {
		return nil, fmt.Errorf("failed to copy file contents: %w", err)
	}

	// 2. folder_id or project_id (at least one is required)
	projectID := strings.TrimSpace(params.ProjectID)
	folderID := strings.TrimSpace(params.FolderID)

	if folderID == "" && defaultFolder != "" {
		folderID = defaultFolder
	}
	if projectID == "" && folderID == "" {
		projectID = defaultProj
	}

	if folderID != "" {
		if len(folderID) > 50 {
			folderID = folderID[:50]
		}
		_ = writer.WriteField("folder_id", folderID)
	}
	if projectID != "" {
		if len(projectID) > 50 {
			projectID = projectID[:50]
		}
		_ = writer.WriteField("project_id", projectID)
	}

	// 3. title (max 50) & description (max 200)
	title := strings.TrimSpace(params.Title)
	if title == "" {
		title = filename
	}
	if len(title) > 50 {
		title = title[:50]
	}
	_ = writer.WriteField("title", title)

	if params.Description != "" {
		desc := params.Description
		if len(desc) > 200 {
			desc = desc[:200]
		}
		_ = writer.WriteField("description", desc)
	}

	// 4. overwrite, parsing_yn, ocr_enabled
	_ = writer.WriteField("overwrite", strconv.FormatBool(params.Overwrite))
	_ = writer.WriteField("parsing_yn", strconv.FormatBool(params.ParsingYN))
	_ = writer.WriteField("ocr_enabled", strconv.FormatBool(params.OCREnabled))

	// 5. pii_tag_enabled (optional)
	if params.PIITagEnabled != nil {
		_ = writer.WriteField("pii_tag_enabled", strconv.FormatBool(*params.PIITagEnabled))
	}

	// 6. tags (repeated field in form-data, max 20 chars each)
	for _, tag := range params.Tags {
		t := strings.TrimSpace(tag)
		if t != "" {
			if len(t) > 20 {
				t = t[:20]
			}
			_ = writer.WriteField("tags", t)
		}
	}

	// 7. metadata_values & custom_info
	if params.MetadataValues != "" {
		_ = writer.WriteField("metadata_values", params.MetadataValues)
	}
	if params.CustomInfo != "" {
		_ = writer.WriteField("custom_info", params.CustomInfo)
	}

	if err := writer.Close(); err != nil {
		return nil, fmt.Errorf("failed to finalize multipart body: %w", err)
	}

	targetURL := baseURL + "/v3/objects/ingest"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, targetURL, &body)
	if err != nil {
		return nil, fmt.Errorf("failed to build datahub request: %w", err)
	}

	req.Header.Set("Content-Type", writer.FormDataContentType())

	// Authorization Bearer
	token := apiKey
	if customAuthToken != "" {
		token = customAuthToken
	}
	if token != "" {
		if !strings.HasPrefix(strings.ToLower(token), "bearer ") {
			token = "Bearer " + token
		}
		req.Header.Set("Authorization", token)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("datahub network error (intranet unreachable): %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("datahub error %d: %s", resp.StatusCode, string(respBody))
	}

	result := &DataHubIngestResult{
		Status: "synced",
		Raw:    string(respBody),
	}

	var parsed map[string]interface{}
	if err := json.Unmarshal(respBody, &parsed); err == nil {
		if id, ok := parsed["object_id"].(string); ok {
			result.ObjectID = id
		} else if id, ok := parsed["id"].(string); ok {
			result.ObjectID = id
		} else if items, ok := parsed["items"].([]interface{}); ok && len(items) > 0 {
			if firstItem, ok := items[0].(map[string]interface{}); ok {
				if id, ok := firstItem["object_id"].(string); ok {
					result.ObjectID = id
				}
			}
		}
	}

	return result, nil
}

// TestConnection tests connectivity to DataHub by calling GET /v3/projects
func (s *DataHubService) TestConnection(ctx context.Context, customURL string, customKey string) (map[string]interface{}, error) {
	baseURL, apiKey, _, _, _ := s.resolveConfig(ctx)
	if customURL != "" {
		baseURL = strings.TrimRight(customURL, "/")
	}
	if customKey != "" {
		apiKey = customKey
	}

	targetURL := baseURL + "/v3/projects"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
	if err != nil {
		return nil, fmt.Errorf("invalid request URL: %w", err)
	}

	if apiKey != "" {
		token := apiKey
		if !strings.HasPrefix(strings.ToLower(token), "bearer ") {
			token = "Bearer " + token
		}
		req.Header.Set("Authorization", token)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("connection failed (intranet unreachable): %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	return map[string]interface{}{
		"status_code": resp.StatusCode,
		"response":    string(body),
		"endpoint":    targetURL,
	}, nil
}

// ponytail: ScanAndUploadWatchFolder scans configured watch folder, ingests new files to DataHub,
// and moves successfully ingested files to the Uploaded/ subfolder. If ingestion fails, files remain in the watch folder for retry.
func (s *DataHubService) ScanAndUploadWatchFolder(ctx context.Context, docRepo *repository.DocumentRepository) (*WatchScanResult, error) {
	s.scanMutex.Lock()
	defer s.scanMutex.Unlock()

	result := &WatchScanResult{
		SuccessNames: make([]string, 0),
		Errors:       make([]string, 0),
	}

	if s.settingsRepo == nil {
		return nil, fmt.Errorf("settings repository is not configured")
	}

	cfg, err := s.settingsRepo.GetDataHubConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to load datahub settings: %w", err)
	}

	watchFolder := strings.TrimSpace(cfg.WatchFolderPath)
	if watchFolder == "" {
		watchFolder = "/data/files/datahub_watch"
	}
	result.WatchFolder = watchFolder

	uploadedDir := filepath.Join(watchFolder, "Uploaded")
	result.UploadedDir = uploadedDir

	if err := os.MkdirAll(watchFolder, 0755); err != nil {
		return nil, fmt.Errorf("failed to create or access watch folder %s: %w", watchFolder, err)
	}
	if err := os.MkdirAll(uploadedDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create or access Uploaded subfolder %s: %w", uploadedDir, err)
	}

	entries, err := os.ReadDir(watchFolder)
	if err != nil {
		return nil, fmt.Errorf("failed to read watch folder %s: %w", watchFolder, err)
	}

	for _, entry := range entries {
		// ponytail: Skip subdirectories (including "Uploaded") and hidden/temporary files
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if strings.HasPrefix(name, ".") || strings.HasSuffix(name, ".tmp") || strings.HasSuffix(name, ".part") {
			continue
		}

		filePath := filepath.Join(watchFolder, name)
		fileInfo, err := entry.Info()
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("%s: failed to read file info (%v)", name, err))
			result.FailedFiles++
			continue
		}

		if fileInfo.Size() == 0 {
			// Skip zero-byte files that might still be in progress of copying
			continue
		}

		result.ScannedFiles++

		f, err := os.Open(filePath)
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("%s: failed to open file (%v)", name, err))
			result.FailedFiles++
			continue
		}

		ext := filepath.Ext(name)
		title := strings.TrimSuffix(name, ext)

		params := DataHubIngestParams{
			ProjectID:   cfg.DefaultProjectID,
			FolderID:    cfg.DefaultFolderID,
			Title:       title,
			Description: fmt.Sprintf("Auto-ingested from PE-Portal watch folder (%s)", watchFolder),
			Tags:        []string{"auto-watch", "pe-portal"},
			Overwrite:   true,
			ParsingYN:   true,
			OCREnabled:  false,
		}

		ingestRes, ingestErr := s.IngestObject(ctx, f, name, params, "")
		f.Close()

		if ingestErr != nil {
			// Leave file in watchFolder to retry on subsequent scan
			result.Errors = append(result.Errors, fmt.Sprintf("%s: %v", name, ingestErr))
			result.FailedFiles++
			continue
		}

		// Upload succeeded! Move file to Uploaded folder
		destPath := filepath.Join(uploadedDir, name)
		if _, statErr := os.Stat(destPath); statErr == nil {
			cleanBase := strings.TrimSuffix(name, ext)
			destPath = filepath.Join(uploadedDir, fmt.Sprintf("%s_%d%s", cleanBase, time.Now().Unix(), ext))
		}

		if err := moveFile(filePath, destPath); err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("%s: uploaded to DataHub, but failed to move to Uploaded folder: %v", name, err))
		}

		// Index into documents repository if available
		if docRepo != nil {
			now := time.Now()
			cat := "other"
			doc := &model.Document{
				Title:           title,
				FileName:        name,
				FilePath:        destPath,
				FileSize:        fileInfo.Size(),
				MimeType:        determineMimeType(ext),
				FileType:        determineFileType(ext),
				Category:        &cat,
				DataHubStatus:   "synced",
				DataHubObjectID: &ingestRes.ObjectID,
				DataHubSyncedAt: &now,
			}
			_, _ = docRepo.Create(ctx, doc)
		}

		result.SuccessNames = append(result.SuccessNames, name)
		result.UploadedFiles++
	}

	// Update last scan timestamp in database
	_ = s.settingsRepo.UpdateDataHubScanTime(ctx)

	return result, nil
}

// ponytail: StartWatchWorker starts a lightweight periodic background worker checking for new watch folder files
func (s *DataHubService) StartWatchWorker(ctx context.Context, docRepo *repository.DocumentRepository) {
	ticker := time.NewTicker(30 * time.Second)
	go func() {
		for {
			select {
			case <-ctx.Done():
				ticker.Stop()
				return
			case <-ticker.C:
				if s.settingsRepo == nil {
					continue
				}
				cfg, err := s.settingsRepo.GetDataHubConfig(ctx)
				if err != nil || cfg == nil || !cfg.AutoUploadEnabled || !cfg.IsActive {
					continue
				}
				_, _ = s.ScanAndUploadWatchFolder(ctx, docRepo)
			}
		}
	}()
}

// moveFile moves a file safely across filesystems with fallback copy+remove
func moveFile(src, dst string) error {
	if err := os.Rename(src, dst); err == nil {
		return nil
	}

	inFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer inFile.Close()

	outFile, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer outFile.Close()

	if _, err := io.Copy(outFile, inFile); err != nil {
		return err
	}
	inFile.Close()
	return os.Remove(src)
}

func determineFileType(ext string) string {
	ext = strings.ToLower(strings.TrimPrefix(ext, "."))
	switch ext {
	case "pdf":
		return "pdf"
	case "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv":
		return "document"
	case "jpg", "jpeg", "png", "gif", "webp", "svg":
		return "image"
	case "dwg", "dxf", "step", "stp", "iges", "igs", "stl":
		return "cad"
	case "zip", "rar", "7z", "tar", "gz":
		return "archive"
	default:
		return "other"
	}
}

func determineMimeType(ext string) string {
	ext = strings.ToLower(strings.TrimPrefix(ext, "."))
	switch ext {
	case "pdf":
		return "application/pdf"
	case "csv":
		return "text/csv"
	case "txt":
		return "text/plain"
	case "json":
		return "application/json"
	case "png":
		return "image/png"
	case "jpg", "jpeg":
		return "image/jpeg"
	case "xlsx":
		return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	case "docx":
		return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	default:
		return "application/octet-stream"
	}
}

