package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"pe-portal/internal/model"
)

type EmailListRepository struct {
	pool *pgxpool.Pool
}

func NewEmailListRepository(pool *pgxpool.Pool) *EmailListRepository {
	return &EmailListRepository{pool: pool}
}

func (r *EmailListRepository) GetByUserID(ctx context.Context, userID uuid.UUID) ([]model.UserEmailList, error) {
	query := `
		SELECT id, user_id, name, emails, COALESCE(description, ''), created_at, updated_at
		FROM user_email_lists
		WHERE user_id = $1
		ORDER BY name ASC
	`
	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var lists []model.UserEmailList
	for rows.Next() {
		var l model.UserEmailList
		if err := rows.Scan(&l.ID, &l.UserID, &l.Name, &l.Emails, &l.Description, &l.CreatedAt, &l.UpdatedAt); err != nil {
			return nil, err
		}
		lists = append(lists, l)
	}
	return lists, nil
}

func (r *EmailListRepository) Create(ctx context.Context, l *model.UserEmailList) (*model.UserEmailList, error) {
	query := `
		INSERT INTO user_email_lists (user_id, name, emails, description)
		VALUES ($1, $2, $3, $4)
		RETURNING id, user_id, name, emails, COALESCE(description, ''), created_at, updated_at
	`
	var created model.UserEmailList
	err := r.pool.QueryRow(ctx, query, l.UserID, l.Name, l.Emails, l.Description).Scan(
		&created.ID, &created.UserID, &created.Name, &created.Emails, &created.Description, &created.CreatedAt, &created.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &created, nil
}

func (r *EmailListRepository) Delete(ctx context.Context, id, userID uuid.UUID) error {
	query := `DELETE FROM user_email_lists WHERE id = $1 AND user_id = $2`
	_, err := r.pool.Exec(ctx, query, id, userID)
	return err
}
