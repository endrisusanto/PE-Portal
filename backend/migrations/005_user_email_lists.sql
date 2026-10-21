-- Migration: 005_user_email_lists.sql
-- Description: Custom email recipient lists for members to quick-populate report SMTP recipients

CREATE TABLE IF NOT EXISTS user_email_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    emails TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_email_lists_user ON user_email_lists(user_id);

-- Seed default contact lists for admin/users
INSERT INTO user_email_lists (user_id, name, emails, description)
SELECT id, 'PE Management & Part Leaders', 'manager.pe@samsung.com, partleader.prod@samsung.com, partleader.mecha@samsung.com', 'Leadership group for daily operations report'
FROM users
WHERE username = 'admin'
  AND NOT EXISTS (SELECT 1 FROM user_email_lists WHERE name = 'PE Management & Part Leaders');

INSERT INTO user_email_lists (user_id, name, emails, description)
SELECT id, 'PE Production Shift 1', 'pe.shift1@samsung.com, spv.line1@samsung.com, qc.leader@samsung.com', 'Operations & JIG support shift 1 group'
FROM users
WHERE username = 'admin'
  AND NOT EXISTS (SELECT 1 FROM user_email_lists WHERE name = 'PE Production Shift 1');
