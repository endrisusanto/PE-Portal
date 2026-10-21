package handler

import (
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
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
