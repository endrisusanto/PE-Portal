package handler

import (
	"net/http"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"

	"pe-portal/internal/repository"
)

type GroupHandler struct {
	groupRepo *repository.GroupRepository
}

func NewGroupHandler(groupRepo *repository.GroupRepository) *GroupHandler {
	return &GroupHandler{groupRepo: groupRepo}
}

func (h *GroupHandler) ListGroups(c echo.Context) error {
	groups, err := h.groupRepo.ListAll(c.Request().Context())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, groups)
}

func (h *GroupHandler) ListByParent(c echo.Context) error {
	parent := c.Param("parentGroup")
	groups, err := h.groupRepo.ListByParentGroup(c.Request().Context(), parent)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, groups)
}

func (h *GroupHandler) GetGroup(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid group id")
	}

	g, err := h.groupRepo.GetByID(c.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "group part not found")
	}
	return c.JSON(http.StatusOK, g)
}
