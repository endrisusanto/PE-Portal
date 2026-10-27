-- Migration 026: Add variant_code support to new_model_milestones table

ALTER TABLE new_model_milestones ADD COLUMN IF NOT EXISTS variant_code VARCHAR(80) DEFAULT '';

-- Drop old unique constraint if exists and recreate with variant_code
ALTER TABLE new_model_milestones DROP CONSTRAINT IF EXISTS uq_model_milestone;
ALTER TABLE new_model_milestones DROP CONSTRAINT IF EXISTS uq_model_milestone_variant;

ALTER TABLE new_model_milestones ADD CONSTRAINT uq_model_milestone_variant UNIQUE (model_id, milestone_key, variant_code);

CREATE INDEX IF NOT EXISTS idx_new_model_milestones_variant ON new_model_milestones(model_id, variant_code);
