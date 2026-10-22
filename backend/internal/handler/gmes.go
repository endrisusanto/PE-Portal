package handler

import (
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	"pe-portal/internal/model"
	"pe-portal/internal/repository"
)

type GmesHandler struct {
	repo *repository.GmesRepository
}

func NewGmesHandler(repo *repository.GmesRepository) *GmesHandler {
	return &GmesHandler{repo: repo}
}

// List returns filtered GMES issues
func (h *GmesHandler) List(c echo.Context) error {
	process := c.QueryParam("process")
	line := c.QueryParam("line")
	modelName := c.QueryParam("model")
	status := c.QueryParam("status")
	search := c.QueryParam("search")

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

	items, total, err := h.repo.ListIssues(c.Request().Context(), process, line, modelName, status, search, limit, offset)
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

// GetStats returns summary KPI stats for GMES
func (h *GmesHandler) GetStats(c echo.Context) error {
	stats, err := h.repo.GetStats(c.Request().Context())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, stats)
}

// GetMeasurements returns recent measurement logs
func (h *GmesHandler) GetMeasurements(c echo.Context) error {
	process := c.QueryParam("process")
	limit := 30
	if lStr := c.QueryParam("limit"); lStr != "" {
		if l, err := strconv.Atoi(lStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}

	items, err := h.repo.ListMeasurements(c.Request().Context(), process, limit)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"items": items,
	})
}

// Create creates a new production issue
func (h *GmesHandler) Create(c echo.Context) error {
	var issue model.GmesIssue
	if err := c.Bind(&issue); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request payload")
	}

	if issue.Process == "" || issue.LineName == "" || issue.Model == "" || issue.TestItem == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Process, Line, Model, and Test Item are required")
	}

	if issue.Status == "" {
		issue.Status = "OPEN"
	}

	if err := h.repo.CreateIssue(c.Request().Context(), &issue); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusCreated, issue)
}

// Update updates an existing issue
func (h *GmesHandler) Update(c echo.Context) error {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid issue ID")
	}

	var issue model.GmesIssue
	if err := c.Bind(&issue); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request payload")
	}
	issue.ID = id

	if err := h.repo.UpdateIssue(c.Request().Context(), &issue); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, issue)
}

// Delete removes an issue
func (h *GmesHandler) Delete(c echo.Context) error {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid issue ID")
	}

	if err := h.repo.DeleteIssue(c.Request().Context(), id); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}
