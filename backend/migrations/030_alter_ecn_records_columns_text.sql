-- ============================================================================
-- Migration 030: Alter ECN records columns to TEXT
-- Prevents SQLSTATE 22001 (value too long for character varying) on large imports
-- and allows safe defaults for empty columns.
-- ============================================================================

ALTER TABLE ecn_records 
    ALTER COLUMN ecn_no DROP NOT NULL,
    ALTER COLUMN ecn_no TYPE TEXT,
    ALTER COLUMN ecn_no SET DEFAULT '-',
    ALTER COLUMN model TYPE TEXT,
    ALTER COLUMN function_type TYPE TEXT,
    ALTER COLUMN process TYPE TEXT,
    ALTER COLUMN parent_code TYPE TEXT,
    ALTER COLUMN parent_name TYPE TEXT,
    ALTER COLUMN dl TYPE TEXT,
    ALTER COLUMN child_code TYPE TEXT,
    ALTER COLUMN child_name TYPE TEXT,
    ALTER COLUMN quantity TYPE TEXT,
    ALTER COLUMN marking_point TYPE TEXT,
    ALTER COLUMN running_date_bom TYPE TEXT,
    ALTER COLUMN distribution_date TYPE TEXT,
    ALTER COLUMN status TYPE TEXT;
