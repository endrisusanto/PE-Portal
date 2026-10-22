package model

import (
	"time"

	"github.com/google/uuid"
)

// MenuPermission controls side menu visibility and role/part access
type MenuPermission struct {
	ID            uuid.UUID `json:"id"`
	MenuKey       string    `json:"menu_key"`
	Label         string    `json:"label"`
	Path          string    `json:"path"`
	Category      string    `json:"category"`
	IsVisible     bool      `json:"is_visible"`
	AllowedRoles  []string  `json:"allowed_roles"`
	AllowedGroups []string  `json:"allowed_groups"`
	SortOrder     int       `json:"sort_order"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// UpdateMenuPermissionRequest payload for modifying access rules
type UpdateMenuPermissionRequest struct {
	IsVisible     bool     `json:"is_visible"`
	AllowedRoles  []string `json:"allowed_roles"`
	AllowedGroups []string `json:"allowed_groups"`
}
