package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"pe-portal/internal/model"
)

type NewModelRepository struct {
	pool *pgxpool.Pool
}

func NewNewModelRepository(pool *pgxpool.Pool) *NewModelRepository {
	return &NewModelRepository{pool: pool}
}

func (r *NewModelRepository) List(ctx context.Context, stage string) ([]model.NewModel, error) {
	query := `
		SELECT m.id, m.model_name, m.codename, m.stage, m.description,
		       m.project_id, m.owner_id, u.full_name as owner_name,
		       m.target_release::text, m.specifications, m.created_at, m.updated_at
		FROM new_models m
		LEFT JOIN users u ON m.owner_id = u.id
		WHERE m.deleted_at IS NULL
		  AND ($1 = '' OR m.stage = $1)
		ORDER BY m.created_at DESC
	`

	rows, err := r.pool.Query(ctx, query, stage)
	if err != nil {
		return nil, fmt.Errorf("failed to list new models: %w", err)
	}
	defer rows.Close()

	items := []model.NewModel{}
	for rows.Next() {
		var m model.NewModel
		err := rows.Scan(
			&m.ID, &m.ModelName, &m.Codename, &m.Stage, &m.Description,
			&m.ProjectID, &m.OwnerID, &m.OwnerName,
			&m.TargetRelease, &m.Specifications, &m.CreatedAt, &m.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		items = append(items, m)
	}
	return items, nil
}

func (r *NewModelRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.NewModel, error) {
	query := `
		SELECT m.id, m.model_name, m.codename, m.stage, m.description,
		       m.project_id, m.owner_id, u.full_name as owner_name,
		       m.target_release::text, m.specifications, m.created_at, m.updated_at
		FROM new_models m
		LEFT JOIN users u ON m.owner_id = u.id
		WHERE m.id = $1 AND m.deleted_at IS NULL
	`

	var m model.NewModel
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&m.ID, &m.ModelName, &m.Codename, &m.Stage, &m.Description,
		&m.ProjectID, &m.OwnerID, &m.OwnerName,
		&m.TargetRelease, &m.Specifications, &m.CreatedAt, &m.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *NewModelRepository) Create(ctx context.Context, m *model.NewModel) (*model.NewModel, error) {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	if m.Stage == "" {
		m.Stage = "concept"
	}
	if len(m.Specifications) == 0 {
		m.Specifications = json.RawMessage("{}")
	}

	var targetRelease string
	if m.TargetRelease != nil {
		targetRelease = *m.TargetRelease
	}

	query := `
		INSERT INTO new_models (id, model_name, codename, stage, description, project_id, owner_id, target_release, specifications)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NULLIF($8, '')::date, $9)
		RETURNING created_at, updated_at
	`

	err := r.pool.QueryRow(ctx, query,
		m.ID, m.ModelName, m.Codename, m.Stage, m.Description,
		m.ProjectID, m.OwnerID, targetRelease, m.Specifications,
	).Scan(&m.CreatedAt, &m.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create new model: %w", err)
	}

	// Record initial stage history entry
	_, _ = r.pool.Exec(ctx, `
		INSERT INTO new_model_stages (model_id, stage, status, started_at)
		VALUES ($1, $2, 'in_progress', NOW())
	`, m.ID, m.Stage)

	return r.GetByID(ctx, m.ID)
}

func (r *NewModelRepository) Update(ctx context.Context, m *model.NewModel) (*model.NewModel, error) {
	var targetRelease string
	if m.TargetRelease != nil {
		targetRelease = *m.TargetRelease
	}

	var specParam any = nil
	if len(m.Specifications) > 0 && string(m.Specifications) != "null" {
		specParam = m.Specifications
	}

	query := `
		UPDATE new_models
		SET model_name = $1, codename = $2, description = $3,
		    project_id = $4,
		    owner_id = COALESCE($5, owner_id),
		    target_release = NULLIF($6, '')::date,
		    specifications = COALESCE($7::jsonb, specifications),
		    updated_at = NOW()
		WHERE id = $8 AND deleted_at IS NULL
	`

	_, err := r.pool.Exec(ctx, query,
		m.ModelName, m.Codename, m.Description,
		m.ProjectID, m.OwnerID, targetRelease, specParam, m.ID,
	)
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, m.ID)
}

// Stages
func (r *NewModelRepository) ListStages(ctx context.Context, modelID uuid.UUID) ([]model.NewModelStage, error) {
	query := `
		SELECT s.id, s.model_id, s.stage, s.status, s.started_at, s.completed_at,
		       s.notes, s.approved_by, u.full_name as approver_name, s.created_at
		FROM new_model_stages s
		LEFT JOIN users u ON s.approved_by = u.id
		WHERE s.model_id = $1
		ORDER BY s.created_at ASC
	`
	rows, err := r.pool.Query(ctx, query, modelID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	stages := []model.NewModelStage{}
	for rows.Next() {
		var s model.NewModelStage
		err := rows.Scan(
			&s.ID, &s.ModelID, &s.Stage, &s.Status, &s.StartedAt, &s.CompletedAt,
			&s.Notes, &s.ApprovedBy, &s.ApproverName, &s.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		stages = append(stages, s)
	}
	return stages, nil
}

func (r *NewModelRepository) AdvanceStage(ctx context.Context, modelID uuid.UUID, newStage, notes string, approverID *uuid.UUID) error {
	now := time.Now()

	// Complete current stage
	_, _ = r.pool.Exec(ctx, `
		UPDATE new_model_stages
		SET status = 'completed', completed_at = $1
		WHERE model_id = $2 AND status = 'in_progress'
	`, now, modelID)

	// Add new stage
	_, err := r.pool.Exec(ctx, `
		INSERT INTO new_model_stages (model_id, stage, status, started_at, notes, approved_by)
		VALUES ($1, $2, 'in_progress', $3, $4, $5)
	`, modelID, newStage, now, notes, approverID)
	if err != nil {
		return err
	}

	// Update current stage on model
	_, err = r.pool.Exec(ctx, `
		UPDATE new_models SET stage = $1, updated_at = $2 WHERE id = $3
	`, newStage, now, modelID)

	return err
}
