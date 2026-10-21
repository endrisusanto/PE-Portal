package auth

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"pe-portal/internal/model"
)

// LocalAuthProvider authenticates users stored in PostgreSQL with bcrypt passwords
type LocalAuthProvider struct {
	pool *pgxpool.Pool
}

// NewLocalAuthProvider creates a new instance of LocalAuthProvider
func NewLocalAuthProvider(pool *pgxpool.Pool) *LocalAuthProvider {
	return &LocalAuthProvider{pool: pool}
}

func (l *LocalAuthProvider) Type() string {
	return "local"
}

// Authenticate verifies username and password against the local database
func (l *LocalAuthProvider) Authenticate(ctx context.Context, username, password string) (*model.User, error) {
	query := `
		SELECT u.id, u.employee_id, u.username, u.email, u.password_hash,
		       u.full_name, u.avatar_path, u.preferred_lang, u.group_part_id,
		       gp.name as group_part_name, gp.parent_group,
		       u.role, u.auth_provider, u.is_active, u.created_at, u.updated_at
		FROM users u
		LEFT JOIN group_parts gp ON u.group_part_id = gp.id
		WHERE (u.username = $1 OR u.email = $1)
		  AND u.deleted_at IS NULL
	`

	var user model.User
	var passwordHash *string

	err := l.pool.QueryRow(ctx, query, username).Scan(
		&user.ID, &user.EmployeeID, &user.Username, &user.Email, &passwordHash,
		&user.FullName, &user.AvatarPath, &user.PreferredLang, &user.GroupPartID,
		&user.GroupPartName, &user.ParentGroup,
		&user.Role, &user.AuthProvider, &user.IsActive, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("invalid credentials")
		}
		return nil, fmt.Errorf("failed to query user: %w", err)
	}

	if !user.IsActive {
		return nil, errors.New("user account is deactivated")
	}

	if passwordHash == nil || *passwordHash == "" {
		return nil, errors.New("password not set for this account")
	}

	// Verify bcrypt hash
	if err := bcrypt.CompareHashAndPassword([]byte(*passwordHash), []byte(password)); err != nil {
		return nil, errors.New("invalid credentials")
	}

	// Update last login timestamp asynchronously
	go func() {
		updateQuery := `UPDATE users SET last_login_at = $1, updated_at = $1 WHERE id = $2`
		_, _ = l.pool.Exec(context.Background(), updateQuery, time.Now(), user.ID)
	}()

	return &user, nil
}
