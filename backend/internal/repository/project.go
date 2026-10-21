package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"pe-portal/internal/model"
)

type ProjectRepository struct {
	pool *pgxpool.Pool
}

func NewProjectRepository(pool *pgxpool.Pool) *ProjectRepository {
	return &ProjectRepository{pool: pool}
}

func (r *ProjectRepository) List(ctx context.Context, projectType, status string, groupID *uuid.UUID) ([]model.Project, error) {
	query := `
		SELECT p.id, p.title, p.description, p.project_type, p.status, p.priority,
		       p.owner_id, u.full_name as owner_name,
		       p.group_part_id, gp.name as group_part_name,
		       p.start_date::text, p.target_date::text, p.completion_date::text,
		       p.progress, p.metadata, p.created_at, p.updated_at
		FROM projects p
		LEFT JOIN users u ON p.owner_id = u.id
		LEFT JOIN group_parts gp ON p.group_part_id = gp.id
		WHERE p.deleted_at IS NULL
		  AND ($1 = '' OR p.project_type = $1)
		  AND ($2 = '' OR p.status = $2)
		  AND ($3::uuid IS NULL OR p.group_part_id = $3)
		ORDER BY p.updated_at DESC
	`

	rows, err := r.pool.Query(ctx, query, projectType, status, groupID)
	if err != nil {
		return nil, fmt.Errorf("failed to list projects: %w", err)
	}
	defer rows.Close()

	items := []model.Project{}
	for rows.Next() {
		var p model.Project
		err := rows.Scan(
			&p.ID, &p.Title, &p.Description, &p.ProjectType, &p.Status, &p.Priority,
			&p.OwnerID, &p.OwnerName,
			&p.GroupPartID, &p.GroupPartName,
			&p.StartDate, &p.TargetDate, &p.CompletionDate,
			&p.Progress, &p.Metadata, &p.CreatedAt, &p.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		items = append(items, p)
	}
	return items, nil
}

func (r *ProjectRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.Project, error) {
	query := `
		SELECT p.id, p.title, p.description, p.project_type, p.status, p.priority,
		       p.owner_id, u.full_name as owner_name,
		       p.group_part_id, gp.name as group_part_name,
		       p.start_date::text, p.target_date::text, p.completion_date::text,
		       p.progress, p.metadata, p.created_at, p.updated_at
		FROM projects p
		LEFT JOIN users u ON p.owner_id = u.id
		LEFT JOIN group_parts gp ON p.group_part_id = gp.id
		WHERE p.id = $1 AND p.deleted_at IS NULL
	`

	var p model.Project
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&p.ID, &p.Title, &p.Description, &p.ProjectType, &p.Status, &p.Priority,
		&p.OwnerID, &p.OwnerName,
		&p.GroupPartID, &p.GroupPartName,
		&p.StartDate, &p.TargetDate, &p.CompletionDate,
		&p.Progress, &p.Metadata, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *ProjectRepository) Create(ctx context.Context, p *model.Project) (*model.Project, error) {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	if p.Status == "" {
		p.Status = "planning"
	}
	if p.Priority == "" {
		p.Priority = "medium"
	}
	if len(p.Metadata) == 0 {
		p.Metadata = json.RawMessage("{}")
	}

	query := `
		INSERT INTO projects (id, title, description, project_type, status, priority, owner_id, group_part_id, start_date, target_date, progress, metadata)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULLIF($9, '')::date, NULLIF($10, '')::date, $11, $12)
		RETURNING created_at, updated_at
	`

	var startDate, targetDate string
	if p.StartDate != nil {
		startDate = *p.StartDate
	}
	if p.TargetDate != nil {
		targetDate = *p.TargetDate
	}

	err := r.pool.QueryRow(ctx, query,
		p.ID, p.Title, p.Description, p.ProjectType, p.Status, p.Priority,
		p.OwnerID, p.GroupPartID, startDate, targetDate, p.Progress, p.Metadata,
	).Scan(&p.CreatedAt, &p.UpdatedAt)

	if err != nil {
		return nil, fmt.Errorf("failed to create project: %w", err)
	}

	return r.GetByID(ctx, p.ID)
}

func (r *ProjectRepository) Update(ctx context.Context, p *model.Project) (*model.Project, error) {
	var startDate, targetDate, completionDate string
	if p.StartDate != nil {
		startDate = *p.StartDate
	}
	if p.TargetDate != nil {
		targetDate = *p.TargetDate
	}
	if p.CompletionDate != nil {
		completionDate = *p.CompletionDate
	}

	query := `
		UPDATE projects
		SET title = $1, description = $2, project_type = $3, status = $4, priority = $5,
		    group_part_id = $6, start_date = NULLIF($7, '')::date, target_date = NULLIF($8, '')::date,
		    completion_date = NULLIF($9, '')::date, progress = $10, metadata = $11, updated_at = NOW()
		WHERE id = $12 AND deleted_at IS NULL
	`

	_, err := r.pool.Exec(ctx, query,
		p.Title, p.Description, p.ProjectType, p.Status, p.Priority,
		p.GroupPartID, startDate, targetDate, completionDate, p.Progress, p.Metadata, p.ID,
	)
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, p.ID)
}

func (r *ProjectRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE projects SET deleted_at = NOW() WHERE id = $1`
	_, err := r.pool.Exec(ctx, query, id)
	return err
}

// Tasks
func (r *ProjectRepository) ListTasks(ctx context.Context, projectID uuid.UUID) ([]model.ProjectTask, error) {
	query := `
		SELECT t.id, t.project_id, t.title, t.description, t.status,
		       t.assignee_id, u.full_name as assignee_name,
		       t.due_date::text, t.sort_order, t.created_at, t.updated_at
		FROM project_tasks t
		LEFT JOIN users u ON t.assignee_id = u.id
		WHERE t.project_id = $1
		ORDER BY t.sort_order ASC, t.created_at ASC
	`
	rows, err := r.pool.Query(ctx, query, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tasks := []model.ProjectTask{}
	for rows.Next() {
		var t model.ProjectTask
		err := rows.Scan(
			&t.ID, &t.ProjectID, &t.Title, &t.Description, &t.Status,
			&t.AssigneeID, &t.AssigneeName,
			&t.DueDate, &t.SortOrder, &t.CreatedAt, &t.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		tasks = append(tasks, t)
	}
	return tasks, nil
}

func (r *ProjectRepository) CreateTask(ctx context.Context, t *model.ProjectTask) (*model.ProjectTask, error) {
	if t.ID == uuid.Nil {
		t.ID = uuid.New()
	}
	if t.Status == "" {
		t.Status = "todo"
	}
	var dueDate string
	if t.DueDate != nil {
		dueDate = *t.DueDate
	}

	query := `
		INSERT INTO project_tasks (id, project_id, title, description, status, assignee_id, due_date, sort_order)
		VALUES ($1, $2, $3, $4, $5, $6, NULLIF($7, '')::date, $8)
		RETURNING created_at, updated_at
	`
	err := r.pool.QueryRow(ctx, query,
		t.ID, t.ProjectID, t.Title, t.Description, t.Status, t.AssigneeID, dueDate, t.SortOrder,
	).Scan(&t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, err
	}

	// Update project progress automatically
	r.recalculateProjectProgress(ctx, t.ProjectID)

	return t, nil
}

func (r *ProjectRepository) UpdateTaskStatus(ctx context.Context, taskID uuid.UUID, status string) error {
	var projectID uuid.UUID
	query := `UPDATE project_tasks SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING project_id`
	err := r.pool.QueryRow(ctx, query, status, taskID).Scan(&projectID)
	if err != nil {
		return err
	}

	r.recalculateProjectProgress(ctx, projectID)
	return nil
}

// recalculateProjectProgress sets project progress percentage based on completed tasks
// ponytail: automatic calculation without extra worker queues
func (r *ProjectRepository) recalculateProjectProgress(ctx context.Context, projectID uuid.UUID) {
	query := `
		WITH task_counts AS (
			SELECT COUNT(*) as total,
			       COUNT(*) FILTER (WHERE status = 'done') as completed
			FROM project_tasks
			WHERE project_id = $1
		)
		UPDATE projects
		SET progress = CASE
			WHEN total = 0 THEN progress
			ELSE ROUND((completed::numeric / total::numeric) * 100)
		END,
		updated_at = NOW()
		FROM task_counts
		WHERE id = $1
	`
	_, _ = r.pool.Exec(ctx, query, projectID)
}
