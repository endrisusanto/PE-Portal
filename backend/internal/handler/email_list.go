package handler

import (
	"net/http"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"

	"pe-portal/internal/middleware"
	"pe-portal/internal/model"
	"pe-portal/internal/repository"
)

type EmailListHandler struct {
	repo *repository.EmailListRepository
}

func NewEmailListHandler(repo *repository.EmailListRepository) *EmailListHandler {
	return &EmailListHandler{repo: repo}
}

type CreateEmailListRequest struct {
	Name        string `json:"name"`
	Emails      string `json:"emails"`
	Description string `json:"description"`
}

// GetEmailLists lists all email lists belonging to the current user
func (h *EmailListHandler) GetEmailLists(c echo.Context) error {
	val := c.Get(middleware.ContextKeyUserID)
	if val == nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized")
	}
	userID := val.(uuid.UUID)
	if userID == uuid.Nil {
		return c.JSON(http.StatusOK, []model.UserEmailList{})
	}

	lists, err := h.repo.GetByUserID(c.Request().Context(), userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch email lists: "+err.Error())
	}
	if lists == nil {
		lists = []model.UserEmailList{}
	}
	return c.JSON(http.StatusOK, lists)
}

// CreateEmailList adds a new recipient group for the current user
func (h *EmailListHandler) CreateEmailList(c echo.Context) error {
	val := c.Get(middleware.ContextKeyUserID)
	if val == nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized")
	}
	userID := val.(uuid.UUID)

	var req CreateEmailListRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body")
	}
	if req.Name == "" || req.Emails == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Name and emails are required")
	}

	newList := &model.UserEmailList{
		UserID:      userID,
		Name:        req.Name,
		Emails:      req.Emails,
		Description: req.Description,
	}

	created, err := h.repo.Create(c.Request().Context(), newList)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create email list: "+err.Error())
	}

	return c.JSON(http.StatusCreated, created)
}

// DeleteEmailList removes an email list
func (h *EmailListHandler) DeleteEmailList(c echo.Context) error {
	val := c.Get(middleware.ContextKeyUserID)
	if val == nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized")
	}
	userID := val.(uuid.UUID)

	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid list ID")
	}

	if err := h.repo.Delete(c.Request().Context(), id, userID); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to delete email list: "+err.Error())
	}

	return c.NoContent(http.StatusNoContent)
}
