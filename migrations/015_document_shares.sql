-- Migration 015: Document Sharing with Custom Rules (open public, login required, locked with password)
CREATE TABLE IF NOT EXISTS document_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID UNIQUE NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    share_token VARCHAR(64) UNIQUE NOT NULL,
    access_rule VARCHAR(30) NOT NULL DEFAULT 'public', -- 'public', 'login_required', 'password'
    password_hash VARCHAR(255) DEFAULT '',
    plain_password VARCHAR(100) DEFAULT '',
    allow_download BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMPTZ,
    view_count INT NOT NULL DEFAULT 0,
    download_count INT NOT NULL DEFAULT 0,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_shares_token ON document_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_doc_shares_doc_id ON document_shares(document_id);
