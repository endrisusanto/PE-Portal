package database

import (
	"context"
	"fmt"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"pe-portal/migrations"
)

// PostgresPool wraps the pgxpool.Pool
type PostgresPool struct {
	Pool *pgxpool.Pool
}

// ConnectPostgres establishes a connection pool to PostgreSQL
func ConnectPostgres(connString string) (*PostgresPool, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	config, err := pgxpool.ParseConfig(connString)
	if err != nil {
		return nil, fmt.Errorf("failed to parse database config: %w", err)
	}

	config.MaxConns = 25
	config.MinConns = 2
	config.MaxConnLifetime = 1 * time.Hour
	config.MaxConnIdleTime = 15 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	log.Println("[DB] Connected to PostgreSQL successfully")
	return &PostgresPool{Pool: pool}, nil
}

// RunMigrations executes SQL migration files once using schema_migrations tracker
func (p *PostgresPool) RunMigrations(migrationsDir string) error {
	ctx := context.Background()

	// Ensure migration tracking table exists
	if _, err := p.Pool.Exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(100) PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW());`); err != nil {
		return fmt.Errorf("failed to create schema_migrations table: %w", err)
	}

	// 1. Discover all migration files dynamically from embedded FS
	var files []string
	if entries, err := fs.ReadDir(migrations.FS, "."); err == nil && len(entries) > 0 {
		for _, e := range entries {
			if !e.IsDir() && strings.HasSuffix(e.Name(), ".sql") {
				files = append(files, e.Name())
			}
		}
	}

	// 2. Fallback to filesystem lookup if embedded FS had no files
	if len(files) == 0 {
		for _, dir := range []string{migrationsDir, filepath.Join("..", migrationsDir), filepath.Join("backend", "migrations")} {
			if entries, err := os.ReadDir(dir); err == nil && len(entries) > 0 {
				for _, e := range entries {
					if !e.IsDir() && strings.HasSuffix(e.Name(), ".sql") {
						files = append(files, e.Name())
					}
				}
				if len(files) > 0 {
					migrationsDir = dir
					break
				}
			}
		}
	}

	sort.Strings(files)
	for _, file := range files {
		var alreadyApplied bool
		if err := p.Pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1)", file).Scan(&alreadyApplied); err == nil && alreadyApplied {
			continue // Migration already applied, skip
		}

		var content []byte
		var err error

		// 1. Try embedded migration FS first (failsafe against working-directory path issues)
		content, err = migrations.FS.ReadFile(file)
		if err != nil {
			// 2. Fallback to filesystem lookup
			path := filepath.Join(migrationsDir, file)
			content, err = os.ReadFile(path)
			if err != nil {
				// Try looking one directory up if not found
				path = filepath.Join("..", migrationsDir, file)
				content, err = os.ReadFile(path)
				if err != nil {
					log.Printf("[DB] Migration file not found at %s: %v", file, err)
					continue
				}
			}
		}

		if _, err := p.Pool.Exec(ctx, string(content)); err != nil {
			return fmt.Errorf("migration %s failed: %w", file, err)
		}

		_, _ = p.Pool.Exec(ctx, "INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING", file)
		log.Printf("[DB] Applied migration: %s", file)
	}

	// Idempotent self-repair check: ensure critical columns and tables exist even if migration tracking was bypassed
	_, _ = p.Pool.Exec(ctx, `
		ALTER TABLE IF EXISTS dhl_shipments ADD COLUMN IF NOT EXISTS delivered_notified_at TIMESTAMPTZ;
		ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS datahub_status VARCHAR(50) DEFAULT 'skipped';
		ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS datahub_object_id VARCHAR(255);
		ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS datahub_synced_at TIMESTAMPTZ;
		ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS datahub_error TEXT;
		CREATE TABLE IF NOT EXISTS datahub_configs (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			api_url VARCHAR(500) NOT NULL DEFAULT 'https://datahub-api.bigdata.samsung.com',
			api_key TEXT NOT NULL DEFAULT '',
			default_project_id VARCHAR(100) NOT NULL DEFAULT 'PE_PORTAL',
			default_folder_id VARCHAR(100) DEFAULT '',
			is_active BOOLEAN NOT NULL DEFAULT true,
			updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
		INSERT INTO datahub_configs (api_url, api_key, default_project_id, is_active)
		SELECT 'https://datahub-api.bigdata.samsung.com', '', 'PE_PORTAL', true
		WHERE NOT EXISTS (SELECT 1 FROM datahub_configs);
		ALTER TABLE IF EXISTS datahub_configs ADD COLUMN IF NOT EXISTS watch_folder_path VARCHAR(500) DEFAULT '/data/files/datahub_watch';
		ALTER TABLE IF EXISTS datahub_configs ADD COLUMN IF NOT EXISTS auto_upload_enabled BOOLEAN DEFAULT false;
		ALTER TABLE IF EXISTS datahub_configs ADD COLUMN IF NOT EXISTS last_watch_scan_at TIMESTAMPTZ;
		CREATE TABLE IF NOT EXISTS user_group_parts (
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			group_part_id UUID NOT NULL REFERENCES group_parts(id) ON DELETE CASCADE,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			PRIMARY KEY (user_id, group_part_id)
		);
		CREATE INDEX IF NOT EXISTS idx_user_group_parts_user ON user_group_parts(user_id);
		CREATE INDEX IF NOT EXISTS idx_user_group_parts_group ON user_group_parts(group_part_id);
		INSERT INTO user_group_parts (user_id, group_part_id)
		SELECT id, group_part_id FROM users
		WHERE group_part_id IS NOT NULL
		ON CONFLICT (user_id, group_part_id) DO NOTHING;
	`)

	return nil
}

// Close closes the database connection pool
func (p *PostgresPool) Close() {
	if p.Pool != nil {
		p.Pool.Close()
	}
}
