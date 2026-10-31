package repository

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"pe-portal/internal/model"
)

type ToolJobRepository struct {
	db *pgxpool.Pool
}

func NewToolJobRepository(db *pgxpool.Pool) *ToolJobRepository {
	return &ToolJobRepository{db: db}
}

func (r *ToolJobRepository) Create(ctx context.Context, job *model.ToolJob) error {
	query := `
		INSERT INTO tool_jobs (
			id, user_id, tool_type, file_name, file_size,
			status, progress_percent, current_step,
			output_path, result_url, result_meta,
			error_message, duration_sec, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
	`
	if job.ID == uuid.Nil {
		job.ID = uuid.New()
	}
	now := time.Now()
	job.CreatedAt = now
	job.UpdatedAt = now
	if job.ResultMeta == nil {
		job.ResultMeta = json.RawMessage("{}")
	}

	_, err := r.db.Exec(ctx, query,
		job.ID, job.UserID, job.ToolType, job.FileName, job.FileSize,
		job.Status, job.ProgressPercent, job.CurrentStep,
		job.OutputPath, job.ResultURL, job.ResultMeta,
		job.ErrorMessage, job.DurationSec, job.CreatedAt, job.UpdatedAt,
	)
	return err
}

func (r *ToolJobRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.ToolJob, error) {
	query := `
		SELECT id, user_id, tool_type, file_name, file_size,
		       status, progress_percent, COALESCE(current_step, ''),
		       COALESCE(output_path, ''), COALESCE(result_url, ''),
		       COALESCE(result_meta, '{}'::jsonb), COALESCE(error_message, ''),
		       duration_sec, started_at, completed_at, created_at, updated_at
		FROM (
			SELECT id, user_id, tool_type, file_name, file_size,
			       status, progress_percent, current_step,
			       output_path, result_url,
			       result_meta, error_message,
			       duration_sec, started_at, completed_at, created_at, updated_at
			FROM tool_jobs

			UNION ALL

			SELECT id, user_id, 'wi-translator' AS tool_type, file_name, file_size,
			       status, progress_percent, message AS current_step,
			       translated_file AS output_path, download_url AS result_url,
			       jsonb_build_object('target_lang', target_lang, 'mode', mode, 'translated_count', translated_count) AS result_meta,
			       error_message,
			       duration_sec, started_at, completed_at, created_at, updated_at
			FROM wi_translation_jobs
		) AS combined_jobs
		WHERE id = $1
		LIMIT 1
	`
	var job model.ToolJob
	err := r.db.QueryRow(ctx, query, id).Scan(
		&job.ID, &job.UserID, &job.ToolType, &job.FileName, &job.FileSize,
		&job.Status, &job.ProgressPercent, &job.CurrentStep,
		&job.OutputPath, &job.ResultURL,
		&job.ResultMeta, &job.ErrorMessage,
		&job.DurationSec, &job.StartedAt, &job.CompletedAt, &job.CreatedAt, &job.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &job, nil
}

func (r *ToolJobRepository) MarkStarted(ctx context.Context, id uuid.UUID) error {
	now := time.Now()
	query := `
		UPDATE tool_jobs
		SET status = 'processing', started_at = $2, updated_at = $2
		WHERE id = $1 AND status = 'pending'
	`
	_, err := r.db.Exec(ctx, query, id, now)
	return err
}

func (r *ToolJobRepository) UpdateProgress(ctx context.Context, id uuid.UUID, percent float64, step string) error {
	now := time.Now()
	query := `
		UPDATE tool_jobs
		SET progress_percent = $2, current_step = $3, updated_at = $4
		WHERE id = $1 AND status = 'processing'
	`
	_, err := r.db.Exec(ctx, query, id, percent, step, now)
	return err
}

func (r *ToolJobRepository) MarkCompleted(ctx context.Context, id uuid.UUID, outputPath, resultURL string, meta []byte, duration float64) error {
	now := time.Now()
	if meta == nil || len(meta) == 0 {
		meta = []byte("{}")
	}
	query := `
		UPDATE tool_jobs
		SET status = 'completed', progress_percent = 100.0, current_step = 'Selesai',
		    output_path = $2, result_url = $3, result_meta = $4,
		    duration_sec = $5, completed_at = $6, updated_at = $6
		WHERE id = $1
	`
	_, err := r.db.Exec(ctx, query, id, outputPath, resultURL, meta, duration, now)
	return err
}

func (r *ToolJobRepository) MarkFailed(ctx context.Context, id uuid.UUID, errMsg string, duration float64) error {
	now := time.Now()
	query := `
		UPDATE tool_jobs
		SET status = 'failed', error_message = $2, duration_sec = $3,
		    completed_at = $4, updated_at = $4
		WHERE id = $1
	`
	_, err := r.db.Exec(ctx, query, id, errMsg, duration, now)
	return err
}

func (r *ToolJobRepository) MarkCancelled(ctx context.Context, id uuid.UUID) error {
	now := time.Now()
	query1 := `
		UPDATE tool_jobs
		SET status = 'cancelled', current_step = 'Dibatalkan', completed_at = $2, updated_at = $2
		WHERE id = $1 AND status IN ('pending', 'processing')
	`
	_, err := r.db.Exec(ctx, query1, id, now)

	query2 := `
		UPDATE wi_translation_jobs
		SET status = 'failed', message = 'Dibatalkan', completed_at = $2, updated_at = $2
		WHERE id = $1 AND status IN ('pending', 'processing')
	`
	_, _ = r.db.Exec(ctx, query2, id, now)
	return err
}

func (r *ToolJobRepository) ListActive(ctx context.Context, userID *uuid.UUID) ([]model.ToolJob, error) {
	query := `
		SELECT id, user_id, tool_type, file_name, file_size,
		       status, progress_percent, COALESCE(current_step, ''),
		       COALESCE(output_path, ''), COALESCE(result_url, ''),
		       COALESCE(result_meta, '{}'::jsonb), COALESCE(error_message, ''),
		       duration_sec, started_at, completed_at, created_at, updated_at
		FROM (
			SELECT id, user_id, tool_type, file_name, file_size,
			       status, progress_percent, current_step,
			       output_path, result_url,
			       result_meta, error_message,
			       duration_sec, started_at, completed_at, created_at, updated_at
			FROM tool_jobs
			WHERE status IN ('pending', 'processing')

			UNION ALL

			SELECT id, user_id, 'wi-translator' AS tool_type, file_name, file_size,
			       status, progress_percent, message AS current_step,
			       translated_file AS output_path, download_url AS result_url,
			       jsonb_build_object('target_lang', target_lang, 'mode', mode, 'translated_count', translated_count) AS result_meta,
			       error_message,
			       duration_sec, started_at, completed_at, created_at, updated_at
			FROM wi_translation_jobs
			WHERE status IN ('pending', 'processing')
		) AS active_jobs
		ORDER BY created_at DESC
	`
	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []model.ToolJob
	for rows.Next() {
		var job model.ToolJob
		if err := rows.Scan(
			&job.ID, &job.UserID, &job.ToolType, &job.FileName, &job.FileSize,
			&job.Status, &job.ProgressPercent, &job.CurrentStep,
			&job.OutputPath, &job.ResultURL,
			&job.ResultMeta, &job.ErrorMessage,
			&job.DurationSec, &job.StartedAt, &job.CompletedAt, &job.CreatedAt, &job.UpdatedAt,
		); err != nil {
			return nil, err
		}
		list = append(list, job)
	}
	return list, nil
}

func (r *ToolJobRepository) ListRecent(ctx context.Context, userID *uuid.UUID, limit int) ([]model.ToolJob, error) {
	if limit <= 0 || limit > 50 {
		limit = 15
	}
	query := `
		SELECT id, user_id, tool_type, file_name, file_size,
		       status, progress_percent, COALESCE(current_step, ''),
		       COALESCE(output_path, ''), COALESCE(result_url, ''),
		       COALESCE(result_meta, '{}'::jsonb), COALESCE(error_message, ''),
		       duration_sec, started_at, completed_at, created_at, updated_at
		FROM (
			SELECT id, user_id, tool_type, file_name, file_size,
			       status, progress_percent, current_step,
			       output_path, result_url,
			       result_meta, error_message,
			       duration_sec, started_at, completed_at, created_at, updated_at
			FROM tool_jobs

			UNION ALL

			SELECT id, user_id, 'wi-translator' AS tool_type, file_name, file_size,
			       status, progress_percent, message AS current_step,
			       translated_file AS output_path, download_url AS result_url,
			       jsonb_build_object('target_lang', target_lang, 'mode', mode, 'translated_count', translated_count) AS result_meta,
			       error_message,
			       duration_sec, started_at, completed_at, created_at, updated_at
			FROM wi_translation_jobs
		) AS combined_jobs
		ORDER BY 
			CASE WHEN status IN ('pending', 'processing') THEN 0 ELSE 1 END ASC,
			created_at DESC
		LIMIT $1
	`
	rows, err := r.db.Query(ctx, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []model.ToolJob
	for rows.Next() {
		var job model.ToolJob
		if err := rows.Scan(
			&job.ID, &job.UserID, &job.ToolType, &job.FileName, &job.FileSize,
			&job.Status, &job.ProgressPercent, &job.CurrentStep,
			&job.OutputPath, &job.ResultURL,
			&job.ResultMeta, &job.ErrorMessage,
			&job.DurationSec, &job.StartedAt, &job.CompletedAt, &job.CreatedAt, &job.UpdatedAt,
		); err != nil {
			return nil, err
		}
		list = append(list, job)
	}
	return list, nil
}

func (r *ToolJobRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query1 := `DELETE FROM tool_jobs WHERE id = $1`
	_, err := r.db.Exec(ctx, query1, id)
	query2 := `DELETE FROM wi_translation_jobs WHERE id = $1`
	_, _ = r.db.Exec(ctx, query2, id)
	return err
}

// GetRecentChangeLogs fetches recent ECN change logs and system updates to populate the notification dropdown
func (r *ToolJobRepository) GetRecentChangeLogs(ctx context.Context, limit int) ([]model.NotificationChangeLog, error) {
	if limit <= 0 || limit > 30 {
		limit = 10
	}

	query := `
		SELECT
			cl.id::text,
			'ecn' AS type,
			'Perubahan ECN ' || COALESCE(e.ecn_no, '') AS title,
			COALESCE(cl.note, 'Pembaruan data part/BOM oleh ' || COALESCE(u.full_name, 'Sistem')) AS message,
			COALESCE(cl.action, 'UPDATE') AS tag,
			cl.created_at,
			'/ecn' AS link
		FROM ecn_change_logs cl
		LEFT JOIN ecn_records e ON e.id = cl.ecn_id
		LEFT JOIN users u ON u.id = cl.changed_by
		ORDER BY cl.created_at DESC
		LIMIT $1
	`
	rows, err := r.db.Query(ctx, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []model.NotificationChangeLog
	for rows.Next() {
		var l model.NotificationChangeLog
		if err := rows.Scan(&l.ID, &l.Type, &l.Title, &l.Message, &l.Tag, &l.Timestamp, &l.Link); err != nil {
			return nil, err
		}
		logs = append(logs, l)
	}

	// If fewer than limit, also fetch any recent new model milestones updates
	if len(logs) < limit {
		rem := limit - len(logs)
		mQuery := `
			SELECT
				m.id::text,
				'milestone' AS type,
				'Milestone Model ' || COALESCE(nm.model_name, '') AS title,
				COALESCE(m.label, '') || ' (' || COALESCE(m.category, '') || ')' AS message,
				COALESCE(m.status, 'UPDATE') AS tag,
				COALESCE(m.updated_at, m.created_at) AS timestamp,
				'/new-model' AS link
			FROM new_model_milestones m
			JOIN new_models nm ON nm.id = m.model_id
			ORDER BY timestamp DESC
			LIMIT $1
		`
		mRows, mErr := r.db.Query(ctx, mQuery, rem)
		if mErr == nil {
			defer mRows.Close()
			for mRows.Next() {
				var ml model.NotificationChangeLog
				if err := mRows.Scan(&ml.ID, &ml.Type, &ml.Title, &ml.Message, &ml.Tag, &ml.Timestamp, &ml.Link); err == nil {
					logs = append(logs, ml)
				}
			}
		}
	}

	return logs, nil
}
