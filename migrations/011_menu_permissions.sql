-- Migration 011: Side Menu Permissions & Role/Part-Based Visibility
-- Allows administrators to enable/disable menus and control access based on user role and department part

CREATE TABLE IF NOT EXISTS menu_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_key VARCHAR(50) UNIQUE NOT NULL,
    label VARCHAR(100) NOT NULL,
    path VARCHAR(100) NOT NULL,
    category VARCHAR(50) DEFAULT 'operations', -- 'prime', 'operations', 'admin'
    is_visible BOOLEAN DEFAULT true,
    allowed_roles TEXT[] DEFAULT ARRAY['admin', 'manager', 'member', 'guest'],
    allowed_groups TEXT[] DEFAULT ARRAY[]::TEXT[], -- empty array means accessible to ALL groups/parts
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed initial menu items with default access
INSERT INTO menu_permissions (menu_key, label, path, category, is_visible, allowed_roles, allowed_groups, sort_order) VALUES
('dashboard', 'Dashboard', '/', 'prime', true, ARRAY['admin', 'manager', 'member', 'guest'], ARRAY[]::TEXT[], 1),
('articles', 'Articles / IMEI', '/articles', 'operations', true, ARRAY['admin', 'manager', 'member', 'guest'], ARRAY[]::TEXT[], 2),
('documents', 'Documents', '/documents', 'operations', true, ARRAY['admin', 'manager', 'member', 'guest'], ARRAY[]::TEXT[], 3),
('innovations', 'Innovations', '/innovations', 'operations', true, ARRAY['admin', 'manager', 'member', 'guest'], ARRAY[]::TEXT[], 4),
('models', 'Models & Line Balance', '/models', 'operations', true, ARRAY['admin', 'manager', 'member', 'guest'], ARRAY[]::TEXT[], 5),
('gmes', 'GMES Monitor', '/gmes', 'operations', true, ARRAY['admin', 'manager', 'member', 'guest'], ARRAY[]::TEXT[], 6),
('training', 'Online Training', '/training', 'operations', true, ARRAY['admin', 'manager', 'member', 'guest'], ARRAY[]::TEXT[], 7),
('sample-management', 'Sample Management', '/samples', 'operations', true, ARRAY['admin', 'manager', 'member', 'guest'], ARRAY[]::TEXT[], 8),
('software-team', 'Software Team (GBA & MR)', '/software-mr', 'operations', true, ARRAY['admin', 'manager', 'member', 'guest'], ARRAY[]::TEXT[], 9),
('projects', 'Task Analyst', '/projects', 'operations', true, ARRAY['admin', 'manager', 'member', 'guest'], ARRAY[]::TEXT[], 10),
('team', 'Team Organization', '/team', 'operations', true, ARRAY['admin', 'manager', 'member', 'guest'], ARRAY[]::TEXT[], 11),
('tools', 'Tools & Utilities', '/tools', 'operations', true, ARRAY['admin', 'manager', 'member', 'guest'], ARRAY[]::TEXT[], 12),
('reports', 'Reports', '/reports', 'operations', true, ARRAY['admin', 'manager', 'member', 'guest'], ARRAY[]::TEXT[], 13),
('admin', 'Admin Control', '/admin', 'admin', true, ARRAY['admin'], ARRAY[]::TEXT[], 14)
ON CONFLICT (menu_key) DO UPDATE
SET label = EXCLUDED.label, path = EXCLUDED.path, category = EXCLUDED.category, sort_order = EXCLUDED.sort_order;
