-- Migration 040: New Model PICs assignment
CREATE TABLE IF NOT EXISTS new_model_pics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL REFERENCES new_models(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'pic', -- 'lead' or 'pic'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_new_model_pic UNIQUE(model_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_new_model_pics_model ON new_model_pics(model_id);
CREATE INDEX IF NOT EXISTS idx_new_model_pics_user ON new_model_pics(user_id);

-- Backfill: Masukkan owner_id eksisting sebagai lead PIC jika belum ada
INSERT INTO new_model_pics (model_id, user_id, role)
SELECT id, owner_id, 'lead'
FROM new_models
WHERE owner_id IS NOT NULL
ON CONFLICT (model_id, user_id) DO NOTHING;

