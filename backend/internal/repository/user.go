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

	// Fetch all assigned group parts
	user.GroupPartIDs = []uuid.UUID{}
	user.GroupPartNames = []string{}
	partRows, err := r.pool.Query(ctx, `
		SELECT ugp.group_part_id, gp.name
		FROM user_group_parts ugp
		JOIN group_parts gp ON ugp.group_part_id = gp.id
		WHERE ugp.user_id = $1
		ORDER BY gp.sort_order ASC, gp.name ASC
	`, user.ID)
	if err == nil {
		defer partRows.Close()
		for partRows.Next() {
			var pid uuid.UUID
			var pname string
			if err := partRows.Scan(&pid, &pname); err == nil {
				user.GroupPartIDs = append(user.GroupPartIDs, pid)
				user.GroupPartNames = append(user.GroupPartNames, pname)
			}
		}
	}
	if len(user.GroupPartIDs) == 0 && user.GroupPartID != nil {
		user.GroupPartIDs = append(user.GroupPartIDs, *user.GroupPartID)
		if user.GroupPartName != nil {
			user.GroupPartNames = append(user.GroupPartNames, *user.GroupPartName)
		}
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
		  AND ($1::uuid IS NULL OR u.group_part_id = $1 OR EXISTS (
		      SELECT 1 FROM user_group_parts ugp WHERE ugp.user_id = u.id AND ugp.group_part_id = $1
		  ))
		  AND ($2 = '' OR u.role = $2)
		ORDER BY u.full_name ASC
	`

	rows, err := r.pool.Query(ctx, query, groupPartID, role)
	if err != nil {
		return nil, fmt.Errorf("failed to list users: %w", err)
	}
	defer rows.Close()

	users := []model.User{}
	userMap := make(map[uuid.UUID]int)
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
		u.GroupPartIDs = []uuid.UUID{}
		u.GroupPartNames = []string{}
		userMap[u.ID] = len(users)
		users = append(users, u)
	}

	// Batch load all user_group_parts
	if len(users) > 0 {
		partRows, err := r.pool.Query(ctx, `
			SELECT ugp.user_id, ugp.group_part_id, gp.name
			FROM user_group_parts ugp
			JOIN group_parts gp ON ugp.group_part_id = gp.id
			ORDER BY gp.sort_order ASC, gp.name ASC
		`)
		if err == nil {
			defer partRows.Close()
			for partRows.Next() {
				var uid, pid uuid.UUID
				var pname string
				if err := partRows.Scan(&uid, &pid, &pname); err == nil {
					if idx, ok := userMap[uid]; ok {
						users[idx].GroupPartIDs = append(users[idx].GroupPartIDs, pid)
						users[idx].GroupPartNames = append(users[idx].GroupPartNames, pname)
					}
				}
			}
		}

		// Fallback to single group_part if user_group_parts not populated yet
		for i := range users {
			if len(users[i].GroupPartIDs) == 0 && users[i].GroupPartID != nil {
				users[i].GroupPartIDs = append(users[i].GroupPartIDs, *users[i].GroupPartID)
				if users[i].GroupPartName != nil {
					users[i].GroupPartNames = append(users[i].GroupPartNames, *users[i].GroupPartName)
				}
			}
		}
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

	// Pick primary group part ID
	if u.GroupPartID == nil && len(u.GroupPartIDs) > 0 {
		u.GroupPartID = &u.GroupPartIDs[0]
	}

	query := `
		INSERT INTO users (id, employee_id, username, email, password_hash, full_name, avatar_path, preferred_lang, group_part_id, role, auth_provider, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		ON CONFLICT (username) DO UPDATE
		SET employee_id = EXCLUDED.employee_id,
		    email = EXCLUDED.email,
		    password_hash = EXCLUDED.password_hash,
		    full_name = EXCLUDED.full_name,
		    group_part_id = EXCLUDED.group_part_id,
		    role = EXCLUDED.role,
		    is_active = true,
		    deleted_at = NULL,
		    updated_at = NOW()
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

	// Insert into user_group_parts
	for _, gid := range u.GroupPartIDs {
		_, _ = r.pool.Exec(ctx, `
			INSERT INTO user_group_parts (user_id, group_part_id) VALUES ($1, $2)
			ON CONFLICT (user_id, group_part_id) DO NOTHING
		`, u.ID, gid)
	}

	return r.GetByID(ctx, u.ID)
}

func (r *UserRepository) UpdateUser(ctx context.Context, u *model.User, newPassword string) (*model.User, error) {
	// Pick primary group part ID
	if u.GroupPartID == nil && len(u.GroupPartIDs) > 0 {
		u.GroupPartID = &u.GroupPartIDs[0]
	}

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

	// Sync user_group_parts
	_, _ = r.pool.Exec(ctx, "DELETE FROM user_group_parts WHERE user_id = $1", u.ID)
	for _, gid := range u.GroupPartIDs {
		_, _ = r.pool.Exec(ctx, `
			INSERT INTO user_group_parts (user_id, group_part_id) VALUES ($1, $2)
			ON CONFLICT (user_id, group_part_id) DO NOTHING
		`, u.ID, gid)
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
	_, _ = r.pool.Exec(ctx, "DELETE FROM user_group_parts WHERE user_id = $1", userID)
	query := `DELETE FROM users WHERE id = $1`
	_, err := r.pool.Exec(ctx, query, userID)
	return err
}
