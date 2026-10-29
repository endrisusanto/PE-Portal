package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"pe-portal/internal/model"
)

type WITranslatorRepository struct {
	db *pgxpool.Pool
}

func NewWITranslatorRepository(db *pgxpool.Pool) *WITranslatorRepository {
	return &WITranslatorRepository{db: db}
}

func (r *WITranslatorRepository) Create(ctx context.Context, job *model.WITranslationJob) error {
	query := `
		INSERT INTO wi_translation_jobs (
			id, user_id, file_name, file_path, file_size, target_lang, mode,
			status, current_page, total_pages, progress_percent, message,
			created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
	`
	if job.ID == uuid.Nil {
		job.ID = uuid.New()
	}
	now := time.Now()
	job.CreatedAt = now
	job.UpdatedAt = now

	_, err := r.db.Exec(ctx, query,
		job.ID, job.UserID, job.FileName, job.FilePath, job.FileSize,
		job.TargetLang, job.Mode, job.Status, job.CurrentPage, job.TotalPages,
		job.ProgressPercent, job.Message, job.CreatedAt, job.UpdatedAt,
	)
	return err
}

func (r *WITranslatorRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.WITranslationJob, error) {
	query := `
		SELECT id, user_id, file_name, file_path, file_size, target_lang, mode,
		       status, current_page, total_pages, progress_percent, message,
		       translated_count, duration_sec, translated_file, download_url,
		       error_message, created_at, updated_at
		FROM wi_translation_jobs
		WHERE id = $1
	`
	var job model.WITranslationJob
	err := r.db.QueryRow(ctx, query, id).Scan(
		&job.ID, &job.UserID, &job.FileName, &job.FilePath, &job.FileSize,
		&job.TargetLang, &job.Mode, &job.Status, &job.CurrentPage, &job.TotalPages,
		&job.ProgressPercent, &job.Message, &job.TranslatedCount, &job.DurationSec,
		&job.TranslatedFile, &job.DownloadURL, &job.ErrorMessage,
		&job.CreatedAt, &job.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &job, nil
}

func (r *WITranslatorRepository) List(ctx context.Context, limit int) ([]*model.WITranslationJob, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	query := `
		SELECT id, user_id, file_name, file_path, file_size, target_lang, mode,
		       status, current_page, total_pages, progress_percent, message,
		       translated_count, duration_sec, translated_file, download_url,
		       error_message, created_at, updated_at
		FROM wi_translation_jobs
		ORDER BY created_at DESC
		LIMIT $1
	`
	rows, err := r.db.Query(ctx, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var jobs []*model.WITranslationJob
	for rows.Next() {
		var job model.WITranslationJob
		if err := rows.Scan(
			&job.ID, &job.UserID, &job.FileName, &job.FilePath, &job.FileSize,
			&job.TargetLang, &job.Mode, &job.Status, &job.CurrentPage, &job.TotalPages,
			&job.ProgressPercent, &job.Message, &job.TranslatedCount, &job.DurationSec,
			&job.TranslatedFile, &job.DownloadURL, &job.ErrorMessage,
			&job.CreatedAt, &job.UpdatedAt,
		); err != nil {
			return nil, err
		}
		jobs = append(jobs, &job)
	}
	return jobs, nil
}

func (r *WITranslatorRepository) MarkProcessing(ctx context.Context, id uuid.UUID) error {
	query := `
		UPDATE wi_translation_jobs
		SET status = 'processing', message = 'Sedang diproses oleh server...', updated_at = NOW()
		WHERE id = $1
	`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

func (r *WITranslatorRepository) UpdateProgress(ctx context.Context, id uuid.UUID, curr, total int, pct float64, msg string) error {
	query := `
		UPDATE wi_translation_jobs
		SET current_page = $2, total_pages = $3, progress_percent = $4,
		    message = $5, status = 'processing', updated_at = NOW()
		WHERE id = $1
	`
	_, err := r.db.Exec(ctx, query, id, curr, total, pct, msg)
	return err
}

func (r *WITranslatorRepository) MarkCompleted(ctx context.Context, id uuid.UUID, translatedFile, downloadURL string, count int, dur float64) error {
	query := `
		UPDATE wi_translation_jobs
		SET status = 'completed', progress_percent = 100.0, translated_file = $2,
		    download_url = $3, translated_count = $4, duration_sec = $5,
		    message = 'Penerjemahan dokumen selesai', updated_at = NOW()
		WHERE id = $1
	`
	_, err := r.db.Exec(ctx, query, id, translatedFile, downloadURL, count, dur)
	return err
}

func (r *WITranslatorRepository) MarkFailed(ctx context.Context, id uuid.UUID, errMsg string) error {
	query := `
		UPDATE wi_translation_jobs
		SET status = 'failed', error_message = $2,
		    message = 'Gagal: ' || $2, updated_at = NOW()
		WHERE id = $1
	`
	_, err := r.db.Exec(ctx, query, id, errMsg)
	return err
}

func (r *WITranslatorRepository) Delete(ctx context.Context, id uuid.UUID) (*model.WITranslationJob, error) {
	job, err := r.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	query := `DELETE FROM wi_translation_jobs WHERE id = $1`
	if _, err := r.db.Exec(ctx, query, id); err != nil {
		return nil, err
	}
	return job, nil
}

func (r *WITranslatorRepository) DeleteBatch(ctx context.Context, ids []uuid.UUID) ([]*model.WITranslationJob, error) {
	if len(ids) == 0 {
		return nil, nil
	}

	var jobs []*model.WITranslationJob
	for _, id := range ids {
		job, err := r.GetByID(ctx, id)
		if err == nil && job != nil {
			jobs = append(jobs, job)
		}
	}

	query := `DELETE FROM wi_translation_jobs WHERE id = ANY($1)`
	if _, err := r.db.Exec(ctx, query, ids); err != nil {
		return nil, err
	}
	return jobs, nil
}

func (r *WITranslatorRepository) GetPendingJobs(ctx context.Context, specificIDs []uuid.UUID) ([]*model.WITranslationJob, error) {
	var query string
	var rowsArgs []interface{}

	if len(specificIDs) > 0 {
		query = `
			SELECT id, user_id, file_name, file_path, file_size, target_lang, mode,
			       status, current_page, total_pages, progress_percent, message,
			       translated_count, duration_sec, translated_file, download_url,
			       error_message, created_at, updated_at
			FROM wi_translation_jobs
			WHERE id = ANY($1) AND status != 'processing'
			ORDER BY created_at ASC
		`
		rowsArgs = append(rowsArgs, specificIDs)
	} else {
		query = `
			SELECT id, user_id, file_name, file_path, file_size, target_lang, mode,
			       status, current_page, total_pages, progress_percent, message,
			       translated_count, duration_sec, translated_file, download_url,
			       error_message, created_at, updated_at
			FROM wi_translation_jobs
			WHERE status = 'pending'
			ORDER BY created_at ASC
			LIMIT 10
		`
	}

	rows, err := r.db.Query(ctx, query, rowsArgs...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var jobs []*model.WITranslationJob
	for rows.Next() {
		var job model.WITranslationJob
		if err := rows.Scan(
			&job.ID, &job.UserID, &job.FileName, &job.FilePath, &job.FileSize,
			&job.TargetLang, &job.Mode, &job.Status, &job.CurrentPage, &job.TotalPages,
			&job.ProgressPercent, &job.Message, &job.TranslatedCount, &job.DurationSec,
			&job.TranslatedFile, &job.DownloadURL, &job.ErrorMessage,
			&job.CreatedAt, &job.UpdatedAt,
		); err != nil {
			return nil, err
		}
		jobs = append(jobs, &job)
	}
	return jobs, nil
}
