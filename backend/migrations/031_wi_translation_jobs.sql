-- Migration 031: Create table for Working Instruction PDF Translation background jobs
CREATE TABLE IF NOT EXISTS wi_translation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    target_lang VARCHAR(10) NOT NULL DEFAULT 'id',
    mode VARCHAR(20) NOT NULL DEFAULT 'replace',
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    current_page INT NOT NULL DEFAULT 0,
    total_pages INT NOT NULL DEFAULT 0,
    progress_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
    message TEXT DEFAULT '',
    translated_count INT NOT NULL DEFAULT 0,
    duration_sec NUMERIC(8,2) NOT NULL DEFAULT 0,
    translated_file TEXT DEFAULT '',
    download_url TEXT DEFAULT '',
    error_message TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wi_jobs_status ON wi_translation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_wi_jobs_created_at ON wi_translation_jobs(created_at DESC);
