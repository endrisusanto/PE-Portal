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
	"strconv"
	"strings"
	"time"
)

// ponytail: Minimalist, standard-library DataHub Ingest client for Samsung Enterprise BigData (NDH Connector API v3)
// Zero external dependencies; uses net/http and mime/multipart directly.

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

type DataHubService struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

func NewDataHubService() *DataHubService {
	baseURL := os.Getenv("DATAHUB_API_URL")
	if baseURL == "" {
		baseURL = "https://datahub-api.bigdata.samsung.com"
	}
	baseURL = strings.TrimRight(baseURL, "/")

	apiKey := os.Getenv("DATAHUB_API_KEY")

	return &DataHubService{
		baseURL: baseURL,
		apiKey:  apiKey,
		// ponytail: 8-second timeout to avoid holding requests when intranet server is unreachable from external networks
		httpClient: &http.Client{
			Timeout: 8 * time.Second,
		},
	}
}

// IngestObject uploads file stream to DataHub Ingest API: POST /v3/objects/ingest
func (s *DataHubService) IngestObject(ctx context.Context, fileReader io.Reader, filename string, params DataHubIngestParams, customAuthToken string) (*DataHubIngestResult, error) {
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
	// ponytail: If neither is supplied, fallback to default project ID 'PE_PORTAL'
	projectID := strings.TrimSpace(params.ProjectID)
	folderID := strings.TrimSpace(params.FolderID)
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
	} else if folderID == "" {
		defaultProj := os.Getenv("DATAHUB_DEFAULT_PROJECT_ID")
		if defaultProj == "" {
			defaultProj = "PE_PORTAL"
		}
		_ = writer.WriteField("project_id", defaultProj)
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

	targetURL := s.baseURL + "/v3/objects/ingest"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, targetURL, &body)
	if err != nil {
		return nil, fmt.Errorf("failed to build datahub request: %w", err)
	}

	req.Header.Set("Content-Type", writer.FormDataContentType())

	// Authorization Bearer
	token := s.apiKey
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
