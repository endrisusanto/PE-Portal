package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"pe-portal/internal/model"
)

type MCPRepository struct {
	pool *pgxpool.Pool
}

func NewMCPRepository(pool *pgxpool.Pool) *MCPRepository {
	return &MCPRepository{pool: pool}
}

func (r *MCPRepository) List(ctx context.Context) ([]model.MCPServer, error) {
	query := `
		SELECT id, name, url, description, auth_type, auth_token,
		       is_active, health_status, last_health_check, created_by,
		       created_at, updated_at
		FROM mcp_servers
		ORDER BY created_at ASC
	`
	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list MCP servers: %w", err)
	}
	defer rows.Close()

	servers := []model.MCPServer{}
	for rows.Next() {
		var s model.MCPServer
		err := rows.Scan(
			&s.ID, &s.Name, &s.URL, &s.Description, &s.AuthType, &s.AuthToken,
			&s.IsActive, &s.HealthStatus, &s.LastHealthCheck, &s.CreatedBy,
			&s.CreatedAt, &s.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		servers = append(servers, s)
	}
	return servers, nil
}

func (r *MCPRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.MCPServer, error) {
	query := `
		SELECT id, name, url, description, auth_type, auth_token,
		       is_active, health_status, last_health_check, created_by,
		       created_at, updated_at
		FROM mcp_servers
		WHERE id = $1
	`
	var s model.MCPServer
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&s.ID, &s.Name, &s.URL, &s.Description, &s.AuthType, &s.AuthToken,
		&s.IsActive, &s.HealthStatus, &s.LastHealthCheck, &s.CreatedBy,
		&s.CreatedAt, &s.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *MCPRepository) Create(ctx context.Context, s *model.MCPServer) (*model.MCPServer, error) {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	if s.AuthType == "" {
		s.AuthType = "none"
	}
	if s.HealthStatus == "" {
		s.HealthStatus = "unknown"
	}

	query := `
		INSERT INTO mcp_servers (id, name, url, description, auth_type, auth_token, is_active, health_status, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING created_at, updated_at
	`
	err := r.pool.QueryRow(ctx, query,
		s.ID, s.Name, s.URL, s.Description, s.AuthType, s.AuthToken, s.IsActive, s.HealthStatus, s.CreatedBy,
	).Scan(&s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create MCP server: %w", err)
	}

	return s, nil
}

func (r *MCPRepository) Update(ctx context.Context, s *model.MCPServer) (*model.MCPServer, error) {
	query := `
		UPDATE mcp_servers
		SET name = $1, url = $2, description = $3, auth_type = $4,
		    auth_token = COALESCE($5, auth_token), is_active = $6, updated_at = NOW()
		WHERE id = $7
	`
	_, err := r.pool.Exec(ctx, query, s.Name, s.URL, s.Description, s.AuthType, s.AuthToken, s.IsActive, s.ID)
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, s.ID)
}

func (r *MCPRepository) UpdateHealth(ctx context.Context, id uuid.UUID, status string) error {
	query := `UPDATE mcp_servers SET health_status = $1, last_health_check = $2 WHERE id = $3`
	_, err := r.pool.Exec(ctx, query, status, time.Now(), id)
	return err
}

func (r *MCPRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM mcp_servers WHERE id = $1`
	_, err := r.pool.Exec(ctx, query, id)
	return err
}
