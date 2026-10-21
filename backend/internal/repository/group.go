package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"pe-portal/internal/model"
)

type GroupRepository struct {
	pool *pgxpool.Pool
}

func NewGroupRepository(pool *pgxpool.Pool) *GroupRepository {
	return &GroupRepository{pool: pool}
}

func (r *GroupRepository) ListAll(ctx context.Context) ([]model.GroupPart, error) {
	query := `
		SELECT id, name, parent_group, description, sort_order, created_at
		FROM group_parts
		ORDER BY parent_group ASC, sort_order ASC
	`
	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list group parts: %w", err)
	}
	defer rows.Close()

	var parts []model.GroupPart
	for rows.Next() {
		var g model.GroupPart
		if err := rows.Scan(&g.ID, &g.Name, &g.ParentGroup, &g.Description, &g.SortOrder, &g.CreatedAt); err != nil {
			return nil, err
		}
		parts = append(parts, g)
	}
	return parts, nil
}

func (r *GroupRepository) ListByParentGroup(ctx context.Context, parentGroup string) ([]model.GroupPart, error) {
	query := `
		SELECT id, name, parent_group, description, sort_order, created_at
		FROM group_parts
		WHERE parent_group = $1
		ORDER BY sort_order ASC
	`
	rows, err := r.pool.Query(ctx, query, parentGroup)
	if err != nil {
		return nil, fmt.Errorf("failed to list group parts by parent: %w", err)
	}
	defer rows.Close()

	var parts []model.GroupPart
	for rows.Next() {
		var g model.GroupPart
		if err := rows.Scan(&g.ID, &g.Name, &g.ParentGroup, &g.Description, &g.SortOrder, &g.CreatedAt); err != nil {
			return nil, err
		}
		parts = append(parts, g)
	}
	return parts, nil
}

func (r *GroupRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.GroupPart, error) {
	query := `
		SELECT id, name, parent_group, description, sort_order, created_at
		FROM group_parts
		WHERE id = $1
	`
	var g model.GroupPart
	err := r.pool.QueryRow(ctx, query, id).Scan(&g.ID, &g.Name, &g.ParentGroup, &g.Description, &g.SortOrder, &g.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &g, nil
}
