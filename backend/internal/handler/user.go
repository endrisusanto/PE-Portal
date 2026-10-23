package handler

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"

	"pe-portal/internal/middleware"
	"pe-portal/internal/model"
	"pe-portal/internal/repository"
)

type UserHandler struct {
	userRepo    *repository.UserRepository
	storagePath string
}

func NewUserHandler(userRepo *repository.UserRepository, storagePath string) *UserHandler {
	_ = os.MkdirAll(filepath.Join(storagePath, "avatars"), 0755)
	return &UserHandler{userRepo: userRepo, storagePath: storagePath}
}

func (h *UserHandler) ListUsers(c echo.Context) error {
	var groupID *uuid.UUID
	if gStr := c.QueryParam("group_id"); gStr != "" {
		if id, err := uuid.Parse(gStr); err == nil {
			groupID = &id
		}
	}
	role := c.QueryParam("role")

	users, err := h.userRepo.ListUsers(c.Request().Context(), groupID, role)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, users)
}

func (h *UserHandler) GetUser(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid user id")
	}

	user, err := h.userRepo.GetByID(c.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "user not found")
	}
	return c.JSON(http.StatusOK, user)
}

type CreateUserRequest struct {
	EmployeeID    string      `json:"employee_id"`
	Username      string      `json:"username"`
	Email         string      `json:"email"`
	Password      string      `json:"password"`
	FullName      string      `json:"full_name"`
	GroupPartID   *uuid.UUID  `json:"group_part_id"`
	GroupPartIDs  []uuid.UUID `json:"group_part_ids"`
	Role          string      `json:"role"`
	PreferredLang string      `json:"preferred_lang"`
}

func (h *UserHandler) CreateUser(c echo.Context) error {
	var req CreateUserRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid input")
	}

	if req.Username == "" || req.Email == "" || req.FullName == "" || req.EmployeeID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "employee_id, username, email, and full_name are required")
	}

	groupPartIDs := req.GroupPartIDs
	groupPartID := req.GroupPartID
	if len(groupPartIDs) > 0 && groupPartID == nil {
		groupPartID = &groupPartIDs[0]
	} else if groupPartID != nil && len(groupPartIDs) == 0 {
		groupPartIDs = []uuid.UUID{*groupPartID}
	}

	user := model.User{
		EmployeeID:    req.EmployeeID,
		Username:      req.Username,
		Email:         req.Email,
		FullName:      req.FullName,
		GroupPartID:   groupPartID,
		GroupPartIDs:  groupPartIDs,
		Role:          req.Role,
		PreferredLang: req.PreferredLang,
	}

	created, err := h.userRepo.CreateUser(c.Request().Context(), &user, req.Password)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusCreated, created)
}

type UpdateUserRequest struct {
	EmployeeID   string      `json:"employee_id"`
	Email        string      `json:"email"`
	FullName     string      `json:"full_name"`
	GroupPartID  *uuid.UUID  `json:"group_part_id"`
	GroupPartIDs []uuid.UUID `json:"group_part_ids"`
	Role         string      `json:"role"`
	IsActive     bool        `json:"is_active"`
	NewPassword  string      `json:"new_password,omitempty"`
}

func (h *UserHandler) UpdateUser(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid user id")
	}

	var req UpdateUserRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid input")
	}

	groupPartIDs := req.GroupPartIDs
	groupPartID := req.GroupPartID
	if len(groupPartIDs) > 0 && groupPartID == nil {
		groupPartID = &groupPartIDs[0]
	} else if groupPartID != nil && len(groupPartIDs) == 0 {
		groupPartIDs = []uuid.UUID{*groupPartID}
	}

	user := model.User{
		ID:           id,
		EmployeeID:   req.EmployeeID,
		Email:        req.Email,
		FullName:     req.FullName,
		GroupPartID:  groupPartID,
		GroupPartIDs: groupPartIDs,
		Role:         req.Role,
		IsActive:     req.IsActive,
	}

	updated, err := h.userRepo.UpdateUser(c.Request().Context(), &user, req.NewPassword)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, updated)
}

type PreferencesRequest struct {
	FullName      string  `json:"full_name"`
	PreferredLang string  `json:"preferred_lang"`
	AvatarPath    *string `json:"avatar_path"`
}

func (h *UserHandler) UpdatePreferences(c echo.Context) error {
	userIDVal := c.Get(middleware.ContextKeyUserID)
	if userIDVal == nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "unauthenticated")
	}
	userID := userIDVal.(uuid.UUID)

	var req PreferencesRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid input")
	}

	if err := h.userRepo.UpdatePreferences(c.Request().Context(), userID, req.FullName, req.PreferredLang, req.AvatarPath); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	user, err := h.userRepo.GetByID(c.Request().Context(), userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, user)
}

// UploadAvatar handles avatar image uploads for the authenticated user
func (h *UserHandler) UploadAvatar(c echo.Context) error {
	userIDVal := c.Get(middleware.ContextKeyUserID)
	if userIDVal == nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "unauthenticated")
	}
	userID := userIDVal.(uuid.UUID)

	file, err := c.FormFile("avatar")
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "no avatar file provided")
	}

	src, err := file.Open()
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to open avatar file")
	}
	defer src.Close()

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".webp" {
		ext = ".png"
	}

	avatarDir := filepath.Join(h.storagePath, "avatars")
	_ = os.MkdirAll(avatarDir, 0755)

	storedFileName := fmt.Sprintf("%s_%d%s", userID.String(), time.Now().Unix(), ext)
	dstPath := filepath.Join(avatarDir, storedFileName)

	dst, err := os.Create(dstPath)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to save avatar file")
	}
	defer dst.Close()

	if _, err := io.Copy(dst, src); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to write avatar file")
	}

	avatarURL := fmt.Sprintf("/api/v1/users/avatar/%s", storedFileName)
	if err := h.userRepo.UpdatePreferences(c.Request().Context(), userID, "", "", &avatarURL); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	user, err := h.userRepo.GetByID(c.Request().Context(), userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, user)
}

// ServeAvatar serves user avatar images
func (h *UserHandler) ServeAvatar(c echo.Context) error {
	fileName := filepath.Base(c.Param("filename"))
	filePath := filepath.Join(h.storagePath, "avatars", fileName)
	return c.File(filePath)
}

func (h *UserHandler) UpdateRole(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid user id")
	}

	var req struct {
		Role string `json:"role"`
	}
	if err := c.Bind(&req); err != nil || req.Role == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "role is required")
	}

	if err := h.userRepo.UpdateRole(c.Request().Context(), id, req.Role); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "role updated successfully"})
}

func (h *UserHandler) DeleteUser(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid user id")
	}

	if err := h.userRepo.DeleteUser(c.Request().Context(), id); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "user deleted successfully"})
}
