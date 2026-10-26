package handler

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"

	"pe-portal/internal/middleware"
	"pe-portal/internal/model"
	"pe-portal/internal/repository"
	"pe-portal/internal/service"
	"github.com/google/uuid"
)

type SettingsHandler struct {
	settingsRepo *repository.SettingsRepository
	docRepo      *repository.DocumentRepository
	pool         *pgxpool.Pool
	datahubSvc   *service.DataHubService
}

func NewSettingsHandler(settingsRepo *repository.SettingsRepository, docRepo *repository.DocumentRepository, pool *pgxpool.Pool, datahubSvc *service.DataHubService) *SettingsHandler {
	return &SettingsHandler{settingsRepo: settingsRepo, docRepo: docRepo, pool: pool, datahubSvc: datahubSvc}
}

func (h *SettingsHandler) GetDataHubConfig(c echo.Context) error {
	cfg, err := h.settingsRepo.GetDataHubConfig(c.Request().Context())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, cfg)
}

func (h *SettingsHandler) UpdateDataHubConfig(c echo.Context) error {
	var cfg model.DataHubConfig
	if err := c.Bind(&cfg); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid input")
	}

	if uidVal := c.Get(middleware.ContextKeyUserID); uidVal != nil {
		if uid, ok := uidVal.(uuid.UUID); ok {
			cfg.UpdatedBy = &uid
		}
	}

	if err := h.settingsRepo.UpdateDataHubConfig(c.Request().Context(), &cfg); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"message": "DataHub config updated successfully",
		"config":  cfg,
	})
}

func (h *SettingsHandler) TestDataHubConnection(c echo.Context) error {
	var req struct {
		APIURL string `json:"api_url"`
		APIKey string `json:"api_key"`
	}
	_ = c.Bind(&req)

	if h.datahubSvc != nil {
		res, err := h.datahubSvc.TestConnection(c.Request().Context(), req.APIURL, req.APIKey)
		if err != nil {
			return c.JSON(http.StatusOK, map[string]interface{}{
				"success": false,
				"message": err.Error(),
			})
		}
		return c.JSON(http.StatusOK, map[string]interface{}{
			"success": true,
			"message": "Connected to Samsung DataHub endpoint successfully",
			"data":    res,
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "DataHub service ready",
	})
}

// ponytail: TriggerDataHubWatchScan performs an on-demand scan and upload of the local watch folder
func (h *SettingsHandler) TriggerDataHubWatchScan(c echo.Context) error {
	if h.datahubSvc == nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "datahub service is not initialized")
	}

	res, err := h.datahubSvc.ScanAndUploadWatchFolder(c.Request().Context(), h.docRepo)
	if err != nil {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"success": false,
			"message": err.Error(),
			"data":    res,
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Watch folder scan completed",
		"data":    res,
	})
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
	TrainingsCount   int              `json:"trainings_count"`
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
	_ = h.pool.QueryRow(ctx, "SELECT COUNT(*) FROM training_modules").Scan(&stats.TrainingsCount)
	_ = h.pool.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE deleted_at IS NULL").Scan(&stats.UsersCount)

	logs, err := h.settingsRepo.ListAuditLogs(ctx, 10)
	if err == nil {
		stats.RecentLogs = logs
	} else {
		stats.RecentLogs = []model.AuditLog{}
	}

	return c.JSON(http.StatusOK, stats)
}
