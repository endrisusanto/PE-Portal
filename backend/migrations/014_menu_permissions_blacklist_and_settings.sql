-- Migration 014: Add blocked_users (blacklist) and seed 'settings' menu item
-- Allows administrator to specify whitelist AND blacklist for specific users on every menu
-- and configures 'settings' menu with default admin-only access

ALTER TABLE menu_permissions 
ADD COLUMN IF NOT EXISTS blocked_users TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Seed or update settings entry with default admin-only access
INSERT INTO menu_permissions (menu_key, label, path, category, is_visible, allowed_roles, allowed_groups, allowed_users, blocked_users, sort_order)
VALUES ('settings', 'Settings', '/settings', 'admin', true, ARRAY['admin'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 15)
ON CONFLICT (menu_key) DO UPDATE
SET label = EXCLUDED.label, path = EXCLUDED.path, category = EXCLUDED.category;
