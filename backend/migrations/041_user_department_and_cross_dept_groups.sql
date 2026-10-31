-- Migration 041: User Department and Cross-Department Groups
-- Adds department column to users table and adds Purchasing cross-functional groups

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS department VARCHAR(50) DEFAULT 'PE';

CREATE INDEX IF NOT EXISTS idx_users_department ON users(department) WHERE deleted_at IS NULL;

-- Ensure all existing users are set to PE by default
UPDATE users SET department = 'PE' WHERE department IS NULL;

-- Add Purchasing parent group and group parts for cross-department collaboration
INSERT INTO group_parts (name, parent_group, description, sort_order)
SELECT 'Purchasing BOM Reviewer', 'purchasing', 'Person In Charge of BOM date shift, vendor readiness, and procurement lead time', 1
WHERE NOT EXISTS (
    SELECT 1 FROM group_parts WHERE name = 'Purchasing BOM Reviewer' AND parent_group = 'purchasing'
);

INSERT INTO group_parts (name, parent_group, description, sort_order)
SELECT 'Part Procurement & Sourcing', 'purchasing', 'Direct part buyer and supplier coordination', 2
WHERE NOT EXISTS (
    SELECT 1 FROM group_parts WHERE name = 'Part Procurement & Sourcing' AND parent_group = 'purchasing'
);

