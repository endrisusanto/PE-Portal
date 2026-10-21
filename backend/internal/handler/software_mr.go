package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"pe-portal/internal/model"
	"pe-portal/internal/repository"
)

type SoftwareMRHandler struct {
	repo *repository.SoftwareMRRepository
}

func NewSoftwareMRHandler(repo *repository.SoftwareMRRepository) *SoftwareMRHandler {
	return &SoftwareMRHandler{repo: repo}
}

// List returns paginated software MR releases
func (h *SoftwareMRHandler) List(c echo.Context) error {
	search := c.QueryParam("search")
	pic := c.QueryParam("pic")
	modelName := c.QueryParam("model")
	status := c.QueryParam("status")
	date := c.QueryParam("date")

	limit := 50
	if lStr := c.QueryParam("limit"); lStr != "" {
		if l, err := strconv.Atoi(lStr); err == nil && l > 0 && l <= 500 {
			limit = l
		}
	}

	page := 1
	if pStr := c.QueryParam("page"); pStr != "" {
		if p, err := strconv.Atoi(pStr); err == nil && p > 0 {
			page = p
		}
	}
	offset := (page - 1) * limit

	items, total, err := h.repo.List(c.Request().Context(), search, pic, modelName, status, date, limit, offset)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"items": items,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// GetStats returns summary counts
func (h *SoftwareMRHandler) GetStats(c echo.Context) error {
	stats, err := h.repo.GetStats(c.Request().Context())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, stats)
}

// GetFilters returns dropdown options
func (h *SoftwareMRHandler) GetFilters(c echo.Context) error {
	filters, err := h.repo.GetFilters(c.Request().Context())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, filters)
}

// Get finds a single release by ID
func (h *SoftwareMRHandler) Get(c echo.Context) error {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid release id")
	}

	item, err := h.repo.GetByID(c.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "release record not found")
	}
	return c.JSON(http.StatusOK, item)
}

// GetDailyTrend returns 30-day daily release trend
func (h *SoftwareMRHandler) GetDailyTrend(c echo.Context) error {
	modelName := c.QueryParam("model")
	trend, err := h.repo.GetDailyTrend(c.Request().Context(), modelName)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, trend)
}

// SyncFromIntranet synchronizes firmware release records from XAMPP Apache api_releases.php
func (h *SoftwareMRHandler) SyncFromIntranet(c echo.Context) error {
	apiURL := os.Getenv("SOFTWARE_MR_API_URL")
	if apiURL == "" {
		apiURL = "http://107.102.39.55/companion-release-cheatsheet/api_releases.php"
	}

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(apiURL)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadGateway, "Failed to connect to Intranet Software MR API: "+err.Error())
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return echo.NewHTTPError(http.StatusBadGateway, fmt.Sprintf("Intranet API returned status code: %d", resp.StatusCode))
	}

	var rawItems []struct {
		ID                interface{} `json:"id"`
		Model             string      `json:"model"`
		OLEVersion        string      `json:"ole_version"`
		OXMOLMNewVersion  string      `json:"oxm_olm_new_version"`
		AP                string      `json:"ap"`
		CP                string      `json:"cp"`
		CSC               string      `json:"csc"`
		APMapping         string      `json:"ap_mapping"`
		CPMapping         string      `json:"cp_mapping"`
		CSCVersionUp      string      `json:"csc_version_up"`
		Status            string      `json:"status"`
		PIC               string      `json:"pic"`
		ReleaseNoteFormat string      `json:"release_note_format"`
		CreatedAt         string      `json:"created_at"`
		UpdatedAt         string      `json:"updated_at"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&rawItems); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to decode API response JSON: "+err.Error())
	}

	items := make([]model.SoftwareMRRelease, 0, len(rawItems))
	for _, raw := range rawItems {
		var id int
		switch v := raw.ID.(type) {
		case float64:
			id = int(v)
		case string:
			id, _ = strconv.Atoi(v)
		}
		if id == 0 {
			continue
		}

		cTime, _ := time.Parse("2006-01-02 15:04:05", raw.CreatedAt)
		if cTime.IsZero() {
			cTime, _ = time.Parse(time.RFC3339, raw.CreatedAt)
		}
		uTime, _ := time.Parse("2006-01-02 15:04:05", raw.UpdatedAt)
		if uTime.IsZero() {
			uTime, _ = time.Parse(time.RFC3339, raw.UpdatedAt)
		}

		items = append(items, model.SoftwareMRRelease{
			ID:                id,
			Model:             raw.Model,
			OLEVersion:        raw.OLEVersion,
			OXMOLMNewVersion:  raw.OXMOLMNewVersion,
			AP:                raw.AP,
			CP:                raw.CP,
			CSC:               raw.CSC,
			APMapping:         raw.APMapping,
			CPMapping:         raw.CPMapping,
			CSCVersionUp:      raw.CSCVersionUp,
			Status:            raw.Status,
			PIC:               raw.PIC,
			ReleaseNoteFormat: raw.ReleaseNoteFormat,
			CreatedAt:         cTime,
			UpdatedAt:         uTime,
		})
	}

	syncedCount, err := h.repo.UpsertBatch(c.Request().Context(), items)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to persist synced releases: "+err.Error())
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"status":       "success",
		"message":      fmt.Sprintf("Successfully synced %d releases from Intranet XAMPP", syncedCount),
		"synced_count": syncedCount,
		"source_url":   apiURL,
	})
}

