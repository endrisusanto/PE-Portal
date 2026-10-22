package handler

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"pe-portal/internal/model"
	"pe-portal/internal/repository"
)

type NavigationHandler struct {
	navRepo *repository.NavigationRepository
}

func NewNavigationHandler(navRepo *repository.NavigationRepository) *NavigationHandler {
	return &NavigationHandler{navRepo: navRepo}
}

// GetMenuPermissions returns all menu permission configurations
func (h *NavigationHandler) GetMenuPermissions(c echo.Context) error {
	perms, err := h.navRepo.ListMenuPermissions(c.Request().Context())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, perms)
}

// UpdateMenuPermission modifies visibility and role/group access for a single menu
func (h *NavigationHandler) UpdateMenuPermission(c echo.Context) error {
	menuKey := c.Param("key")
	if menuKey == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "menu key is required")
	}

	var req model.UpdateMenuPermissionRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	updated, err := h.navRepo.UpdateMenuPermission(c.Request().Context(), menuKey, req)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, updated)
}

// BatchUpdateMenuPermissions updates multiple menu configurations simultaneously
func (h *NavigationHandler) BatchUpdateMenuPermissions(c echo.Context) error {
	var perms []model.MenuPermission
	if err := c.Bind(&perms); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	if err := h.navRepo.BatchUpdateMenuPermissions(c.Request().Context(), perms); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "menu permissions updated successfully",
	})
}
