-- Migration 038: Add started_at and completed_at to wi_translation_jobs for accurate process elapsed time tracking
ALTER TABLE wi_translation_jobs ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE wi_translation_jobs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

