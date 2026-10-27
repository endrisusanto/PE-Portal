-- Migration 023: Seed Executive Leaders (Korean Dispatcher and PE Group Leader)
-- Adds PE Executive Management group part and seeds 2 executive boss profiles

INSERT INTO group_parts (id, name, parent_group, description, sort_order)
VALUES (
    'c0a80101-1234-4567-89ab-cdef01234567',
    'Executive Management',
    'pe_management',
    'PE Group Leadership and Expatriate Dispatcher Office',
    0
) ON CONFLICT (id) DO NOTHING;

-- Seed Dispatcher / Expatriat Korea (Park Jin-woo)
INSERT INTO users (
    id, employee_id, username, email, password_hash, full_name,
    avatar_path, preferred_lang, group_part_id, role, auth_provider, is_active
) VALUES (
    'd0a80101-1234-4567-89ab-cdef01234568',
    'PE_EXP01',
    'park.jinwoo',
    'park.jinwoo@sein.local',
    '$2b$12$Rx1qMTNxaOYMrbGP5WtohuGfvngsTBjc.X3bYR0szc/jgY119fI.W',
    'Park Jin-woo (박진우)',
    NULL,
    'en',
    'c0a80101-1234-4567-89ab-cdef01234567',
    'manager',
    'local',
    TRUE
) ON CONFLICT (employee_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    group_part_id = EXCLUDED.group_part_id;

-- Seed Group Leader / Group Manager PE (Hendrik Setiawan)
INSERT INTO users (
    id, employee_id, username, email, password_hash, full_name,
    avatar_path, preferred_lang, group_part_id, role, auth_provider, is_active
) VALUES (
    'd0a80101-1234-4567-89ab-cdef01234569',
    'PE_GL01',
    'hendrik.setiawan',
    'hendrik.setiawan@sein.local',
    '$2b$12$Rx1qMTNxaOYMrbGP5WtohuGfvngsTBjc.X3bYR0szc/jgY119fI.W',
    'Hendrik Setiawan',
    NULL,
    'en',
    'c0a80101-1234-4567-89ab-cdef01234567',
    'manager',
    'local',
    TRUE
) ON CONFLICT (employee_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    group_part_id = EXCLUDED.group_part_id;

-- Seed user_group_parts
INSERT INTO user_group_parts (user_id, group_part_id)
VALUES
    ('d0a80101-1234-4567-89ab-cdef01234568', 'c0a80101-1234-4567-89ab-cdef01234567'),
    ('d0a80101-1234-4567-89ab-cdef01234569', 'c0a80101-1234-4567-89ab-cdef01234567')
ON CONFLICT DO NOTHING;
