-- Migration 021: Project Calendar Menu
-- Registers the Project Calendar menu into dynamic menu permissions

INSERT INTO menu_permissions (menu_key, label, path, category, parent_key, is_visible, allowed_roles, allowed_groups, allowed_users, blocked_users, sort_order)
VALUES (
    'project-calendar',
    'Project Calendar',
    '/project-calendar',
    'operations',
    NULL,
    true,
    ARRAY['admin', 'manager', 'member', 'guest'],
    ARRAY[]::TEXT[],
    ARRAY[]::TEXT[],
    ARRAY[]::TEXT[],
    10
)
ON CONFLICT (menu_key) DO UPDATE
SET label = EXCLUDED.label,
    path = EXCLUDED.path,
    category = EXCLUDED.category,
    sort_order = EXCLUDED.sort_order;
