package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"pe-portal/internal/model"
)

type CommentRepository struct {
	pool *pgxpool.Pool
}

func NewCommentRepository(pool *pgxpool.Pool) *CommentRepository {
	return &CommentRepository{pool: pool}
}

func (r *CommentRepository) ListByEntity(ctx context.Context, entityType string, entityID uuid.UUID) ([]model.Comment, error) {
	query := `
		SELECT c.id, c.content, c.entity_type, c.entity_id,
		       c.author_id, u.full_name as author_name,
		       c.parent_id, c.reactions, c.created_at, c.updated_at
		FROM comments c
		LEFT JOIN users u ON c.author_id = u.id
		WHERE c.entity_type = $1 AND c.entity_id = $2 AND c.deleted_at IS NULL
		ORDER BY c.created_at ASC
	`

	rows, err := r.pool.Query(ctx, query, entityType, entityID)
	if err != nil {
		return nil, fmt.Errorf("failed to list comments: %w", err)
	}
	defer rows.Close()

	comments := []model.Comment{}
	for rows.Next() {
		var c model.Comment
		err := rows.Scan(
			&c.ID, &c.Content, &c.EntityType, &c.EntityID,
			&c.AuthorID, &c.AuthorName,
			&c.ParentID, &c.Reactions, &c.CreatedAt, &c.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		comments = append(comments, c)
	}
	return comments, nil
}

func (r *CommentRepository) Create(ctx context.Context, c *model.Comment) (*model.Comment, error) {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	if len(c.Reactions) == 0 {
		c.Reactions = json.RawMessage("{}")
	}

	query := `
		INSERT INTO comments (id, content, entity_type, entity_id, author_id, parent_id, reactions)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING created_at, updated_at
	`

	err := r.pool.QueryRow(ctx, query,
		c.ID, c.Content, c.EntityType, c.EntityID, c.AuthorID, c.ParentID, c.Reactions,
	).Scan(&c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create comment: %w", err)
	}

	return c, nil
}

func (r *CommentRepository) ToggleReaction(ctx context.Context, commentID, userID uuid.UUID, emoji string) error {
	// Retrieve current reactions json
	var raw json.RawMessage
	err := r.pool.QueryRow(ctx, "SELECT reactions FROM comments WHERE id = $1 AND deleted_at IS NULL", commentID).Scan(&raw)
	if err != nil {
		return err
	}

	reactions := make(map[string][]string)
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &reactions)
	}

	userStr := userID.String()
	userList := reactions[emoji]

	// Toggle: if user in list, remove; else add
	found := false
	newList := []string{}
	for _, u := range userList {
		if u == userStr {
			found = true
		} else {
			newList = append(newList, u)
		}
	}
	if !found {
		newList = append(newList, userStr)
	}

	if len(newList) == 0 {
		delete(reactions, emoji)
	} else {
		reactions[emoji] = newList
	}

	updatedJSON, err := json.Marshal(reactions)
	if err != nil {
		return err
	}

	_, err = r.pool.Exec(ctx, "UPDATE comments SET reactions = $1, updated_at = NOW() WHERE id = $2", updatedJSON, commentID)
	return err
}

func (r *CommentRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE comments SET deleted_at = NOW() WHERE id = $1`
	_, err := r.pool.Exec(ctx, query, id)
	return err
}
