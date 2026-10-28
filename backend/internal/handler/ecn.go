package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"pe-portal/internal/middleware"
	"pe-portal/internal/model"
	"pe-portal/internal/repository"
	"pe-portal/internal/util"
)

type ECNHandler struct {
	repo *repository.ECNRepository
}

func NewECNHandler(repo *repository.ECNRepository) *ECNHandler {
	return &ECNHandler{repo: repo}
}

// List returns filtered and paginated ECN records
func (h *ECNHandler) List(c echo.Context) error {
	var q model.ECNListQuery
	if err := c.Bind(&q); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid query parameters")
	}

	if q.Limit <= 0 {
		q.Limit = 50
	}
	if q.Page <= 0 {
		q.Page = 1
	}

	res, err := h.repo.List(c.Request().Context(), q)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, res)
}

// GetStats returns summary metrics for ECN dashboard
func (h *ECNHandler) GetStats(c echo.Context) error {
	stats, err := h.repo.GetStats(c.Request().Context())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, stats)
}

func getUserIDFromContext(c echo.Context) *uuid.UUID {
	val := c.Get(middleware.ContextKeyUserID)
	if val == nil {
		return nil
	}
	if uid, ok := val.(uuid.UUID); ok && uid != uuid.Nil {
		return &uid
	}
	return nil
}

// Create inserts a new single ECN record
func (h *ECNHandler) Create(c echo.Context) error {
	var item model.ECNRecord
	if err := c.Bind(&item); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body")
	}

	if strings.TrimSpace(item.ECNNo) == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "ECN NO is required")
	}

	item.CreatedBy = getUserIDFromContext(c)

	created, err := h.repo.Create(c.Request().Context(), &item)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusCreated, created)
}

// Update modifies an existing ECN record
func (h *ECNHandler) Update(c echo.Context) error {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid UUID")
	}

	var item model.ECNRecord
	if err := c.Bind(&item); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body")
	}

	updated, err := h.repo.Update(c.Request().Context(), id, &item)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, updated)
}

// Delete removes an ECN record
func (h *ECNHandler) Delete(c echo.Context) error {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid UUID")
	}

	if err := h.repo.Delete(c.Request().Context(), id); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "ECN record deleted successfully"})
}

// BulkImport accepts an array of ECN records (from Paste Table or parsed Excel)
func (h *ECNHandler) BulkImport(c echo.Context) error {
	var req model.ECNBulkImportRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid JSON payload for bulk import")
	}

	if len(req.Records) == 0 {
		return echo.NewHTTPError(http.StatusBadRequest, "No records provided in request")
	}

	createdBy := getUserIDFromContext(c)

	count, err := h.repo.BulkInsert(c.Request().Context(), req.Records, createdBy)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Bulk import failed: %v", err))
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":  true,
		"imported": count,
		"message":  fmt.Sprintf("Berhasil mengimpor %d baris ECN ke database.", count),
	})
}

// ParseExcel handles file upload of .xlsx and invokes ecn_parser.py
// Uses util.FindPythonExecutable() ensuring 'python' is called on Windows
func (h *ECNHandler) ParseExcel(c echo.Context) error {
	file, err := c.FormFile("file")
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "File upload required")
	}

	src, err := file.Open()
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to open uploaded file")
	}
	defer src.Close()

	// Save temp file
	tempDir := filepath.Join(os.TempDir(), "pe_ecn_uploads")
	_ = os.MkdirAll(tempDir, 0755)
	tempFilePath := filepath.Join(tempDir, fmt.Sprintf("ecn_upload_%d_%s", time.Now().UnixNano(), filepath.Base(file.Filename)))

	dst, err := os.Create(tempFilePath)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create temporary file")
	}
	defer os.Remove(tempFilePath) // Cleanup after parse

	if _, err = io.Copy(dst, src); err != nil {
		dst.Close()
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to save file to disk")
	}
	dst.Close()

	// Locate ecn_parser.py
	scriptPath := filepath.Join("scripts", "ecn_parser.py")
	if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
		scriptPath = filepath.Join("backend", "scripts", "ecn_parser.py")
		if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
			scriptPath = "/app/scripts/ecn_parser.py"
		}
	}

	// Resolve python binary: on Windows strictly 'python', on Linux 'python3'
	pythonBin := util.FindPythonExecutable()

	cmd := exec.Command(pythonBin, scriptPath, "--input-file", tempFilePath)
	cmd.Env = append(os.Environ(),
		"PYTHONIOENCODING=utf-8",
		"PYTHONUTF8=1",
	)

	output, err := cmd.CombinedOutput()
	outStr := strings.TrimSpace(string(output))

	if err != nil {
		// Check if json error was returned by python
		var errPayload map[string]interface{}
		startIdx := strings.Index(outStr, "{")
		endIdx := strings.LastIndex(outStr, "}")
		if startIdx >= 0 && endIdx > startIdx {
			_ = json.Unmarshal([]byte(outStr[startIdx:endIdx+1]), &errPayload)
			return c.JSON(http.StatusOK, errPayload)
		}

		return echo.NewHTTPError(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Eksekusi parser gagal (%s): %v", pythonBin, err),
			"details": outStr,
		})
	}

	// Parse JSON from stdout
	var result map[string]interface{}
	startIdx := strings.Index(outStr, "{")
	endIdx := strings.LastIndex(outStr, "}")
	if startIdx >= 0 && endIdx > startIdx {
		if err := json.Unmarshal([]byte(outStr[startIdx:endIdx+1]), &result); err == nil {
			return c.JSON(http.StatusOK, result)
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":    false,
		"error":      "Format output parser tidak dapat dibaca",
		"raw_output": outStr,
	})
}
