package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"pe-portal/internal/model"
)

type InnovationRepository struct {
	pool *pgxpool.Pool
}

func NewInnovationRepository(pool *pgxpool.Pool) *InnovationRepository {
	return &InnovationRepository{pool: pool}
}

func (r *InnovationRepository) List(ctx context.Context, category, status string, groupID *uuid.UUID) ([]model.Innovation, error) {
	query := `
		SELECT i.id, i.title, i.description, i.category, i.status,
		       i.author_id, u.full_name as author_name,
		       i.group_part_id, gp.name as group_part_name,
		       i.impact_score, i.attachments, i.created_at, i.updated_at
		FROM innovations i
		LEFT JOIN users u ON i.author_id = u.id
		LEFT JOIN group_parts gp ON i.group_part_id = gp.id
		WHERE i.deleted_at IS NULL
		  AND ($1 = '' OR i.category = $1)
		  AND ($2 = '' OR i.status = $2)
		  AND ($3::uuid IS NULL OR i.group_part_id = $3)
		ORDER BY i.created_at DESC
	`

	rows, err := r.pool.Query(ctx, query, category, status, groupID)
	if err != nil {
		return nil, fmt.Errorf("failed to list innovations: %w", err)
	}
	defer rows.Close()

	items := []model.Innovation{}
	for rows.Next() {
		var item model.Innovation
		err := rows.Scan(
			&item.ID, &item.Title, &item.Description, &item.Category, &item.Status,
			&item.AuthorID, &item.AuthorName,
			&item.GroupPartID, &item.GroupPartName,
			&item.ImpactScore, &item.Attachments, &item.CreatedAt, &item.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, nil
}

func (r *InnovationRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.Innovation, error) {
	query := `
		SELECT i.id, i.title, i.description, i.category, i.status,
		       i.author_id, u.full_name as author_name,
		       i.group_part_id, gp.name as group_part_name,
		       i.impact_score, i.attachments, i.created_at, i.updated_at
		FROM innovations i
		LEFT JOIN users u ON i.author_id = u.id
		LEFT JOIN group_parts gp ON i.group_part_id = gp.id
		WHERE i.id = $1 AND i.deleted_at IS NULL
	`

	var item model.Innovation
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&item.ID, &item.Title, &item.Description, &item.Category, &item.Status,
		&item.AuthorID, &item.AuthorName,
		&item.GroupPartID, &item.GroupPartName,
		&item.ImpactScore, &item.Attachments, &item.CreatedAt, &item.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *InnovationRepository) Create(ctx context.Context, item *model.Innovation) (*model.Innovation, error) {
	if item.ID == uuid.Nil {
		item.ID = uuid.New()
	}
	if item.Status == "" {
		item.Status = "draft"
	}
	if len(item.Attachments) == 0 {
		item.Attachments = json.RawMessage("[]")
	}

	query := `
		INSERT INTO innovations (id, title, description, category, status, author_id, group_part_id, impact_score, attachments)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING created_at, updated_at
	`

	err := r.pool.QueryRow(ctx, query,
		item.ID, item.Title, item.Description, item.Category, item.Status,
		item.AuthorID, item.GroupPartID, item.ImpactScore, item.Attachments,
	).Scan(&item.CreatedAt, &item.UpdatedAt)

	if err != nil {
		return nil, fmt.Errorf("failed to create innovation: %w", err)
	}

	return r.GetByID(ctx, item.ID)
}

func (r *InnovationRepository) Update(ctx context.Context, item *model.Innovation) (*model.Innovation, error) {
	query := `
		UPDATE innovations
		SET title = $1, description = $2, category = $3, impact_score = $4,
		    group_part_id = $5, updated_at = NOW()
		WHERE id = $6 AND deleted_at IS NULL
	`
	_, err := r.pool.Exec(ctx, query,
		item.Title, item.Description, item.Category, item.ImpactScore,
		item.GroupPartID, item.ID,
	)
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, item.ID)
}

func (r *InnovationRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status string) error {
	query := `UPDATE innovations SET status = $1, updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL`
	_, err := r.pool.Exec(ctx, query, status, id)
	return err
}

func (r *InnovationRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE innovations SET deleted_at = NOW() WHERE id = $1`
	_, err := r.pool.Exec(ctx, query, id)
	return err
}
