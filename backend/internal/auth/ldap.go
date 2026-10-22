package auth

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"

	"github.com/go-ldap/ldap/v3"
	"github.com/jackc/pgx/v5/pgxpool"

	"pe-portal/internal/config"
	"pe-portal/internal/model"
)

// LDAPAuthProvider authenticates against Corporate Active Directory via LDAP
type LDAPAuthProvider struct {
	cfg  *config.Config
	pool *pgxpool.Pool
}

// NewLDAPAuthProvider creates a new instance of LDAPAuthProvider
func NewLDAPAuthProvider(cfg *config.Config, pool *pgxpool.Pool) *LDAPAuthProvider {
	return &LDAPAuthProvider{cfg: cfg, pool: pool}
}

func (l *LDAPAuthProvider) Type() string {
	return "ldap"
}

// Authenticate verifies user credentials with the Active Directory LDAP server
func (l *LDAPAuthProvider) Authenticate(ctx context.Context, username, password string) (*model.User, error) {
	// ponytail: allow local admin / break-glass accounts to login even when LDAP is enabled
	localAuth := NewLocalAuthProvider(l.pool)
	if user, err := localAuth.Authenticate(ctx, username, password); err == nil {
		return user, nil
	}

	if l.cfg.LDAPHost == "" {
		return nil, errors.New("LDAP host is not configured; check settings or environment variables")
	}

	port := l.cfg.LDAPPort
	if port <= 0 {
		port = 389
	}
	addr := fmt.Sprintf("%s:%d", l.cfg.LDAPHost, port)
	var conn *ldap.Conn
	var err error

	if port == 636 {
		conn, err = ldap.DialTLS("tcp", addr, &tls.Config{InsecureSkipVerify: true})
	} else {
		conn, err = ldap.Dial("tcp", addr)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to connect to LDAP server at %s: %w", addr, err)
	}
	defer conn.Close()

	// 1. Service Bind
	if l.cfg.LDAPBindDN != "" {
		if err := conn.Bind(l.cfg.LDAPBindDN, l.cfg.LDAPBindPassword); err != nil {
			return nil, fmt.Errorf("service bind to LDAP failed: %w", err)
		}
	}

	// 2. Search user
	searchFilter := fmt.Sprintf("(sAMAccountName=%s)", ldap.EscapeFilter(username))
	searchRequest := ldap.NewSearchRequest(
		l.cfg.LDAPBaseDN,
		ldap.ScopeWholeSubtree, ldap.NeverDerefAliases, 0, 0, false,
		searchFilter,
		[]string{"dn", "cn", "mail", "sAMAccountName", "employeeID"},
		nil,
	)

	sr, err := conn.Search(searchRequest)
	if err != nil || len(sr.Entries) == 0 {
		return nil, errors.New("user not found in LDAP directory")
	}

	userEntry := sr.Entries[0]
	userDN := userEntry.DN

	// 3. User Bind (Authenticate password)
	userConn, err := ldap.Dial("tcp", addr)
	if err != nil {
		return nil, fmt.Errorf("cannot connect for user bind: %w", err)
	}
	defer userConn.Close()

	if err := userConn.Bind(userDN, password); err != nil {
		return nil, errors.New("invalid LDAP credentials")
	}

	// 4. Map or sync into local users table
	localAuth := NewLocalAuthProvider(l.pool)
	user, err := localAuth.Authenticate(ctx, username, password)
	if err == nil {
		return user, nil
	}

	// ponytail: if local user entry already exists with matching username, return it
	query := `
		SELECT u.id, u.employee_id, u.username, u.email,
		       u.full_name, u.avatar_path, u.preferred_lang, u.group_part_id,
		       u.role, u.auth_provider, u.is_active, u.created_at, u.updated_at
		FROM users u
		WHERE u.username = $1 AND u.deleted_at IS NULL
	`
	var existing model.User
	err = l.pool.QueryRow(ctx, query, username).Scan(
		&existing.ID, &existing.EmployeeID, &existing.Username, &existing.Email,
		&existing.FullName, &existing.AvatarPath, &existing.PreferredLang, &existing.GroupPartID,
		&existing.Role, &existing.AuthProvider, &existing.IsActive, &existing.CreatedAt, &existing.UpdatedAt,
	)
	if err == nil {
		return &existing, nil
	}

	return nil, errors.New("LDAP authentication succeeded but user has no PE-Portal account assigned")
}
