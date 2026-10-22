-- ============================================================================
-- SEIN PE-Portal: Production Clean Wipe Script
-- Mode: Ponytail (Safe, Deterministic, Clean Production State)
-- Description:
--   Wipes all development/mock data across all modules so the portal is
--   ready for production use, WHILE strictly preserving:
--     1. Management & Admin Accounts (role = 'admin')
--     2. System Schema Migrations (schema_migrations)
--     3. Organization Taxonomy & Master Data (group_parts)
--     4. System Configurations (auth_config, llm_config, mcp_servers, menu_permissions, smtp_configs)
-- ============================================================================

BEGIN;

-- 1. Wipe Collaboration & Comments
TRUNCATE TABLE chat_messages CASCADE;
TRUNCATE TABLE chat_sessions CASCADE;
TRUNCATE TABLE comments CASCADE;

-- 2. Wipe Documents, Shares & Vector Embeddings
TRUNCATE TABLE document_embeddings CASCADE;
TRUNCATE TABLE document_shares CASCADE;
TRUNCATE TABLE documents CASCADE;

-- 3. Wipe Milestone Task Projects & Tasks
TRUNCATE TABLE project_members CASCADE;
TRUNCATE TABLE project_tasks CASCADE;
TRUNCATE TABLE projects CASCADE;

-- 4. Wipe New Model Developments
TRUNCATE TABLE new_model_stages CASCADE;
TRUNCATE TABLE new_models CASCADE;

-- 5. Wipe Sample Management Inventory & Flow Records
TRUNCATE TABLE sample_flows CASCADE;
TRUNCATE TABLE samples RESTART IDENTITY CASCADE;

-- 6. Wipe Software MR Releases & DHL Shipments
TRUNCATE TABLE software_mr_releases RESTART IDENTITY CASCADE;
TRUNCATE TABLE dhl_shipments RESTART IDENTITY CASCADE;

-- 7. Wipe GMES Line Issues, Measurements & Training Modules
TRUNCATE TABLE gmes_measurements RESTART IDENTITY CASCADE;
TRUNCATE TABLE gmes_issues RESTART IDENTITY CASCADE;
TRUNCATE TABLE training_modules RESTART IDENTITY CASCADE;

-- 8. Wipe Engineering Articles & Innovations
TRUNCATE TABLE imei_articles RESTART IDENTITY CASCADE;
TRUNCATE TABLE innovation_targets CASCADE;
TRUNCATE TABLE innovations CASCADE;

-- 9. Wipe Digital Reports, Schedules & Audit Logs
TRUNCATE TABLE report_send_logs CASCADE;
TRUNCATE TABLE report_schedules RESTART IDENTITY CASCADE;
TRUNCATE TABLE digital_reports RESTART IDENTITY CASCADE;
TRUNCATE TABLE audit_logs CASCADE;

-- 10. Wipe Custom User Email Distribution Lists
TRUNCATE TABLE user_email_lists RESTART IDENTITY CASCADE;

-- 11. Wipe Non-Management Dummy/Test Accounts
-- Only users with role 'admin' are preserved!
DELETE FROM users WHERE role NOT IN ('admin');

-- 12. Ensure default primary Administrator account exists and is active
INSERT INTO users (employee_id, username, email, password_hash, full_name, role, auth_provider, is_active)
VALUES (
    'ADMIN001',
    'admin',
    'admin@sein.local',
    '$2b$12$Rx1qMTNxaOYMrbGP5WtohuGfvngsTBjc.X3bYR0szc/jgY119fI.W',
    'System Administrator',
    'admin',
    'local',
    true
)
ON CONFLICT (username) DO UPDATE SET
    role = 'admin',
    is_active = true;

COMMIT;

-- Verification: Display status of database tables
SELECT 'Production Wipe Complete!' AS status;

SELECT 
    'users (management only)' AS entity, COUNT(*) AS count FROM users
UNION ALL
SELECT 'group_parts (master)', COUNT(*) FROM group_parts
UNION ALL
SELECT 'menu_permissions (config)', COUNT(*) FROM menu_permissions
UNION ALL
SELECT 'auth_config (config)', COUNT(*) FROM auth_config
UNION ALL
SELECT 'llm_config (config)', COUNT(*) FROM llm_config
UNION ALL
SELECT 'mcp_servers (config)', COUNT(*) FROM mcp_servers
UNION ALL
SELECT 'smtp_configs (config)', COUNT(*) FROM smtp_configs
UNION ALL
SELECT 'samples (wiped)', COUNT(*) FROM samples
UNION ALL
SELECT 'software_mr_releases (wiped)', COUNT(*) FROM software_mr_releases
UNION ALL
SELECT 'projects (wiped)', COUNT(*) FROM projects
UNION ALL
SELECT 'comments (wiped)', COUNT(*) FROM comments
UNION ALL
SELECT 'documents (wiped)', COUNT(*) FROM documents
UNION ALL
SELECT 'innovations (wiped)', COUNT(*) FROM innovations
UNION ALL
SELECT 'gmes_issues (wiped)', COUNT(*) FROM gmes_issues
UNION ALL
SELECT 'training_modules (wiped)', COUNT(*) FROM training_modules
UNION ALL
SELECT 'audit_logs (wiped)', COUNT(*) FROM audit_logs;
