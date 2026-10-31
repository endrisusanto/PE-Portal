-- Migration 039: ECN PLM Workflow and Stepper tracking
-- Adds PLM status lifecycle, model owner integration, and audit tracking

ALTER TABLE ecn_records
ADD COLUMN IF NOT EXISTS plm_status VARCHAR(50) DEFAULT 'NONE',
ADD COLUMN IF NOT EXISTS plm_new_model_id UUID REFERENCES new_models(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS plm_pic_model_id UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS plm_change_reason TEXT,
ADD COLUMN IF NOT EXISTS plm_vendor_eta DATE,
ADD COLUMN IF NOT EXISTS plm_model_approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS plm_model_note TEXT,
ADD COLUMN IF NOT EXISTS plm_eco_no VARCHAR(100),
ADD COLUMN IF NOT EXISTS plm_updated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS plm_updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS plm_feedback_note TEXT;

-- Performance indices for fast O(1) tab filtering
CREATE INDEX IF NOT EXISTS idx_ecn_plm_status ON ecn_records(plm_status);
CREATE INDEX IF NOT EXISTS idx_ecn_plm_new_model_id ON ecn_records(plm_new_model_id);
CREATE INDEX IF NOT EXISTS idx_ecn_active_workflow
ON ecn_records (status, plm_status, created_at DESC)
WHERE LOWER(status) NOT IN ('completed', 'eco cancel');

