-- ============================================================================
-- Migration 036: Add Realtime BOM Change Notification Settings to ecn_reminder_settings
-- ============================================================================

ALTER TABLE ecn_reminder_settings
ADD COLUMN IF NOT EXISTS bom_change_notify_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS bom_change_recipients TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS bom_change_cc_recipients TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS bom_change_email_subject TEXT DEFAULT '[UPDATE] Perubahan Jadwal Running BOM - {ecn_no} ({model})';

