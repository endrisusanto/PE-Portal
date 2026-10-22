package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"pe-portal/internal/model"
)

type NavigationRepository struct {
	pool *pgxpool.Pool
}

func NewNavigationRepository(pool *pgxpool.Pool) *NavigationRepository {
	return &NavigationRepository{pool: pool}
}

// ListMenuPermissions retrieves all menu items ordered by sort_order
func (r *NavigationRepository) ListMenuPermissions(ctx context.Context) ([]model.MenuPermission, error) {
	query := `
		SELECT id, menu_key, label, path, category, is_visible,
		       COALESCE(allowed_roles, ARRAY[]::text[]),
		       COALESCE(allowed_groups, ARRAY[]::text[]),
		       sort_order, created_at, updated_at
		FROM menu_permissions
		ORDER BY sort_order ASC
	`
	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query menu permissions: %w", err)
	}
	defer rows.Close()

	var permissions []model.MenuPermission
	for rows.Next() {
		var p model.MenuPermission
		err := rows.Scan(
			&p.ID, &p.MenuKey, &p.Label, &p.Path, &p.Category, &p.IsVisible,
			&p.AllowedRoles, &p.AllowedGroups, &p.SortOrder,
			&p.CreatedAt, &p.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan menu permission: %w", err)
		}
		permissions = append(permissions, p)
	}
	return permissions, nil
}

// UpdateMenuPermission updates a single menu permission by menu_key
func (r *NavigationRepository) UpdateMenuPermission(ctx context.Context, menuKey string, req model.UpdateMenuPermissionRequest) (*model.MenuPermission, error) {
	query := `
		UPDATE menu_permissions
		SET is_visible = $1, allowed_roles = $2, allowed_groups = $3, updated_at = NOW()
		WHERE menu_key = $4
		RETURNING id, menu_key, label, path, category, is_visible,
		          allowed_roles, allowed_groups, sort_order, created_at, updated_at
	`
	var p model.MenuPermission
	err := r.pool.QueryRow(ctx, query, req.IsVisible, req.AllowedRoles, req.AllowedGroups, menuKey).Scan(
		&p.ID, &p.MenuKey, &p.Label, &p.Path, &p.Category, &p.IsVisible,
		&p.AllowedRoles, &p.AllowedGroups, &p.SortOrder,
		&p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update menu permission '%s': %w", menuKey, err)
	}
	return &p, nil
}

// BatchUpdateMenuPermissions updates multiple menu permissions at once
func (r *NavigationRepository) BatchUpdateMenuPermissions(ctx context.Context, perms []model.MenuPermission) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	for _, p := range perms {
		query := `
			UPDATE menu_permissions
			SET is_visible = $1, allowed_roles = $2, allowed_groups = $3, updated_at = NOW()
			WHERE menu_key = $4
		`
		_, err := tx.Exec(ctx, query, p.IsVisible, p.AllowedRoles, p.AllowedGroups, p.MenuKey)
		if err != nil {
			return fmt.Errorf("failed to update menu permission '%s': %w", p.MenuKey, err)
		}
	}

	return tx.Commit(ctx)
}
