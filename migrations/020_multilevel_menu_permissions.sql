-- Migration 020: Multilevel Side Menu Permissions & Granular Access Control
-- Adds parent_key column and seeds sub-menus inside multilevel categories (Sample Management, Software Team, Tools, etc.)

ALTER TABLE menu_permissions 
ADD COLUMN IF NOT EXISTS parent_key VARCHAR(50);

-- Update training-answer-key parent_key
UPDATE menu_permissions SET parent_key = 'training' WHERE menu_key = 'training-answer-key';

-- Seed Sub-menus for Sample Management, Software Team, and Tools
INSERT INTO menu_permissions (menu_key, label, path, category, parent_key, is_visible, allowed_roles, allowed_groups, allowed_users, blocked_users, sort_order)
VALUES
-- Sample Management Sub-items
('sample-database', 'Database Sample PE', '/samples', 'Sample Management', 'sample-management', true, ARRAY['admin', 'manager', 'member', 'guest'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 81),
('sample-dhl', 'DHL Tracker', '/samples/dhl-tracker', 'Sample Management', 'sample-management', true, ARRAY['admin', 'manager', 'member', 'guest'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 82),

-- Software Team Sub-items
('software-gba', 'GBA Tasks', '/gba-tasks', 'Software Team', 'software-team', true, ARRAY['admin', 'manager', 'member', 'guest'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 91),
('software-mr', 'Software MR', '/software-mr', 'Software Team', 'software-team', true, ARRAY['admin', 'manager', 'member', 'guest'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 92),

-- Tools > Dokumen
('tools-documents', 'Document PDF Compress', '/tools/documents', 'Tools > Dokumen', 'tools', true, ARRAY['admin', 'manager', 'member', 'guest'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 121),
('tools-pdf-merge-split', 'PDF Merge & Split', '/tools/pdf-merge-split', 'Tools > Dokumen', 'tools', true, ARRAY['admin', 'manager', 'member', 'guest'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 122),

-- Tools > Media
('tools-images', 'Image Converter & Compress', '/tools/images', 'Tools > Media', 'tools', true, ARRAY['admin', 'manager', 'member', 'guest'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 123),
('tools-remove-bg', 'Local Remove Background', '/tools/remove-bg', 'Tools > Media', 'tools', true, ARRAY['admin', 'manager', 'member', 'guest'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 124),
('tools-video-compress', 'Video Compressor (VAAPI)', '/tools/video-compress', 'Tools > Media', 'tools', true, ARRAY['admin', 'manager', 'member', 'guest'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 125),

-- Tools > Software Dev
('tools-cl-compare', 'CL Compare', '/tools/cl-compare', 'Tools > Software Dev', 'tools', true, ARRAY['admin', 'manager', 'member', 'guest'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 126),
('tools-build-command', 'Build Command', '/tools/build-command', 'Tools > Software Dev', 'tools', true, ARRAY['admin', 'manager', 'member', 'guest'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 127)

ON CONFLICT (menu_key) DO UPDATE
SET label = EXCLUDED.label, 
    path = EXCLUDED.path, 
    category = EXCLUDED.category, 
    parent_key = EXCLUDED.parent_key, 
    sort_order = EXCLUDED.sort_order;
