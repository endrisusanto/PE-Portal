package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"pe-portal/internal/model"
)

var ErrInvalidPassword = errors.New("incorrect password. access denied")

type TrainingRepository struct {
	pool *pgxpool.Pool
}

func NewTrainingRepository(pool *pgxpool.Pool) *TrainingRepository {
	return &TrainingRepository{pool: pool}
}

// List returns employee training modules (hiding passwords and secret answer keys)
func (r *TrainingRepository) List(ctx context.Context, category, mandatoryStr, search string, limit, offset int) ([]model.TrainingModule, int, error) {
	where := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1

	if category != "" && category != "ALL" {
		where = append(where, fmt.Sprintf("category = $%d", argIdx))
		args = append(args, category)
		argIdx++
	}

	if mandatoryStr == "true" {
		where = append(where, "is_mandatory = TRUE")
	} else if mandatoryStr == "false" {
		where = append(where, "is_mandatory = FALSE")
	}

	if search != "" {
		s := "%" + strings.ToLower(search) + "%"
		where = append(where, fmt.Sprintf("(LOWER(title) LIKE $%d OR LOWER(description) LIKE $%d OR LOWER(category) LIKE $%d)", argIdx, argIdx, argIdx))
		args = append(args, s)
		argIdx++
	}

	whereClause := strings.Join(where, " AND ")

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM training_modules WHERE %s", whereClause)
	var total int
	if err := r.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count training modules: %w", err)
	}

	if limit <= 0 {
		limit = 50
	}
	query := fmt.Sprintf(`
		SELECT id, title, category, description, link_url, deadline, is_mandatory, banner_image, has_answer_key, created_at, updated_at
		FROM training_modules
		WHERE %s
		ORDER BY is_mandatory DESC, deadline ASC NULLS LAST, id DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list training modules: %w", err)
	}
	defer rows.Close()

	var list []model.TrainingModule
	for rows.Next() {
		var m model.TrainingModule
		if err := rows.Scan(&m.ID, &m.Title, &m.Category, &m.Description, &m.LinkURL, &m.Deadline, &m.IsMandatory, &m.BannerImage, &m.HasAnswerKey, &m.CreatedAt, &m.UpdatedAt); err != nil {
			return nil, 0, fmt.Errorf("failed to scan training module: %w", err)
		}
		m.IsLocked = m.HasAnswerKey
		list = append(list, m)
	}

	return list, total, nil
}

// Get fetches one module by id
func (r *TrainingRepository) Get(ctx context.Context, id int) (*model.TrainingModule, error) {
	query := `
		SELECT id, title, category, description, link_url, deadline, is_mandatory, banner_image, has_answer_key,
		       COALESCE(answer_key_images, '[]'::jsonb), COALESCE(answer_key_notes, ''), created_at, updated_at
		FROM training_modules WHERE id = $1
	`
	var m model.TrainingModule
	var rawImages []byte
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&m.ID, &m.Title, &m.Category, &m.Description, &m.LinkURL, &m.Deadline,
		&m.IsMandatory, &m.BannerImage, &m.HasAnswerKey, &rawImages, &m.AnswerKeyNotes,
		&m.CreatedAt, &m.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	_ = json.Unmarshal(rawImages, &m.AnswerKeyImages)
	m.IsLocked = m.HasAnswerKey
	return &m, nil
}

// VerifyAndUnlock verifies the provided password and unlocks the answer keys
func (r *TrainingRepository) VerifyAndUnlock(ctx context.Context, id int, password string) (*model.TrainingAnswerKey, error) {
	query := `
		SELECT id, title, has_answer_key, answer_key_password, answer_key_images, answer_key_notes
		FROM training_modules WHERE id = $1
	`
	var mID int
	var title string
	var hasAnswerKey bool
	var storedPass string
	var rawImages []byte
	var notes string

	err := r.pool.QueryRow(ctx, query, id).Scan(&mID, &title, &hasAnswerKey, &storedPass, &rawImages, &notes)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("training module not found")
		}
		return nil, err
	}

	if !hasAnswerKey {
		return nil, fmt.Errorf("this training module has no post-test answer keys")
	}

	// Compare password (support both direct match or universal pass "2025")
	if strings.TrimSpace(password) == "" || (storedPass != "" && password != storedPass && password != "2025") {
		return nil, ErrInvalidPassword
	}

	var images []string
	if len(rawImages) > 0 {
		_ = json.Unmarshal(rawImages, &images)
	}

	return &model.TrainingAnswerKey{
		ID:              mID,
		Title:           title,
		AnswerKeyImages: images,
		AnswerKeyNotes:  notes,
	}, nil
}

// Create inserts a new training module
func (r *TrainingRepository) Create(ctx context.Context, req *model.TrainingCreateRequest) (*model.TrainingModule, error) {
	var deadlineVal *time.Time
	if req.Deadline != "" {
		if t, err := time.Parse(time.RFC3339, req.Deadline); err == nil {
			deadlineVal = &t
		} else if t, err := time.Parse("2006-01-02", req.Deadline); err == nil {
			deadlineVal = &t
		}
	}

	imagesJSON, _ := json.Marshal(req.AnswerKeyImages)

	query := `
		INSERT INTO training_modules (title, category, description, link_url, deadline, is_mandatory, banner_image, has_answer_key, answer_key_password, answer_key_images, answer_key_notes, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
		RETURNING id, created_at, updated_at
	`
	var m model.TrainingModule
	m.Title = req.Title
	m.Category = req.Category
	m.Description = req.Description
	m.LinkURL = req.LinkURL
	m.Deadline = deadlineVal
	m.IsMandatory = req.IsMandatory
	m.BannerImage = req.BannerImage
	m.HasAnswerKey = req.HasAnswerKey
	m.IsLocked = req.HasAnswerKey

	err := r.pool.QueryRow(ctx, query,
		req.Title, req.Category, req.Description, req.LinkURL, deadlineVal, req.IsMandatory, req.BannerImage, req.HasAnswerKey, req.AnswerKeyPassword, imagesJSON, req.AnswerKeyNotes,
	).Scan(&m.ID, &m.CreatedAt, &m.UpdatedAt)

	if err != nil {
		return nil, err
	}
	return &m, nil
}

// Update modifies an existing training module
func (r *TrainingRepository) Update(ctx context.Context, id int, req *model.TrainingCreateRequest) error {
	var deadlineVal *time.Time
	if req.Deadline != "" {
		if t, err := time.Parse(time.RFC3339, req.Deadline); err == nil {
			deadlineVal = &t
		} else if t, err := time.Parse("2006-01-02", req.Deadline); err == nil {
			deadlineVal = &t
		}
	}

	imagesJSON, _ := json.Marshal(req.AnswerKeyImages)

	query := `
		UPDATE training_modules
		SET title = $1, category = $2, description = $3, link_url = $4, deadline = $5, is_mandatory = $6, banner_image = $7, has_answer_key = $8,
		    answer_key_password = CASE WHEN $9 <> '' THEN $9 ELSE answer_key_password END,
		    answer_key_images = $10, answer_key_notes = $11, updated_at = NOW()
		WHERE id = $12
	`
	_, err := r.pool.Exec(ctx, query,
		req.Title, req.Category, req.Description, req.LinkURL, deadlineVal, req.IsMandatory, req.BannerImage, req.HasAnswerKey, req.AnswerKeyPassword, imagesJSON, req.AnswerKeyNotes, id,
	)
	return err
}

// Delete removes a training module
func (r *TrainingRepository) Delete(ctx context.Context, id int) error {
	_, err := r.pool.Exec(ctx, "DELETE FROM training_modules WHERE id = $1", id)
	return err
}
