package handler

import (
	"net/http"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"

	"pe-portal/internal/auth"
	"pe-portal/internal/middleware"
	"pe-portal/internal/model"
	"pe-portal/internal/repository"
)

type AuthHandler struct {
	authProvider auth.AuthProvider
	jwtService   *auth.JWTService
	userRepo     *repository.UserRepository
}

func NewAuthHandler(authProvider auth.AuthProvider, jwtService *auth.JWTService, userRepo *repository.UserRepository) *AuthHandler {
	return &AuthHandler{
		authProvider: authProvider,
		jwtService:   jwtService,
		userRepo:     userRepo,
	}
}

// SetAuthProvider allows dynamically updating the active provider (e.g., local <-> ldap)
func (h *AuthHandler) SetAuthProvider(provider auth.AuthProvider) {
	h.authProvider = provider
}

// Login handles user authentication via the configured AuthProvider
func (h *AuthHandler) Login(c echo.Context) error {
	var req model.LoginRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	if req.Username == "" || req.Password == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "username and password are required")
	}

	user, err := h.authProvider.Authenticate(c.Request().Context(), req.Username, req.Password)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, err.Error())
	}

	accessToken, refreshToken, err := h.jwtService.GenerateTokens(user)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to issue authentication tokens")
	}

	return c.JSON(http.StatusOK, model.LoginResponse{
		Token:        accessToken,
		RefreshToken: refreshToken,
		User:         *user,
	})
}

// Refresh issues a fresh access token given a valid refresh token
func (h *AuthHandler) Refresh(c echo.Context) error {
	var req model.RefreshRequest
	if err := c.Bind(&req); err != nil || req.RefreshToken == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "refresh_token is required")
	}

	claims, err := h.jwtService.ValidateToken(req.RefreshToken)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "invalid or expired refresh token")
	}

	user, err := h.userRepo.GetByID(c.Request().Context(), claims.UserID)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "user account not found")
	}

	accessToken, newRefreshToken, err := h.jwtService.GenerateTokens(user)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to renew tokens")
	}

	return c.JSON(http.StatusOK, model.LoginResponse{
		Token:        accessToken,
		RefreshToken: newRefreshToken,
		User:         *user,
	})
}

// Me returns the profile of the currently authenticated user
func (h *AuthHandler) Me(c echo.Context) error {
	userIDVal := c.Get(middleware.ContextKeyUserID)
	if userIDVal == nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "unauthenticated")
	}

	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		return echo.NewHTTPError(http.StatusUnauthorized, "invalid user id in context")
	}

	user, err := h.userRepo.GetByID(c.Request().Context(), userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "user profile not found")
	}

	return c.JSON(http.StatusOK, user)
}

// Logout terminates current session
// ponytail: client discards JWT; server returns success confirmation
func (h *AuthHandler) Logout(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]string{"message": "logged out successfully"})
}
