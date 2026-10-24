-- 019_new_model_stage_attachments.sql
-- Add attachments JSONB column to new_model_stages for stage verification documents & photos

ALTER TABLE new_model_stages
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;
