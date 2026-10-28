-- 023_tools_wi_translator_permission.sql
-- Register Working Instruction Translator under Tools > Dokumen in menu_permissions

INSERT INTO menu_permissions (
    menu_key, label, path, category, parent_key, is_visible, 
    allowed_roles, allowed_groups, allowed_users, blocked_users, sort_order
)
VALUES (
    'tools-wi-translator', 
    'Working Instruction Translator', 
    '/tools/wi-translator', 
    'Tools > Dokumen', 
    'tools', 
    true, 
    ARRAY['admin', 'manager', 'member', 'guest'], 
    ARRAY[]::TEXT[], 
    ARRAY[]::TEXT[], 
    ARRAY[]::TEXT[], 
    124
)
ON CONFLICT (menu_key) DO UPDATE
SET label = EXCLUDED.label, 
    path = EXCLUDED.path, 
    category = EXCLUDED.category, 
    parent_key = EXCLUDED.parent_key, 
    sort_order = EXCLUDED.sort_order;
