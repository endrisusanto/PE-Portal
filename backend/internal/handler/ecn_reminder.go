package handler

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"pe-portal/internal/model"
	"pe-portal/internal/repository"
	"pe-portal/internal/service"
)

type ECNReminderHandler struct {
	repo   *repository.ECNReminderRepository
	worker *service.ECNReminderWorker
}

func NewECNReminderHandler(
	repo *repository.ECNReminderRepository,
	worker *service.ECNReminderWorker,
) *ECNReminderHandler {
	return &ECNReminderHandler{
		repo:   repo,
		worker: worker,
	}
}

// GetSettings returns active reminder configuration along with real-time due ECN preview
func (h *ECNReminderHandler) GetSettings(c echo.Context) error {
	ctx := c.Request().Context()
	settings, err := h.repo.GetSettings(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	daysBefore := settings.DaysBefore
	if daysBefore <= 0 {
		daysBefore = 1
	}
	targetDate := time.Now().AddDate(0, 0, daysBefore)
	targetDateStr := targetDate.Format("2006-01-02")

	dueRecords, err := h.repo.GetDueRunningBOMRecords(ctx, targetDate, settings.IncludeOverdue)
	if err != nil {
		dueRecords = []model.ECNRecord{}
	}

	lastLog, _ := h.repo.GetLastLog(ctx)

	resp := model.ECNReminderStatusResponse{
		Settings:   *settings,
		DueCount:   len(dueRecords),
		DueRecords: dueRecords,
		TargetDate: targetDateStr,
		LastLog:    lastLog,
	}

	return c.JSON(http.StatusOK, resp)
}

// SaveSettings updates recipient list, custom hour, lead time, and options
func (h *ECNReminderHandler) SaveSettings(c echo.Context) error {
	ctx := c.Request().Context()
	var req model.ECNReminderSettings
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request payload")
	}

	// Validate / normalize send_time (comma-separated HH:MM, e.g. "07:00, 08:00, 13:00")
	rawTimes := strings.FieldsFunc(req.SendTime, func(r rune) bool {
		return r == ',' || r == ';' || r == '\n'
	})
	var validTimes []string
	seen := make(map[string]bool)
	for _, raw := range rawTimes {
		trimmed := strings.TrimSpace(raw)
		if trimmed == "" {
			continue
		}
		parts := strings.Split(trimmed, ":")
		if len(parts) == 2 {
			hNum, errH := strconv.Atoi(parts[0])
			mNum, errM := strconv.Atoi(parts[1])
			if errH == nil && errM == nil && hNum >= 0 && hNum < 24 && mNum >= 0 && mNum < 60 {
				slotStr := fmt.Sprintf("%02d:%02d", hNum, mNum)
				if !seen[slotStr] {
					seen[slotStr] = true
					validTimes = append(validTimes, slotStr)
				}
			}
		}
	}
	if len(validTimes) == 0 {
		validTimes = []string{"08:00"}
	}
	req.SendTime = strings.Join(validTimes, ", ")

	if req.DaysBefore <= 0 {
		req.DaysBefore = 1
	}

	saved, err := h.repo.SaveSettings(ctx, &req)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	// Hot reload in-memory scheduler cache
	_ = h.worker.ReloadSettingsCache(ctx)

	return c.JSON(http.StatusOK, saved)
}

// TestSend immediately sends an email test to configured recipients
func (h *ECNReminderHandler) TestSend(c echo.Context) error {
	ctx := c.Request().Context()
	itemCount, err := h.worker.ExecuteReminder(ctx, "MANUAL_TEST")
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Gagal mengirim email tes: %v", err))
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":    true,
		"message":    fmt.Sprintf("Email pengingat berhasil dikirim (%d data ECN jatuh tempo).", itemCount),
		"item_count": itemCount,
	})
}

// GetLogs returns recent reminder dispatch history
func (h *ECNReminderHandler) GetLogs(c echo.Context) error {
	ctx := c.Request().Context()
	logs, err := h.repo.GetLogs(ctx, 10)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, logs)
}
