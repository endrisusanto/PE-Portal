package auth

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"time"

	"github.com/go-ldap/ldap/v3"
	"github.com/jackc/pgx/v5/pgxpool"

	"pe-portal/internal/config"
	"pe-portal/internal/model"
)

// LDAPAuthProvider authenticates against Corporate Active Directory via LDAP
// with fallback to local accounts (admin) and JIT auto-registration for new LDAP users.
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

// Authenticate verifies user credentials with local accounts first (e.g. admin),
// and falls back to Active Directory LDAP with auto-registration for new users.
func (l *LDAPAuthProvider) Authenticate(ctx context.Context, username, password string) (*model.User, error) {
	// 1. Try local authentication first
	// This ensures built-in accounts (like 'admin') can always log in even if they do not exist in LDAP
	localAuth := NewLocalAuthProvider(l.pool)
	if localUser, localErr := localAuth.Authenticate(ctx, username, password); localErr == nil {
		return localUser, nil
	}

	// 2. If username is "admin" and local auth failed with bad password, do not search LDAP
	if username == "admin" {
		return nil, errors.New("invalid credentials for admin account")
	}

	// 3. Connect to LDAP server
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

	// 4. Service Bind
	if l.cfg.LDAPBindDN != "" {
		if err := conn.Bind(l.cfg.LDAPBindDN, l.cfg.LDAPBindPassword); err != nil {
			return nil, fmt.Errorf("service bind to LDAP failed: %w", err)
		}
	}

	// 5. Search user in LDAP directory
	searchFilter := fmt.Sprintf("(sAMAccountName=%s)", ldap.EscapeFilter(username))
	searchRequest := ldap.NewSearchRequest(
		l.cfg.LDAPBaseDN,
		ldap.ScopeWholeSubtree, ldap.NeverDerefAliases, 0, 0, false,
		searchFilter,
		[]string{"dn", "cn", "displayName", "mail", "userPrincipalName", "sAMAccountName", "employeeID", "employeeNumber"},
		nil,
	)

	sr, err := conn.Search(searchRequest)
	if err != nil || len(sr.Entries) == 0 {
		return nil, errors.New("user not found in LDAP directory")
	}

	userEntry := sr.Entries[0]
	userDN := userEntry.DN

	// 6. User Bind (Authenticate user with LDAP password)
	userConn, err := ldap.Dial("tcp", addr)
	if err != nil {
		return nil, fmt.Errorf("cannot connect for user bind: %w", err)
	}
	defer userConn.Close()

	if err := userConn.Bind(userDN, password); err != nil {
		return nil, errors.New("invalid LDAP credentials")
	}

	// 7. Check if local user already exists
	query := `
		SELECT u.id, u.employee_id, u.username, u.email,
		       u.full_name, u.avatar_path, u.preferred_lang, u.group_part_id,
		       u.role, u.auth_provider, u.is_active, u.created_at, u.updated_at
		FROM users u
		WHERE (u.username = $1 OR LOWER(u.username) = LOWER($1))
	`
	var existing model.User
	err = l.pool.QueryRow(ctx, query, username).Scan(
		&existing.ID, &existing.EmployeeID, &existing.Username, &existing.Email,
		&existing.FullName, &existing.AvatarPath, &existing.PreferredLang, &existing.GroupPartID,
		&existing.Role, &existing.AuthProvider, &existing.IsActive, &existing.CreatedAt, &existing.UpdatedAt,
	)
	if err == nil {
		// ponytail: If user was previously soft-deleted or deactivated, reactivate immediately upon verified LDAP authentication
		go func(uid string) {
			_, _ = l.pool.Exec(context.Background(), "UPDATE users SET deleted_at = NULL, is_active = true, last_login_at = NOW(), updated_at = NOW() WHERE id = $1", uid)
		}(existing.ID.String())
		existing.IsActive = true
		return &existing, nil
	}

	// 8. Auto-provision (JIT Register) new user from LDAP
	fullName := userEntry.GetAttributeValue("cn")
	if fullName == "" {
		fullName = userEntry.GetAttributeValue("displayName")
	}
	if fullName == "" {
		fullName = username
	}

	email := userEntry.GetAttributeValue("mail")
	if email == "" {
		email = userEntry.GetAttributeValue("userPrincipalName")
	}
	if email == "" {
		email = fmt.Sprintf("%s@samsungelectronics.net", username)
	}

	employeeID := userEntry.GetAttributeValue("employeeID")
	if employeeID == "" {
		employeeID = userEntry.GetAttributeValue("employeeNumber")
	}
	if employeeID == "" {
		employeeID = username
	}
	if len(employeeID) > 20 {
		employeeID = employeeID[:20]
	}

	// Set initial role: 'admin' for endri.s, 'member' for all others
	role := "member"
	if username == "endri.s" {
		role = "admin"
	}

	insertQuery := `
		INSERT INTO users (
			id, employee_id, username, email, full_name,
			preferred_lang, role, auth_provider, is_active,
			last_login_at, created_at, updated_at
		) VALUES (
			gen_random_uuid(), $1, $2, $3, $4,
			'en', $5, 'ldap', true,
			NOW(), NOW(), NOW()
		)
		ON CONFLICT (username) DO UPDATE
		SET full_name = EXCLUDED.full_name,
		    email = EXCLUDED.email,
		    is_active = true,
		    deleted_at = NULL,
		    last_login_at = NOW(),
		    updated_at = NOW()
		RETURNING id, employee_id, username, email, full_name, avatar_path, preferred_lang, group_part_id, role, auth_provider, is_active, created_at, updated_at
	`
	var newUser model.User
	err = l.pool.QueryRow(ctx, insertQuery, employeeID, username, email, fullName, role).Scan(
		&newUser.ID, &newUser.EmployeeID, &newUser.Username, &newUser.Email,
		&newUser.FullName, &newUser.AvatarPath, &newUser.PreferredLang, &newUser.GroupPartID,
		&newUser.Role, &newUser.AuthProvider, &newUser.IsActive, &newUser.CreatedAt, &newUser.UpdatedAt,
	)
	if err != nil {
		// Fallback if employeeID conflicted with another row
		fallbackEmpID := fmt.Sprintf("LDAP_%d", time.Now().Unix()%1000000000)
		err = l.pool.QueryRow(ctx, insertQuery, fallbackEmpID, username, email, fullName, role).Scan(
			&newUser.ID, &newUser.EmployeeID, &newUser.Username, &newUser.Email,
			&newUser.FullName, &newUser.AvatarPath, &newUser.PreferredLang, &newUser.GroupPartID,
			&newUser.Role, &newUser.AuthProvider, &newUser.IsActive, &newUser.CreatedAt, &newUser.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to auto-register LDAP user: %w", err)
		}
	}

	return &newUser, nil
}
