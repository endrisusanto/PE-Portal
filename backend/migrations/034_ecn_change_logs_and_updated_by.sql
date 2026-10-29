-- ponytail: Track latest updater and full audit change logs for ECN records
ALTER TABLE ecn_records ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ecn_updated_by ON ecn_records(updated_by);

CREATE TABLE IF NOT EXISTS ecn_change_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ecn_id UUID NOT NULL REFERENCES ecn_records(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL DEFAULT 'UPDATE',
    changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    changes JSONB DEFAULT '{}'::jsonb,
    note TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ecn_change_logs_ecn_id ON ecn_change_logs(ecn_id, created_at DESC);

