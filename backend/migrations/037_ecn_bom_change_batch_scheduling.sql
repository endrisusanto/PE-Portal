-- Migration 037: Batch scheduling and notified_at tracking for BOM schedule change notification
-- ponytail: Minimal, atomic, high performance index and columns

ALTER TABLE ecn_reminder_settings
ADD COLUMN IF NOT EXISTS bom_change_send_time TEXT DEFAULT '08:00, 13:00, 16:00';

ALTER TABLE ecn_change_logs
ADD COLUMN IF NOT EXISTS notified_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Mark past historical changes as notified so they are not spammed in new batches
UPDATE ecn_change_logs
SET notified_at = NOW()
WHERE notified_at IS NULL;

-- Partial index for instantaneous batch scanning (O(1))
CREATE INDEX IF NOT EXISTS idx_ecn_change_logs_bom_unnotified
ON ecn_change_logs (created_at ASC)
WHERE (changes ? 'running_date_bom' AND notified_at IS NULL);

