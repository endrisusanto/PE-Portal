-- Migration 025: New Model Development Milestone Matrix & Tracking
-- Extends new_models and creates new_model_milestones table for comprehensive tracking

ALTER TABLE new_models ADD COLUMN IF NOT EXISTS marketing_name VARCHAR(100);
ALTER TABLE new_models ADD COLUMN IF NOT EXISTS basic_models JSONB DEFAULT '[]'::jsonb;
ALTER TABLE new_models ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE new_models ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;

CREATE TABLE IF NOT EXISTS new_model_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL REFERENCES new_models(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    sub_category VARCHAR(50),
    milestone_key VARCHAR(80) NOT NULL,
    label VARCHAR(120) NOT NULL,
    plan_value VARCHAR(100) DEFAULT '',
    actual_value VARCHAR(100) DEFAULT '',
    status VARCHAR(30) DEFAULT 'pending', -- pending, in_progress, completed, not_applicable, delayed
    sort_order INT DEFAULT 0,
    target_date DATE,
    actual_date DATE,
    notes TEXT,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_model_milestone UNIQUE (model_id, milestone_key)
);

CREATE INDEX IF NOT EXISTS idx_new_model_milestones_model ON new_model_milestones(model_id);
CREATE INDEX IF NOT EXISTS idx_new_model_milestones_key ON new_model_milestones(milestone_key);
CREATE INDEX IF NOT EXISTS idx_new_model_milestones_category ON new_model_milestones(category);

-- Ensure permission for models menu
INSERT INTO menu_permissions (menu_key, label, path, category, is_visible)
VALUES ('models', 'New Models & Milestones', '/models', 'operations', true)
ON CONFLICT (menu_key) DO UPDATE SET is_visible = true;
