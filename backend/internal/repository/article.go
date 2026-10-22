package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"pe-portal/internal/model"
)

type ArticleRepository struct {
	pool *pgxpool.Pool
}

func NewArticleRepository(pool *pgxpool.Pool) *ArticleRepository {
	return &ArticleRepository{pool: pool}
}

// Backward compatibility alias
type ImeiRepository = ArticleRepository

func NewImeiRepository(pool *pgxpool.Pool) *ImeiRepository {
	return NewArticleRepository(pool)
}

func (r *ArticleRepository) List(ctx context.Context, modelID, projectID *uuid.UUID, search string) ([]model.ImeiArticle, error) {
	query := `
		SELECT a.id, a.title, a.content, a.model_id, nm.model_name,
		       a.project_id, a.author_id, u.full_name as author_name,
		       a.tags, a.is_pinned, a.created_at, a.updated_at
		FROM imei_articles a
		LEFT JOIN new_models nm ON a.model_id = nm.id
		LEFT JOIN users u ON a.author_id = u.id
		WHERE a.deleted_at IS NULL
		  AND ($1::uuid IS NULL OR a.model_id = $1)
		  AND ($2::uuid IS NULL OR a.project_id = $2)
		  AND ($3 = '' OR a.title ILIKE '%' || $3 || '%' OR a.content ILIKE '%' || $3 || '%')
		ORDER BY a.is_pinned DESC, a.created_at DESC
	`

	rows, err := r.pool.Query(ctx, query, modelID, projectID, search)
	if err != nil {
		return nil, fmt.Errorf("failed to list articles: %w", err)
	}
	defer rows.Close()

	articles := []model.ImeiArticle{}
	for rows.Next() {
		var a model.ImeiArticle
		err := rows.Scan(
			&a.ID, &a.Title, &a.Content, &a.ModelID, &a.ModelName,
			&a.ProjectID, &a.AuthorID, &a.AuthorName,
			&a.Tags, &a.IsPinned, &a.CreatedAt, &a.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		articles = append(articles, a)
	}
	return articles, nil
}

func (r *ArticleRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.ImeiArticle, error) {
	query := `
		SELECT a.id, a.title, a.content, a.model_id, nm.model_name,
		       a.project_id, a.author_id, u.full_name as author_name,
		       a.tags, a.is_pinned, a.created_at, a.updated_at
		FROM imei_articles a
		LEFT JOIN new_models nm ON a.model_id = nm.id
		LEFT JOIN users u ON a.author_id = u.id
		WHERE a.id = $1 AND a.deleted_at IS NULL
	`

	var a model.ImeiArticle
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&a.ID, &a.Title, &a.Content, &a.ModelID, &a.ModelName,
		&a.ProjectID, &a.AuthorID, &a.AuthorName,
		&a.Tags, &a.IsPinned, &a.CreatedAt, &a.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (r *ArticleRepository) Create(ctx context.Context, a *model.ImeiArticle) (*model.ImeiArticle, error) {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	if len(a.Tags) == 0 {
		a.Tags = json.RawMessage("[]")
	}

	query := `
		INSERT INTO imei_articles (id, title, content, model_id, project_id, author_id, tags, is_pinned)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING created_at, updated_at
	`

	err := r.pool.QueryRow(ctx, query,
		a.ID, a.Title, a.Content, a.ModelID, a.ProjectID, a.AuthorID, a.Tags, a.IsPinned,
	).Scan(&a.CreatedAt, &a.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create article: %w", err)
	}

	return r.GetByID(ctx, a.ID)
}

func (r *ArticleRepository) Update(ctx context.Context, a *model.ImeiArticle) (*model.ImeiArticle, error) {
	query := `
		UPDATE imei_articles
		SET title = $1, content = $2, model_id = $3, project_id = $4,
		    tags = $5, is_pinned = $6, updated_at = NOW()
		WHERE id = $7 AND deleted_at IS NULL
	`
	_, err := r.pool.Exec(ctx, query,
		a.Title, a.Content, a.ModelID, a.ProjectID, a.Tags, a.IsPinned, a.ID,
	)
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, a.ID)
}

func (r *ArticleRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE imei_articles SET deleted_at = NOW() WHERE id = $1`
	_, err := r.pool.Exec(ctx, query, id)
	return err
}
