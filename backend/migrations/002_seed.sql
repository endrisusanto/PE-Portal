-- ============================================================================
-- PE-Portal Seed Data
-- Migration: 002_seed.sql
-- ============================================================================

-- 1. Seed Group Parts for SEIN PE Group
-- PE Production
INSERT INTO group_parts (name, parent_group, description, sort_order) VALUES
('BOM Bill of Material', 'pe_production', 'Bill of Materials management and verification', 1),
('Setup Working Instruction', 'pe_production', 'Standard Operating Procedures & Working Instructions setup', 2),
('Support Production', 'pe_production', 'Line technical support for production engineering', 3)
ON CONFLICT DO NOTHING;

-- PE Mecha
INSERT INTO group_parts (name, parent_group, description, sort_order) VALUES
('JIG Development', 'pe_mecha', 'JIG design, tooling, and development', 1),
('Unit BOX Development', 'pe_mecha', 'Unit BOX fixtures and assembly mechanics', 2),
('MRO', 'pe_mecha', 'Maintenance, Repair, and Operations for PE equipment', 3),
('Mechanical Analyst', 'pe_mecha', 'Mechanical stress, tolerance, and failure analysis', 4),
('Support Production', 'pe_mecha', 'Mechanical engineering line support', 5)
ON CONFLICT DO NOTHING;

-- PE Solution Production
INSERT INTO group_parts (name, parent_group, description, sort_order) VALUES
('IMEI Management', 'pe_solution', 'IMEI programming and process control records', 1),
('Program PGM Management', 'pe_solution', 'Firmware flashing, PGM scripts, and tools', 2),
('Technical Analyst', 'pe_solution', 'Software and system failure root-cause analysis', 3),
('Software Development', 'pe_solution', 'Internal utility and automation tooling development', 4),
('GBA Task Manager', 'pe_solution', 'Google Build Approval automation & task tracking', 5),
('Release Management', 'pe_solution', 'Software binary releases and deployment control', 6),
('Sample Management', 'pe_solution', 'Engineering and prototype sample device management', 7)
ON CONFLICT DO NOTHING;

-- 2. Seed Default Auth Config (Local for development)
INSERT INTO auth_config (provider, is_active)
VALUES ('local', true)
ON CONFLICT DO NOTHING;

-- 3. Seed Initial MCP Server (Google Build Approval)
INSERT INTO mcp_servers (name, url, description, auth_type, is_active, health_status)
VALUES (
    'Google Build Approval',
    'http://107.102.39.55:3800/mcp',
    'Google Build Approval Management MCP Server',
    'none',
    true,
    'unknown'
)
ON CONFLICT DO NOTHING;

-- 4. Seed Default Admin User
-- Username: admin
-- Password: admin123 (bcrypt hash: $2b$12$Rx1qMTNxaOYMrbGP5WtohuGfvngsTBjc.X3bYR0szc/jgY119fI.W)
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
ON CONFLICT (username) DO NOTHING;
