package handler

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	"pe-portal/internal/model"
	"pe-portal/internal/repository"
)

type TrainingHandler struct {
	repo *repository.TrainingRepository
}

func NewTrainingHandler(repo *repository.TrainingRepository) *TrainingHandler {
	return &TrainingHandler{repo: repo}
}

// List returns employee training courses
func (h *TrainingHandler) List(c echo.Context) error {
	category := c.QueryParam("category")
	mandatory := c.QueryParam("mandatory")
	search := c.QueryParam("search")

	limit := 50
	if lStr := c.QueryParam("limit"); lStr != "" {
		if l, err := strconv.Atoi(lStr); err == nil && l > 0 && l <= 200 {
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

	items, total, err := h.repo.List(c.Request().Context(), category, mandatory, search, limit, offset)
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

// Get returns single module details
func (h *TrainingHandler) Get(c echo.Context) error {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid training ID")
	}

	item, err := h.repo.Get(c.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "Training not found")
	}

	return c.JSON(http.StatusOK, item)
}

// Unlock verifies password and provides post-test answer keys
func (h *TrainingHandler) Unlock(c echo.Context) error {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid training ID")
	}

	var req model.TrainingUnlockRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request payload")
	}

	answerKey, err := h.repo.VerifyAndUnlock(c.Request().Context(), id, req.Password)
	if err != nil {
		if errors.Is(err, repository.ErrInvalidPassword) {
			return c.JSON(http.StatusUnauthorized, map[string]interface{}{
				"success": false,
				"error":   "Password kunci jawaban salah. Akses ditolak. Hubungi endri.s@samsung.com untuk akses.",
			})
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    answerKey,
	})
}

// Create inserts a new training module
func (h *TrainingHandler) Create(c echo.Context) error {
	var req model.TrainingCreateRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request payload")
	}

	if req.Title == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Title is required")
	}

	item, err := h.repo.Create(c.Request().Context(), &req)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusCreated, item)
}

// Update modifies an existing module
func (h *TrainingHandler) Update(c echo.Context) error {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid training ID")
	}

	var req model.TrainingCreateRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request payload")
	}

	if err := h.repo.Update(c.Request().Context(), id, &req); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}

// Delete removes a training module
func (h *TrainingHandler) Delete(c echo.Context) error {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid training ID")
	}

	if err := h.repo.Delete(c.Request().Context(), id); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}
