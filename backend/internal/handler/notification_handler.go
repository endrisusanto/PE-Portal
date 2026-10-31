package handler

import (
	"net/http"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"

	"pe-portal/internal/service"
)

type NotificationHandler struct {
	toolJobService *service.ToolJobService
}

func NewNotificationHandler(toolJobService *service.ToolJobService) *NotificationHandler {
	return &NotificationHandler{
		toolJobService: toolJobService,
	}
}

// GetSummary returns unified notification payload: prioritized tools progress at the top + system change logs
func (h *NotificationHandler) GetSummary(c echo.Context) error {
	var userID *uuid.UUID
	if uidVal := c.Get("user_id"); uidVal != nil {
		if uidStr, ok := uidVal.(string); ok && uidStr != "" {
			if u, err := uuid.Parse(uidStr); err == nil {
				userID = &u
			}
		}
	}

	summary, err := h.toolJobService.GetNotificationSummary(c.Request().Context(), userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"message": "Gagal mengambil ringkasan notifikasi: " + err.Error(),
		})
	}

	return c.JSON(http.StatusOK, summary)
}

