package handler

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"

	"pe-portal/internal/model"
	"pe-portal/internal/repository"
)

type SettingsHandler struct {
	settingsRepo *repository.SettingsRepository
	pool         *pgxpool.Pool
}

func NewSettingsHandler(settingsRepo *repository.SettingsRepository, pool *pgxpool.Pool) *SettingsHandler {
	return &SettingsHandler{settingsRepo: settingsRepo, pool: pool}
}

func (h *SettingsHandler) GetAuthConfig(c echo.Context) error {
	cfg, err := h.settingsRepo.GetAuthConfig(c.Request().Context())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, cfg)
}

func (h *SettingsHandler) UpdateAuthConfig(c echo.Context) error {
	var cfg model.AuthConfig
	if err := c.Bind(&cfg); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid input")
	}

	if err := h.settingsRepo.UpdateAuthConfig(c.Request().Context(), &cfg); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "auth config updated successfully"})
}

func (h *SettingsHandler) ListAuditLogs(c echo.Context) error {
	logs, err := h.settingsRepo.ListAuditLogs(c.Request().Context(), 50)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, logs)
}

// DashboardStats returns aggregated real counts from PostgreSQL
type DashboardStatsResponse struct {
	ProjectsCount    int              `json:"projects_count"`
	InnovationsCount int              `json:"innovations_count"`
	ModelsCount      int              `json:"models_count"`
	DocumentsCount   int              `json:"documents_count"`
	UsersCount       int              `json:"users_count"`
	RecentLogs       []model.AuditLog `json:"recent_logs"`
}

func (h *SettingsHandler) DashboardStats(c echo.Context) error {
	ctx := c.Request().Context()

	var stats DashboardStatsResponse

	_ = h.pool.QueryRow(ctx, "SELECT COUNT(*) FROM projects WHERE deleted_at IS NULL").Scan(&stats.ProjectsCount)
	_ = h.pool.QueryRow(ctx, "SELECT COUNT(*) FROM innovations WHERE deleted_at IS NULL").Scan(&stats.InnovationsCount)
	_ = h.pool.QueryRow(ctx, "SELECT COUNT(*) FROM new_models WHERE deleted_at IS NULL").Scan(&stats.ModelsCount)
	_ = h.pool.QueryRow(ctx, "SELECT COUNT(*) FROM documents WHERE deleted_at IS NULL").Scan(&stats.DocumentsCount)
	_ = h.pool.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE deleted_at IS NULL").Scan(&stats.UsersCount)

	logs, err := h.settingsRepo.ListAuditLogs(ctx, 10)
	if err == nil {
		stats.RecentLogs = logs
	} else {
		stats.RecentLogs = []model.AuditLog{}
	}

	return c.JSON(http.StatusOK, stats)
}
