-- ============================================================================
-- Migration 032: ECN Running BOM Deadline Email Reminder & Logs
-- ============================================================================

CREATE TABLE IF NOT EXISTS ecn_reminder_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    is_enabled BOOLEAN DEFAULT TRUE,
    days_before INT DEFAULT 1,
    send_time TEXT DEFAULT '08:00',
    recipients TEXT DEFAULT '',
    cc_recipients TEXT DEFAULT '',
    email_subject TEXT DEFAULT '[REMINDER] ECN Running BOM Deadline Alert - SEIN PE',
    include_overdue BOOLEAN DEFAULT TRUE,
    last_sent_date TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default initial setting if not exists
INSERT INTO ecn_reminder_settings (is_enabled, days_before, send_time, recipients, email_subject, include_overdue)
SELECT TRUE, 1, '08:00', 'endri.s@samsung.com', '[REMINDER] ECN Running BOM Deadline Alert - SEIN PE', TRUE
WHERE NOT EXISTS (SELECT 1 FROM ecn_reminder_settings);

-- Table for tracking sent reminder history
CREATE TABLE IF NOT EXISTS ecn_reminder_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    recipients TEXT,
    cc_recipients TEXT,
    item_count INT DEFAULT 0,
    ecn_numbers TEXT,
    status TEXT DEFAULT 'SUCCESS',
    error_message TEXT,
    triggered_by TEXT DEFAULT 'SCHEDULE'
);

CREATE INDEX IF NOT EXISTS idx_ecn_reminder_logs_sent_at ON ecn_reminder_logs(sent_at DESC);
