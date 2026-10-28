-- ============================================================================
-- Migration 029: ECN Monitoring Module
-- Creates table ecn_records and registers ecn-monitoring menu permission
-- ============================================================================

CREATE TABLE IF NOT EXISTS ecn_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ecn_no VARCHAR(100) NOT NULL,
    model VARCHAR(255),
    function_type VARCHAR(100),
    purpose TEXT,
    inventory_mgmt TEXT,
    process VARCHAR(100),
    ec_title TEXT,
    parent_code VARCHAR(100),
    parent_name VARCHAR(255),
    before_after TEXT,
    dl VARCHAR(100),
    child_code VARCHAR(100),
    child_name VARCHAR(255),
    specification TEXT,
    quantity VARCHAR(50),
    marking_point VARCHAR(100),
    running_date_bom VARCHAR(100),
    distribution_date VARCHAR(100),
    status VARCHAR(100) DEFAULT 'Pending',
    remark TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance indices
CREATE INDEX IF NOT EXISTS idx_ecn_no ON ecn_records(ecn_no);
CREATE INDEX IF NOT EXISTS idx_ecn_model ON ecn_records(model);
CREATE INDEX IF NOT EXISTS idx_ecn_status ON ecn_records(status);
CREATE INDEX IF NOT EXISTS idx_ecn_process ON ecn_records(process);
CREATE INDEX IF NOT EXISTS idx_ecn_function_type ON ecn_records(function_type);
CREATE INDEX IF NOT EXISTS idx_ecn_created_at ON ecn_records(created_at DESC);

-- Register ECN Monitoring menu in menu_permissions
INSERT INTO menu_permissions (
    menu_key, label, path, category, parent_key, is_visible,
    allowed_roles, allowed_groups, allowed_users, blocked_users, sort_order
)
VALUES (
    'ecn-monitoring',
    'ECN Monitoring',
    '/ecn-monitoring',
    'operations',
    NULL,
    true,
    ARRAY['admin', 'manager', 'member', 'guest'],
    ARRAY[]::TEXT[],
    ARRAY[]::TEXT[],
    ARRAY[]::TEXT[],
    11
)
ON CONFLICT (menu_key) DO UPDATE
SET label = EXCLUDED.label,
    path = EXCLUDED.path,
    category = EXCLUDED.category,
    sort_order = EXCLUDED.sort_order;
