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
	"pe-portal/internal/service"
	"pe-portal/internal/util"
)

type ECNHandler struct {
	repo           *repository.ECNRepository
	reminderWorker *service.ECNReminderWorker
}

func NewECNHandler(repo *repository.ECNRepository, reminderWorker *service.ECNReminderWorker) *ECNHandler {
	return &ECNHandler{
		repo:           repo,
		reminderWorker: reminderWorker,
	}
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

	userID := getUserIDFromContext(c)
	item.CreatedBy = userID
	item.UpdatedBy = userID

	// ponytail: Auto-detect part number change if not provided
	if strings.TrimSpace(item.PartBefore) == "" && strings.TrimSpace(item.PartAfter) == "" {
		item.PartBefore, item.PartAfter = repository.ExtractPartNumberChange(item.Remark, item.ECTitle)
	}

	created, err := h.repo.Create(c.Request().Context(), &item)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	// ponytail: record initial creation breadcrumb log
	_ = h.repo.RecordChangeLog(c.Request().Context(), &model.ECNChangeLog{
		ECNID:     created.ID,
		Action:    "CREATE",
		ChangedBy: userID,
		Changes: map[string]interface{}{
			"status":           item.Status,
			"running_date_bom": item.RunningDateBOM,
		},
		Note:      "Pembuatan data ECN baru",
		CreatedAt: time.Now(),
	})

	return c.JSON(http.StatusCreated, created)
}

// Update modifies an existing ECN record and logs delta changes
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

	userID := getUserIDFromContext(c)
	item.UpdatedBy = userID

	// ponytail: Auto-detect part number change if not provided
	if strings.TrimSpace(item.PartBefore) == "" && strings.TrimSpace(item.PartAfter) == "" {
		item.PartBefore, item.PartAfter = repository.ExtractPartNumberChange(item.Remark, item.ECTitle)
	}

	// Fetch existing record to calculate delta / changes
	oldRec, _ := h.repo.GetByID(c.Request().Context(), id)

	updated, err := h.repo.Update(c.Request().Context(), id, &item)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	// Calculate changes and record audit breadcrumb log
	changes := make(map[string]interface{})
	action := "UPDATE"
	noteParts := []string{}

	if oldRec != nil {
		if oldRec.PartBefore != item.PartBefore || oldRec.PartAfter != item.PartAfter {
			if item.PartBefore != "" || item.PartAfter != "" {
				changes["part_change"] = map[string]string{
					"from": fmt.Sprintf("%s ➔ %s", oldRec.PartBefore, oldRec.PartAfter),
					"to":   fmt.Sprintf("%s ➔ %s", item.PartBefore, item.PartAfter),
				}
				action = "PART_CHANGE"
				noteParts = append(noteParts, fmt.Sprintf("Part: %s ➔ %s", item.PartBefore, item.PartAfter))
			}
		}
		if oldRec.Status != item.Status && item.Status != "" {
			changes["status"] = map[string]string{"from": oldRec.Status, "to": item.Status}
			action = "STATUS_CHANGE"
			noteParts = append(noteParts, fmt.Sprintf("Status: %s ➔ %s", oldRec.Status, item.Status))
		}
		if oldRec.RunningDateBOM != item.RunningDateBOM {
			if item.RunningDateBOM != "" {
				changes["running_date_bom"] = map[string]string{"from": oldRec.RunningDateBOM, "to": item.RunningDateBOM}
				action = "BOM_CHANGE"
				noteParts = append(noteParts, fmt.Sprintf("Running BOM: %s ➔ %s", oldRec.RunningDateBOM, item.RunningDateBOM))
			}
			// ponytail: Running BOM date changes are stored in ecn_change_logs and batched at scheduled hours by ECNReminderWorker
		}
		if oldRec.DistributionDate != item.DistributionDate && item.DistributionDate != "" {
			changes["distribution_date"] = map[string]string{"from": oldRec.DistributionDate, "to": item.DistributionDate}
			noteParts = append(noteParts, fmt.Sprintf("Dist Date: %s ➔ %s", oldRec.DistributionDate, item.DistributionDate))
		}
		if oldRec.Remark != item.Remark && item.Remark != "" {
			changes["remark"] = map[string]string{"from": oldRec.Remark, "to": item.Remark}
			noteParts = append(noteParts, "Remark diperbarui")
		}
		if oldRec.Process != item.Process && item.Process != "" {
			changes["process"] = map[string]string{"from": oldRec.Process, "to": item.Process}
			noteParts = append(noteParts, fmt.Sprintf("Proses: %s ➔ %s", oldRec.Process, item.Process))
		}
		if oldRec.ECNNo != item.ECNNo && item.ECNNo != "" {
			changes["ecn_no"] = map[string]string{"from": oldRec.ECNNo, "to": item.ECNNo}
		}
	}

	note := "Pembaruan data ECN"
	if len(noteParts) > 0 {
		note = strings.Join(noteParts, " • ")
	}

	_ = h.repo.RecordChangeLog(c.Request().Context(), &model.ECNChangeLog{
		ECNID:     id,
		Action:    action,
		ChangedBy: userID,
		Changes:   changes,
		Note:      note,
		CreatedAt: time.Now(),
	})

	return c.JSON(http.StatusOK, updated)
}

// GetLogs returns change audit trail logs for a specific ECN
func (h *ECNHandler) GetLogs(c echo.Context) error {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid UUID")
	}

	logs, err := h.repo.GetChangeLogs(c.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, logs)
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

// BulkDelete removes multiple ECN records by their IDs (ponytail)
func (h *ECNHandler) BulkDelete(c echo.Context) error {
	var req model.ECNBulkDeleteRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request payload")
	}

	if len(req.IDs) == 0 {
		return echo.NewHTTPError(http.StatusBadRequest, "No IDs provided for bulk delete")
	}

	count, err := h.repo.BulkDelete(c.Request().Context(), req.IDs)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Bulk delete failed: %v", err))
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"deleted": count,
		"message": fmt.Sprintf("Berhasil menghapus %d data ECN.", count),
	})
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
