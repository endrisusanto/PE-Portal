package handler

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"pe-portal/internal/model"
	"pe-portal/internal/repository"
)

type TrainingHandler struct {
	repo        *repository.TrainingRepository
	navRepo     *repository.NavigationRepository
	storagePath string
}

func NewTrainingHandler(repo *repository.TrainingRepository, navRepo *repository.NavigationRepository, storagePath string) *TrainingHandler {
	return &TrainingHandler{repo: repo, navRepo: navRepo, storagePath: storagePath}
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

	// Verify Dynamic Access Control for training-answer-key
	if h.navRepo != nil {
		if perm, err := h.navRepo.GetMenuPermissionByKey(c.Request().Context(), "training-answer-key"); err == nil && perm != nil {
			roleVal := c.Get("user_role")
			userRole, _ := roleVal.(string)

			// Admins always have bypass access
			if userRole != "admin" {
				if !perm.IsVisible {
					return c.JSON(http.StatusForbidden, map[string]interface{}{
						"success": false,
						"error":   "Akses kunci jawaban dinonaktifkan oleh administrator.",
					})
				}

				claimsVal := c.Get("user_claims")
				var username, userIDStr string
				if claims, ok := claimsVal.(*model.UserClaims); ok && claims != nil {
					username = claims.Username
					userIDStr = claims.UserID.String()
				}

				// Check specific user restriction if configured
				if len(perm.AllowedUsers) > 0 {
					matchedUser := false
					for _, u := range perm.AllowedUsers {
						uNorm := strings.ToLower(strings.TrimSpace(u))
						if uNorm != "" && (uNorm == strings.ToLower(username) || uNorm == strings.ToLower(userIDStr)) {
							matchedUser = true
							break
						}
					}
					if !matchedUser {
						return c.JSON(http.StatusForbidden, map[string]interface{}{
							"success": false,
							"error":   "Akses kunci jawaban dibatasi hanya untuk user tertentu yang diizinkan oleh admin.",
						})
					}
				}

				// Check role restriction if configured
				if len(perm.AllowedRoles) > 0 {
					matchedRole := false
					for _, r := range perm.AllowedRoles {
						if strings.EqualFold(r, userRole) {
							matchedRole = true
							break
						}
					}
					if !matchedRole {
						return c.JSON(http.StatusForbidden, map[string]interface{}{
							"success": false,
							"error":   "Role Anda tidak memiliki izin untuk melihat kunci jawaban.",
						})
					}
				}
			}
		}
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

// UploadAsset saves an uploaded training banner or answer key image
func (h *TrainingHandler) UploadAsset(c echo.Context) error {
	file, err := c.FormFile("file")
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "No image file provided")
	}

	src, err := file.Open()
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to open uploaded file")
	}
	defer src.Close()

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext != ".png" && ext != ".jpg" && ext != ".jpeg" && ext != ".webp" && ext != ".gif" {
		return echo.NewHTTPError(http.StatusBadRequest, "Only image files (PNG, JPG, JPEG, WEBP, GIF) are allowed")
	}

	trainingsDir := filepath.Join(h.storagePath, "trainings")
	_ = os.MkdirAll(trainingsDir, 0755)

	storedName := fmt.Sprintf("%d_%s", time.Now().UnixNano(), filepath.Base(file.Filename))
	dstPath := filepath.Join(trainingsDir, storedName)

	dst, err := os.Create(dstPath)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create destination file")
	}
	defer dst.Close()

	if _, err := io.Copy(dst, src); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to save file")
	}

	assetURL := fmt.Sprintf("/api/v1/trainings/assets/%s", storedName)
	return c.JSON(http.StatusOK, map[string]string{
		"url":      assetURL,
		"filename": storedName,
	})
}

// ServeAsset streams the training asset file
func (h *TrainingHandler) ServeAsset(c echo.Context) error {
	filename := filepath.Base(c.Param("filename"))
	filePath := filepath.Join(h.storagePath, "trainings", filename)

	if _, err := os.Stat(filePath); err != nil {
		// Fallback to frontend public training-assets if present
		fallbackPath := filepath.Join("frontend", "public", "training-assets", filename)
		if _, errF := os.Stat(fallbackPath); errF == nil {
			return c.File(fallbackPath)
		}
		fallbackPath2 := filepath.Join("..", "frontend", "public", "training-assets", filename)
		if _, errF2 := os.Stat(fallbackPath2); errF2 == nil {
			return c.File(fallbackPath2)
		}
		return echo.NewHTTPError(http.StatusNotFound, "Asset not found")
	}

	return c.File(filePath)
}
