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
--   NOTE: Uses dynamic existence checks (to_regclass) so that tables not
--         yet created/migrated in older schemas do NOT abort the transaction.
-- ============================================================================

DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'chat_messages',
        'chat_sessions',
        'comments',
        'document_embeddings',
        'document_shares',
        'documents',
        'project_members',
        'project_tasks',
        'projects',
        'new_model_stages',
        'new_models',
        'sample_flows',
        'samples',
        'software_mr_releases',
        'dhl_shipments',
        'gmes_measurements',
        'gmes_issues',
        'training_modules',
        'imei_articles',
        'innovation_targets',
        'innovations',
        'report_send_logs',
        'report_schedules',
        'digital_reports',
        'audit_logs',
        'user_email_lists'
    ];
BEGIN
    -- 1. Wipe Dynamic Tables (Only if they exist)
    FOREACH tbl IN ARRAY tables
    LOOP
        IF to_regclass('public.' || tbl) IS NOT NULL THEN
            EXECUTE 'TRUNCATE TABLE ' || quote_ident(tbl) || ' RESTART IDENTITY CASCADE';
            RAISE NOTICE '✓ Truncated: %', tbl;
        ELSE
            RAISE NOTICE '- Skipped (belum ada): %', tbl;
        END IF;
    END LOOP;

    -- 2. Wipe Non-Management Dummy/Test Accounts (Preserve admin only)
    IF to_regclass('public.users') IS NOT NULL THEN
        DELETE FROM users WHERE role NOT IN ('admin');

        -- 3. Ensure default primary Administrator account exists and is active
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
        RAISE NOTICE '✓ Preserved & ensured primary admin account (username: admin)';
    END IF;
END $$;

-- Verification: Display status of database tables safely without crashing
DO $$
DECLARE
    tbl text;
    cnt bigint;
    check_tables text[] := ARRAY[
        'users',
        'group_parts',
        'menu_permissions',
        'auth_config',
        'llm_config',
        'mcp_servers',
        'smtp_configs',
        'samples',
        'software_mr_releases',
        'projects',
        'comments',
        'documents',
        'innovations',
        'gmes_issues',
        'training_modules',
        'audit_logs'
    ];
BEGIN
    RAISE NOTICE ' ';
    RAISE NOTICE '==================================================';
    RAISE NOTICE '  VERIFIKASI STATUS TABEL SETELAH WIPE:';
    RAISE NOTICE '==================================================';
    FOREACH tbl IN ARRAY check_tables
    LOOP
        IF to_regclass('public.' || tbl) IS NOT NULL THEN
            EXECUTE 'SELECT COUNT(*) FROM ' || quote_ident(tbl) INTO cnt;
            RAISE NOTICE '  % : % rows', rpad(tbl, 28, ' '), cnt;
        ELSE
            RAISE NOTICE '  % : (tabel belum dibuat)', rpad(tbl, 28, ' ');
        END IF;
    END LOOP;
    RAISE NOTICE '==================================================';
END $$;

SELECT 'Production Wipe Complete!' AS status;
