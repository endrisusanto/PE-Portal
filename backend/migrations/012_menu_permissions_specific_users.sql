-- Migration 012: Add allowed_users to menu_permissions and seed training-answer-key
-- Allows fine-grained access control down to individual users (specific user) and controls Post-Test Answer Key visibility

ALTER TABLE menu_permissions 
ADD COLUMN IF NOT EXISTS allowed_users TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Seed or update training-answer-key entry
INSERT INTO menu_permissions (menu_key, label, path, category, is_visible, allowed_roles, allowed_groups, allowed_users, sort_order)
VALUES ('training-answer-key', 'Kunci Jawaban Online Training', '/training#answer-key', 'operations', true, ARRAY['admin', 'manager', 'member', 'guest'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 8)
ON CONFLICT (menu_key) DO UPDATE
SET label = EXCLUDED.label, path = EXCLUDED.path, category = EXCLUDED.category;
