package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"pe-portal/internal/model"
)

type UserRepository struct {
	pool *pgxpool.Pool
}

func NewUserRepository(pool *pgxpool.Pool) *UserRepository {
	return &UserRepository{pool: pool}
}

func (r *UserRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.User, error) {
	query := `
		SELECT u.id, u.employee_id, u.username, u.email,
		       u.full_name, u.avatar_path, u.preferred_lang, u.group_part_id,
		       gp.name as group_part_name, gp.parent_group,
		       u.role, u.auth_provider, u.is_active, u.last_login_at, u.created_at, u.updated_at
		FROM users u
		LEFT JOIN group_parts gp ON u.group_part_id = gp.id
		WHERE u.id = $1 AND u.deleted_at IS NULL
	`

	var user model.User
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&user.ID, &user.EmployeeID, &user.Username, &user.Email,
		&user.FullName, &user.AvatarPath, &user.PreferredLang, &user.GroupPartID,
		&user.GroupPartName, &user.ParentGroup,
		&user.Role, &user.AuthProvider, &user.IsActive, &user.LastLoginAt, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("user not found")
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	return &user, nil
}

func (r *UserRepository) ListUsers(ctx context.Context, groupPartID *uuid.UUID, role string) ([]model.User, error) {
	query := `
		SELECT u.id, u.employee_id, u.username, u.email,
		       u.full_name, u.avatar_path, u.preferred_lang, u.group_part_id,
		       gp.name as group_part_name, gp.parent_group,
		       u.role, u.auth_provider, u.is_active, u.last_login_at, u.created_at, u.updated_at
		FROM users u
		LEFT JOIN group_parts gp ON u.group_part_id = gp.id
		WHERE u.deleted_at IS NULL
		  AND ($1::uuid IS NULL OR u.group_part_id = $1)
		  AND ($2 = '' OR u.role = $2)
		ORDER BY u.full_name ASC
	`

	rows, err := r.pool.Query(ctx, query, groupPartID, role)
	if err != nil {
		return nil, fmt.Errorf("failed to list users: %w", err)
	}
	defer rows.Close()

	users := []model.User{}
	for rows.Next() {
		var u model.User
		err := rows.Scan(
			&u.ID, &u.EmployeeID, &u.Username, &u.Email,
			&u.FullName, &u.AvatarPath, &u.PreferredLang, &u.GroupPartID,
			&u.GroupPartName, &u.ParentGroup,
			&u.Role, &u.AuthProvider, &u.IsActive, &u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		users = append(users, u)
	}

	return users, nil
}

func (r *UserRepository) CreateUser(ctx context.Context, u *model.User, rawPassword string) (*model.User, error) {
	var hash *string
	if rawPassword != "" {
		h, err := bcrypt.GenerateFromPassword([]byte(rawPassword), bcrypt.DefaultCost)
		if err != nil {
			return nil, fmt.Errorf("failed to hash password: %w", err)
		}
		strHash := string(h)
		hash = &strHash
	}

	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	if u.Role == "" {
		u.Role = "member"
	}
	if u.PreferredLang == "" {
		u.PreferredLang = "en"
	}
	if u.AuthProvider == "" {
		u.AuthProvider = "local"
	}
	u.IsActive = true
	now := time.Now()
	u.CreatedAt = now
	u.UpdatedAt = now

	query := `
		INSERT INTO users (id, employee_id, username, email, password_hash, full_name, avatar_path, preferred_lang, group_part_id, role, auth_provider, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		RETURNING id
	`

	err := r.pool.QueryRow(ctx, query,
		u.ID, u.EmployeeID, u.Username, u.Email, hash,
		u.FullName, u.AvatarPath, u.PreferredLang, u.GroupPartID,
		u.Role, u.AuthProvider, u.IsActive, u.CreatedAt, u.UpdatedAt,
	).Scan(&u.ID)

	if err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	return r.GetByID(ctx, u.ID)
}

func (r *UserRepository) UpdateUser(ctx context.Context, u *model.User, newPassword string) (*model.User, error) {
	query := `
		UPDATE users
		SET full_name = $1, email = $2, employee_id = $3,
		    group_part_id = $4, role = $5, is_active = $6, updated_at = NOW()
		WHERE id = $7 AND deleted_at IS NULL
	`

	_, err := r.pool.Exec(ctx, query, u.FullName, u.Email, u.EmployeeID, u.GroupPartID, u.Role, u.IsActive, u.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to update user: %w", err)
	}

	if newPassword != "" {
		h, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
		if err != nil {
			return nil, fmt.Errorf("failed to hash password: %w", err)
		}
		_, err = r.pool.Exec(ctx, "UPDATE users SET password_hash = $1 WHERE id = $2", string(h), u.ID)
		if err != nil {
			return nil, fmt.Errorf("failed to update password: %w", err)
		}
	}

	return r.GetByID(ctx, u.ID)
}

func (r *UserRepository) UpdatePreferences(ctx context.Context, userID uuid.UUID, fullName, lang string, avatarPath *string) error {
	query := `
		UPDATE users
		SET full_name = COALESCE(NULLIF($1, ''), full_name),
		    preferred_lang = COALESCE(NULLIF($2, ''), preferred_lang),
		    avatar_path = COALESCE($3, avatar_path),
		    updated_at = NOW()
		WHERE id = $4 AND deleted_at IS NULL
	`
	_, err := r.pool.Exec(ctx, query, fullName, lang, avatarPath, userID)
	return err
}

func (r *UserRepository) UpdateRole(ctx context.Context, userID uuid.UUID, role string) error {
	query := `UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL`
	_, err := r.pool.Exec(ctx, query, role, userID)
	return err
}

func (r *UserRepository) DeleteUser(ctx context.Context, userID uuid.UUID) error {
	query := `UPDATE users SET deleted_at = NOW(), is_active = false WHERE id = $1`
	_, err := r.pool.Exec(ctx, query, userID)
	return err
}
