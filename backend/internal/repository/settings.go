package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"pe-portal/internal/model"
)

type SettingsRepository struct {
	pool *pgxpool.Pool
}

func NewSettingsRepository(pool *pgxpool.Pool) *SettingsRepository {
	return &SettingsRepository{pool: pool}
}

func (r *SettingsRepository) GetAuthConfig(ctx context.Context) (*model.AuthConfig, error) {
	query := `
		SELECT id, provider, ldap_host, ldap_port, ldap_base_dn, ldap_bind_dn,
		       ldap_user_filter, ldap_use_tls, is_active, updated_at
		FROM auth_config
		ORDER BY created_at DESC
		LIMIT 1
	`
	var cfg model.AuthConfig
	err := r.pool.QueryRow(ctx, query).Scan(
		&cfg.ID, &cfg.Provider, &cfg.LDAPHost, &cfg.LDAPPort, &cfg.LDAPBaseDN, &cfg.LDAPBindDN,
		&cfg.LDAPUserFilter, &cfg.LDAPUseTLS, &cfg.IsActive, &cfg.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &cfg, nil
}

func (r *SettingsRepository) UpdateAuthConfig(ctx context.Context, cfg *model.AuthConfig) error {
	query := `
		UPDATE auth_config
		SET provider = $1, ldap_host = $2, ldap_port = $3, ldap_base_dn = $4,
		    ldap_bind_dn = $5, ldap_bind_password = COALESCE($6, ldap_bind_password),
		    ldap_user_filter = $7, ldap_use_tls = $8, is_active = $9, updated_at = NOW()
		WHERE id = $10
	`
	_, err := r.pool.Exec(ctx, query,
		cfg.Provider, cfg.LDAPHost, cfg.LDAPPort, cfg.LDAPBaseDN,
		cfg.LDAPBindDN, cfg.LDAPBindPassword, cfg.LDAPUserFilter, cfg.LDAPUseTLS,
		cfg.IsActive, cfg.ID,
	)
	return err
}

func (r *SettingsRepository) ListAuditLogs(ctx context.Context, limit int) ([]model.AuditLog, error) {
	if limit <= 0 {
		limit = 50
	}
	query := `
		SELECT a.id, a.user_id, u.full_name as user_name, a.action,
		       a.entity_type, a.entity_id, a.details, COALESCE(host(a.ip_address), a.ip_address::text, ''), a.created_at
		FROM audit_logs a
		LEFT JOIN users u ON a.user_id = u.id
		ORDER BY a.created_at DESC
		LIMIT $1
	`
	rows, err := r.pool.Query(ctx, query, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to list audit logs: %w", err)
	}
	defer rows.Close()

	logs := []model.AuditLog{}
	for rows.Next() {
		var l model.AuditLog
		err := rows.Scan(
			&l.ID, &l.UserID, &l.UserName, &l.Action,
			&l.EntityType, &l.EntityID, &l.Details, &l.IPAddress, &l.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		logs = append(logs, l)
	}
	return logs, nil
}

func (r *SettingsRepository) GetDataHubConfig(ctx context.Context) (*model.DataHubConfig, error) {
	query := `
		SELECT id, api_url, api_key, default_project_id, default_folder_id,
		       COALESCE(watch_folder_path, '/data/files/datahub_watch') as watch_folder_path,
		       COALESCE(auto_upload_enabled, false) as auto_upload_enabled,
		       last_watch_scan_at, is_active, updated_by, created_at, updated_at
		FROM datahub_configs
		ORDER BY created_at DESC
		LIMIT 1
	`
	var cfg model.DataHubConfig
	err := r.pool.QueryRow(ctx, query).Scan(
		&cfg.ID, &cfg.APIURL, &cfg.APIKey, &cfg.DefaultProjectID, &cfg.DefaultFolderID,
		&cfg.WatchFolderPath, &cfg.AutoUploadEnabled, &cfg.LastWatchScanAt,
		&cfg.IsActive, &cfg.UpdatedBy, &cfg.CreatedAt, &cfg.UpdatedAt,
	)
	if err != nil {
		return &model.DataHubConfig{
			APIURL:            "https://datahub-api.bigdata.samsung.com",
			DefaultProjectID:  "PE_PORTAL",
			WatchFolderPath:   "/data/files/datahub_watch",
			AutoUploadEnabled: false,
			IsActive:          true,
		}, nil
	}
	return &cfg, nil
}

func (r *SettingsRepository) UpdateDataHubConfig(ctx context.Context, cfg *model.DataHubConfig) error {
	if cfg.WatchFolderPath == "" {
		cfg.WatchFolderPath = "/data/files/datahub_watch"
	}
	query := `
		UPDATE datahub_configs
		SET api_url = $1, api_key = $2, default_project_id = $3,
		    default_folder_id = $4, watch_folder_path = $5, auto_upload_enabled = $6,
		    is_active = $7, updated_by = $8, updated_at = NOW()
		WHERE id = (SELECT id FROM datahub_configs ORDER BY created_at DESC LIMIT 1)
	`
	tag, err := r.pool.Exec(ctx, query,
		cfg.APIURL, cfg.APIKey, cfg.DefaultProjectID, cfg.DefaultFolderID,
		cfg.WatchFolderPath, cfg.AutoUploadEnabled,
		cfg.IsActive, cfg.UpdatedBy,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		insertQuery := `
			INSERT INTO datahub_configs (api_url, api_key, default_project_id, default_folder_id, watch_folder_path, auto_upload_enabled, is_active, updated_by)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		`
		_, err = r.pool.Exec(ctx, insertQuery,
			cfg.APIURL, cfg.APIKey, cfg.DefaultProjectID, cfg.DefaultFolderID,
			cfg.WatchFolderPath, cfg.AutoUploadEnabled,
			cfg.IsActive, cfg.UpdatedBy,
		)
		return err
	}
	return nil
}

func (r *SettingsRepository) UpdateDataHubScanTime(ctx context.Context) error {
	query := `
		UPDATE datahub_configs
		SET last_watch_scan_at = NOW(), updated_at = NOW()
		WHERE id = (SELECT id FROM datahub_configs ORDER BY created_at DESC LIMIT 1)
	`
	_, err := r.pool.Exec(ctx, query)
	return err
}

