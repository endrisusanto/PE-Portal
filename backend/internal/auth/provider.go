package auth

import (
	"context"

	"pe-portal/internal/model"
)

// AuthProvider defines the interface for authenticating users
// This allows swapping between Local database authentication and Active Directory LDAP without altering business logic.
type AuthProvider interface {
	Authenticate(ctx context.Context, username, password string) (*model.User, error)
	Type() string
}
