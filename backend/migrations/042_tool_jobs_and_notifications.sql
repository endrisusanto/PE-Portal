-- Migration 042: Persistent tool jobs and portal notifications
CREATE TABLE IF NOT EXISTS tool_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    tool_type VARCHAR(50) NOT NULL, -- 'video-compress', 'remove-bg', 'compress-pdf', 'merge-pdf', 'split-pdf', 'pptx-summary', 'wi-translator'
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'cancelled'
    progress_percent NUMERIC(5,2) DEFAULT 0.00,
    current_step VARCHAR(255) DEFAULT '',
    output_path TEXT DEFAULT '',
    result_url TEXT DEFAULT '',
    result_meta JSONB DEFAULT '{}'::jsonb,
    error_message TEXT DEFAULT '',
    duration_sec NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tool_jobs_user_status ON tool_jobs(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tool_jobs_status ON tool_jobs(status);
CREATE INDEX IF NOT EXISTS idx_tool_jobs_created_at ON tool_jobs(created_at DESC);

CREATE TABLE IF NOT EXISTS portal_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL,
    reference_id VARCHAR(100),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portal_notif_user ON portal_notifications(user_id, is_read, created_at DESC);

