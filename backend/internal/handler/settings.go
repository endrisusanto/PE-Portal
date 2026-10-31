package handler

import (
	"crypto/tls"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-ldap/ldap/v3"
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

type TestLDAPRequest struct {
	Host         string `json:"ldap_host"`
	Port         int    `json:"ldap_port"`
	BaseDN       string `json:"ldap_base_dn"`
	BindDN       string `json:"ldap_bind_dn"`
	BindPassword string `json:"ldap_bind_password"`
	UserFilter   string `json:"ldap_user_filter"`
	UseTLS       bool   `json:"ldap_use_tls"`
}

// TestLDAPConnection tests TCP connectivity and service bind credentials against Corporate Active Directory
func (h *SettingsHandler) TestLDAPConnection(c echo.Context) error {
	var req TestLDAPRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request")
	}

	if req.Host == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Host / IP server LDAP wajib diisi")
	}

	if req.Port <= 0 {
		req.Port = 389
	}

	// If bind password is blank in test request, try using saved bind password from database
	if req.BindPassword == "" && req.BindDN != "" {
		var savedPass *string
		_ = h.pool.QueryRow(c.Request().Context(), "SELECT ldap_bind_password FROM auth_config WHERE is_active = true ORDER BY updated_at DESC LIMIT 1").Scan(&savedPass)
		if savedPass != nil {
			req.BindPassword = *savedPass
		}
	}

	addr := fmt.Sprintf("%s:%d", req.Host, req.Port)
	var conn *ldap.Conn
	var err error

	if req.UseTLS || req.Port == 636 {
		conn, err = ldap.DialTLS("tcp", addr, &tls.Config{InsecureSkipVerify: true})
	} else {
		conn, err = ldap.Dial("tcp", addr)
	}

	if err != nil {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"success": false,
			"message": fmt.Sprintf("Gagal terhubung ke host LDAP (%s): %v", addr, err),
		})
	}
	defer conn.Close()

	if req.BindDN != "" {
		if err := conn.Bind(req.BindDN, req.BindPassword); err != nil {
			return c.JSON(http.StatusOK, map[string]interface{}{
				"success": false,
				"message": fmt.Sprintf("Koneksi berhasil tetapi service bind akun (%s) ditolak: %v", req.BindDN, err),
			})
		}
	}

	if req.BaseDN != "" {
		searchReq := ldap.NewSearchRequest(
			req.BaseDN,
			ldap.ScopeBaseObject, ldap.NeverDerefAliases, 1, 5, false,
			"(objectClass=*)",
			[]string{"dn"},
			nil,
		)
		if _, err := conn.Search(searchReq); err != nil {
			return c.JSON(http.StatusOK, map[string]interface{}{
				"success": false,
				"message": fmt.Sprintf("Koneksi & Bind berhasil, namun verifikasi Base DN (%s) gagal: %v", req.BaseDN, err),
			})
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"message": fmt.Sprintf("Koneksi ke Active Directory ADCORP (%s) dan Service Bind berhasil diverifikasi!", addr),
	})
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

// BrowseDirectories lists subdirectories within a given server filesystem path for the folder picker modal
func (h *SettingsHandler) BrowseDirectories(c echo.Context) error {
	requestedPath := strings.TrimSpace(c.QueryParam("path"))
	if requestedPath == "" {
		if cfg, err := h.settingsRepo.GetDataHubConfig(c.Request().Context()); err == nil && cfg != nil && cfg.WatchFolderPath != "" {
			requestedPath = cfg.WatchFolderPath
		} else {
			requestedPath = "/data/files"
		}
	}

	cleanPath := filepath.Clean(requestedPath)
	info, err := os.Stat(cleanPath)
	if err != nil || !info.IsDir() {
		parent := filepath.Dir(cleanPath)
		if pInfo, pErr := os.Stat(parent); pErr == nil && pInfo.IsDir() {
			cleanPath = parent
		} else {
			cleanPath = "/data/files"
			if _, dErr := os.Stat(cleanPath); dErr != nil {
				cleanPath = "/"
			}
		}
	}

	entries, err := os.ReadDir(cleanPath)
	if err != nil {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"current_path": cleanPath,
			"parent_path":  filepath.Dir(cleanPath),
			"directories":  []map[string]interface{}{},
			"error":        err.Error(),
		})
	}

	dirs := make([]map[string]interface{}, 0)
	for _, entry := range entries {
		if entry.IsDir() && !strings.HasPrefix(entry.Name(), ".") {
			dirs = append(dirs, map[string]interface{}{
				"name": entry.Name(),
				"path": filepath.Join(cleanPath, entry.Name()),
			})
		}
	}

	parentPath := filepath.Dir(cleanPath)
	if cleanPath == "/" {
		parentPath = ""
	}

	quickRoots := []map[string]string{
		{"label": "Watch Folder (/data/files/datahub_watch)", "path": "/data/files/datahub_watch"},
		{"label": "File Storage (/data/files)", "path": "/data/files"},
		{"label": "App Root (/app)", "path": "/app"},
		{"label": "System Root (/)", "path": "/"},
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"current_path": cleanPath,
		"parent_path":  parentPath,
		"directories":  dirs,
		"quick_roots":  quickRoots,
	})
}

// CreateDirectory creates a folder on the server if it doesn't already exist
func (h *SettingsHandler) CreateDirectory(c echo.Context) error {
	var req struct {
		Path string `json:"path"`
	}
	if err := c.Bind(&req); err != nil || strings.TrimSpace(req.Path) == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "path is required")
	}

	cleanPath := filepath.Clean(strings.TrimSpace(req.Path))
	if err := os.MkdirAll(cleanPath, 0755); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to create directory: "+err.Error())
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"message": "directory created successfully",
		"path":    cleanPath,
	})
}

