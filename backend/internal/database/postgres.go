package database

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
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

	files := []string{
		"001_init.sql",
		"002_seed.sql",
		"003_reports_smtp.sql",
		"004_llm_config.sql",
		"005_user_email_lists.sql",
		"006_innovation_classes_and_targets.sql",
		"007_sample_management.sql",
		"008_software_mr.sql",
		"009_dhl_tracker.sql",
	}
	for _, file := range files {
		var alreadyApplied bool
		if err := p.Pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1)", file).Scan(&alreadyApplied); err == nil && alreadyApplied {
			continue // Migration already applied, skip
		}

		path := filepath.Join(migrationsDir, file)
		content, err := os.ReadFile(path)
		if err != nil {
			// Try looking one directory up if not found
			path = filepath.Join("..", migrationsDir, file)
			content, err = os.ReadFile(path)
			if err != nil {
				log.Printf("[DB] Migration file not found at %s (skipping auto-migration): %v", file, err)
				continue
			}
		}

		if _, err := p.Pool.Exec(ctx, string(content)); err != nil {
			return fmt.Errorf("migration %s failed: %w", file, err)
		}

		_, _ = p.Pool.Exec(ctx, "INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING", file)
		log.Printf("[DB] Applied migration: %s", file)
	}

	return nil
}

// Close closes the database connection pool
func (p *PostgresPool) Close() {
	if p.Pool != nil {
		p.Pool.Close()
	}
}
