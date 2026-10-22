-- Migration 013: Add attachments column to comments and projects
-- Enables multi-file attachments for Milestone Task Analyst body and discussion comments

ALTER TABLE comments ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;
