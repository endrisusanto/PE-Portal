-- Migration: 027_milestone_attachments.sql
-- Description: Add attachments column to new_model_milestones for file uploads

ALTER TABLE new_model_milestones
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;
