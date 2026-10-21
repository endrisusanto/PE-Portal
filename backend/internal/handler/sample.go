package handler

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"
	"pe-portal/internal/middleware"
	"pe-portal/internal/model"
	"pe-portal/internal/repository"
)

type SampleHandler struct {
	repo *repository.SampleRepository
}

func NewSampleHandler(repo *repository.SampleRepository) *SampleHandler {
	return &SampleHandler{repo: repo}
}

// List returns paginated samples with search and filter
func (h *SampleHandler) List(c echo.Context) error {
	search := c.QueryParam("search")
	modelName := c.QueryParam("model")
	statusPinjam := c.QueryParam("status_pinjam")
	condition := c.QueryParam("condition")

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

	items, total, err := h.repo.List(c.Request().Context(), search, modelName, statusPinjam, condition, limit, offset)
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
func (h *SampleHandler) GetStats(c echo.Context) error {
	stats, err := h.repo.GetStats(c.Request().Context())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, stats)
}

// GetBorrowerGroups returns active loans grouped by borrower
func (h *SampleHandler) GetBorrowerGroups(c echo.Context) error {
	groups, err := h.repo.GetBorrowerGroups(c.Request().Context())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, groups)
}

// GetModelMatrix returns samples grouped into model cards
func (h *SampleHandler) GetModelMatrix(c echo.Context) error {
	search := c.QueryParam("search")
	matrix, err := h.repo.GetModelMatrix(c.Request().Context(), search)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, matrix)
}

// Get finds a single sample by ID
func (h *SampleHandler) Get(c echo.Context) error {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid sample id")
	}

	sample, err := h.repo.GetByID(c.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "sample not found")
	}
	return c.JSON(http.StatusOK, sample)
}

// ScanTransaction handles 1-step borrow/return scan
func (h *SampleHandler) ScanTransaction(c echo.Context) error {
	var req model.ScanRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid scan request")
	}

	if strings.TrimSpace(req.AssetNumber) == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "nomor asset atau serial wajib diisi")
	}

	// If borrower name not supplied, fallback to JWT user
	if strings.TrimSpace(req.BorrowerName) == "" {
		if claimsVal := c.Get(middleware.ContextKeyUserClaims); claimsVal != nil {
			if claims, ok := claimsVal.(*model.UserClaims); ok && claims.Username != "" {
				req.BorrowerName = strings.ToUpper(claims.Username)
			}
		}
	}

	res, err := h.repo.ScanTransaction(c.Request().Context(), req)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, res)
}

// BulkReturn handles returning multiple assets for a borrower
func (h *SampleHandler) BulkReturn(c echo.Context) error {
	var req model.BulkReturnRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid bulk return request")
	}

	count, err := h.repo.BulkReturn(c.Request().Context(), req)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"count":   count,
		"message": fmt.Sprintf("%d sample berhasil dikembalikan", count),
	})
}

// Create inserts a single new sample
func (h *SampleHandler) Create(c echo.Context) error {
	var s model.Sample
	if err := c.Bind(&s); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid sample data")
	}

	if strings.TrimSpace(s.AssetNumber) == "" || strings.TrimSpace(s.Model) == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "nomor asset dan model wajib diisi")
	}

	if err := h.repo.Create(c.Request().Context(), &s); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusCreated, s)
}

// CreateBulk inserts multiple samples
func (h *SampleHandler) CreateBulk(c echo.Context) error {
	var req struct {
		Samples []model.Sample `json:"samples"`
	}
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid bulk samples data")
	}

	if len(req.Samples) == 0 {
		return echo.NewHTTPError(http.StatusBadRequest, "daftar sample kosong")
	}

	count, err := h.repo.CreateBulk(c.Request().Context(), req.Samples)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"count":   count,
		"message": fmt.Sprintf("Berhasil menambahkan/memperbarui %d sample", count),
	})
}

// Update modifies sample details
func (h *SampleHandler) Update(c echo.Context) error {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid sample id")
	}

	var s model.Sample
	if err := c.Bind(&s); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid sample data")
	}
	s.ID = id

	if err := h.repo.Update(c.Request().Context(), &s); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, s)
}

// Delete soft deletes a sample
func (h *SampleHandler) Delete(c echo.Context) error {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid sample id")
	}

	if err := h.repo.Delete(c.Request().Context(), id); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Sample berhasil dihapus",
	})
}
