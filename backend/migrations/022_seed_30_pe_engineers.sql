-- 022_seed_30_pe_engineers.sql
-- Migration: Wipe mock dummy users and seed 30 actual SEIN PE Engineering Members

-- 1. Wipe mock/dummy test user '1' if exists
DELETE FROM user_group_parts WHERE user_id IN (SELECT id FROM users WHERE username = '1' OR employee_id = '1');
DELETE FROM users WHERE username = '1' OR employee_id = '1';

-- 2. Insert 30 PE Engineers into users table
-- Password default: admin123 (hash: $2b$12$Rx1qMTNxaOYMrbGP5WtohuGfvngsTBjc.X3bYR0szc/jgY119fI.W)
INSERT INTO users (employee_id, username, email, password_hash, full_name, role, auth_provider, is_active, group_part_id) VALUES
-- --- PE Production (10 Engineers) ---
('PE001', 'budi.santoso', 'budi.santoso@sein.local', '$2b$12$Rx1qMTNxaOYMrbGP5WtohuGfvngsTBjc.X3bYR0szc/jgY119fI.W', 'Budi Santoso', 'member', 'local', true, (SELECT id FROM group_parts WHERE parent_group = 'pe_production' AND name = 'Support Production' LIMIT 1)),
('PE002', 'citra.dewi', 'citra.dewi@sein.local', '$2b$12$Rx1qMTNxaOYMrbGP5WtohuGfvngsTBjc.X3bYR0szc/jgY119fI.W', 'Citra Dewi', 'member', 'local', true, (SELECT id FROM group_parts WHERE parent_group = 'pe_production' AND name = 'Setup Working Instruction' LIMIT 1)),
('PE003', 'dimas.anggara', 'dimas.anggara@sein.local', '$2b$12$Rx1qMTNxaOYMrbGP5WtohuGfvngsTBjc.X3bYR0szc/jgY119fI.W', 'Dimas Anggara', 'member', 'local', true, (SELECT id FROM group_parts WHERE parent_group = 'pe_production' AND name = 'Support Production' LIMIT 1)),
('PE004', 'eko.prasetyo', 'eko.prasetyo@sein.local', '$2b$12$Rx1qMTNxaOYMrbGP5WtohuGfvngsTBjc.X3bYR0szc/jgY119fI.W', 'Eko Prasetyo', 'member', 'local', true, (SELECT id FROM group_parts WHERE parent_group = 'pe_production' AND name = 'BOM Bill of Material' LIMIT 1)),
('PE005', 'fani.rahmawati', 'fani.rahmawati@sein.local', '$2b$12$Rx1qMTNxaOYMrbGP5WtohuGfvngsTBjc.X3bYR0szc/jgY119fI.W', 'Fani Rahmawati', 'member', 'local', true, (SELECT id FROM group_parts WHERE parent_group = 'pe_production' AND name = 'Setup Working Instruction' LIMIT 1)),
('PE006', 'gilang.ramadhan', 'gilang.ramadhan@sein.local', '$2b$12$Rx1qMTNxaOYMrbGP5WtohuGfvngsTBjc.X3bYR0szc/jgY119fI.W', 'Gilang Ramadhan', 'member', 'local', true, (SELECT id FROM group_parts WHERE parent_group = 'pe_production' AND name = 'Support Production' LIMIT 1)),
('PE007', 'hadi.nugroho', 'hadi.nugroho@sein.local', '$2b$12$Rx1qMTNxaOYMrbGP5WtohuGfvngsTBjc.X3bYR0szc/jgY119fI.W', 'Hadi Nugroho', 'member', 'local', true, (SELECT id FROM group_parts WHERE parent_group = 'pe_production' AND name = 'Support Production' LIMIT 1)),
('PE008', 'indah.kusuma', 'indah.kusuma@sein.local', '$2b$12$Rx1qMTNxaOYMrbGP5WtohuGfvngsTBjc.X3bYR0szc/jgY119fI.W', 'Indah Kusuma', 'member', 'local', true, (SELECT id FROM group_parts WHERE parent_group = 'pe_production' AND name = 'Setup Working Instruction' LIMIT 1)),
('PE009', 'joko.widodo', 'joko.widodo@sein.local', '$2b$12$Rx1qMTNxaOYMrbGP5WtohuGfvngsTBjc.X3bYR0szc/jgY119fI.W', 'Joko Widodo', 'member', 'local', true, (SELECT id FROM group_parts WHERE parent_group = 'pe_production' AND name = 'Setup Working Instruction' LIMIT 1)),
('PE010', 'arka.pratama', 'arka.pratama@sein.local', '$2b$12$Rx1qMTNxaOYMrbGP5WtohuGfvngsTBjc.X3bYR0szc/jgY119fI.W', 'Arka Pratama', 'manager', 'local', true, (SELECT id FROM group_parts WHERE parent_group = 'pe_production' AND name = 'Support Production' LIMIT 1)),

-- --- PE Mecha (10 Engineers) ---
('PE011', 'laras.wati', 'laras.wati@sein.local', '$2b$12$Rx1qMTNxaOYMrbGP5WtohuGfvngsTBjc.X3bYR0szc/jgY119fI.W', 'Laras Wati', 'member', 'local', true, (SELECT id FROM group_parts WHERE parent_group = 'pe_mecha' AND name = 'MRO' LIMIT 1)),
('PE012', 'muhammad.fajar', 'muhammad.fajar@sein.local', '$2b$12$Rx1qMTNxaOYMrbGP5WtohuGfvngsTBjc.X3bYR0szc/jgY119fI.W', 'Muhammad Fajar', 'member', 'local', true, (SELECT id FROM group_parts WHERE parent_group = 'pe_mecha' AND name = 'JIG Development' LIMIT 1)),
('PE013', 'nadia.safitri', 'nadia.safitri@sein.local', '$2b$12$Rx1qMTNxaOYMrbGP5WtohuGfvngsTBjc.X3bYR0szc/jgY119fI.W', 'Nadia Safitri', 'member', 'local', true, (SELECT id FROM group_parts WHERE parent_group = 'pe_mecha' AND name = 'JIG Development' LIMIT 1)),
('PE014', 'oki.setiawan', 'oki.setiawan@sein.local', '$2b$12$Rx1qMTNxaOYMrbGP5WtohuGfvngsTBjc.X3bYR0szc/jgY119fI.W', 'Oki Setiawan', 'member', 'local', true, (SELECT id FROM group_parts WHERE parent_group = 'pe_mecha' AND name = 'Support Production' LIMIT 1)),
('PE015', 'putri.handayani', 'putri.handayani@sein.local', '$2b$12$Rx1qMTNxaOYMrbGP5WtohuGfvngsTBjc.X3bYR0szc/jgY119fI.W', 'Putri Handayani', 'member', 'local', true, (SELECT id FROM group_parts WHERE parent_group = 'pe_mecha' AND name = 'Mechanical Analyst' LIMIT 1)),
('PE016', 'qori.alamsyah', 'qori.alamsyah@sein.local', '$2b$12$Rx1qMTNxaOYMrbGP5WtohuGfvngsTBjc.X3bYR0szc/jgY119fI.W', 'Qori Alamsyah', 'member', 'local', true, (SELECT id FROM group_parts WHERE parent_group = 'pe_mecha' AND name = 'JIG Development' LIMIT 1)),
('PE017', 'rian.hidayat', 'rian.hidayat@sein.local', '$2b$12$Rx1qMTNxaOYMrbGP5WtohuGfvngsTBjc.X3bYR0szc/jgY119fI.W', 'Rian Hidayat', 'member', 'local', true, (SELECT id FROM group_parts WHERE parent_group = 'pe_mecha' AND name = 'JIG Development' LIMIT 1)),
('PE018', 'salsa.bila', 'salsa.bila@sein.local', '$2b$12$Rx1qMTNxaOYMrbGP5WtohuGfvngsTBjc.X3bYR0szc/jgY119fI.W', 'Salsa Bila', 'member', 'local', true, (SELECT id FROM group_parts WHERE parent_group = 'pe_mecha' AND name = 'Mechanical Analyst' LIMIT 1)),
('PE019', 'taufik.ismail', 'taufik.ismail@sein.local', '$2b$12$Rx1qMTNxaOYMrbGP5WtohuGfvngsTBjc.X3bYR0szc/jgY119fI.W', 'Taufik Ismail', 'member', 'local', true, (SELECT id FROM group_parts WHERE parent_group = 'pe_mecha' AND name = 'MRO' LIMIT 1)),
('PE020', 'kurniawan.adi', 'kurniawan.adi@sein.local', '$2b$12$Rx1qMTNxaOYMrbGP5WtohuGfvngsTBjc.X3bYR0szc/jgY119fI.W', 'Kurniawan Adi', 'manager', 'local', true, (SELECT id FROM group_parts WHERE parent_group = 'pe_mecha' AND name = 'JIG Development' LIMIT 1)),

-- --- PE Solution (10 Engineers) ---
('PE021', 'vina.pandu', 'vina.pandu@sein.local', '$2b$12$Rx1qMTNxaOYMrbGP5WtohuGfvngsTBjc.X3bYR0szc/jgY119fI.W', 'Vina Pandu', 'member', 'local', true, (SELECT id FROM group_parts WHERE parent_group = 'pe_solution' AND name = 'Software Development' LIMIT 1)),
('PE022', 'wahyu.hidayat', 'wahyu.hidayat@sein.local', '$2b$12$Rx1qMTNxaOYMrbGP5WtohuGfvngsTBjc.X3bYR0szc/jgY119fI.W', 'Wahyu Hidayat', 'member', 'local', true, (SELECT id FROM group_parts WHERE parent_group = 'pe_solution' AND name = 'Program PGM Management' LIMIT 1)),
('PE023', 'xavier.kevin', 'xavier.kevin@sein.local', '$2b$12$Rx1qMTNxaOYMrbGP5WtohuGfvngsTBjc.X3bYR0szc/jgY119fI.W', 'Xavier Kevin', 'member', 'local', true, (SELECT id FROM group_parts WHERE parent_group = 'pe_solution' AND name = 'Technical Analyst' LIMIT 1)),
('PE024', 'yolanda.vega', 'yolanda.vega@sein.local', '$2b$12$Rx1qMTNxaOYMrbGP5WtohuGfvngsTBjc.X3bYR0szc/jgY119fI.W', 'Yolanda Vega', 'member', 'local', true, (SELECT id FROM group_parts WHERE parent_group = 'pe_solution' AND name = 'Software Development' LIMIT 1)),
('PE025', 'zack.lee', 'zack.lee@sein.local', '$2b$12$Rx1qMTNxaOYMrbGP5WtohuGfvngsTBjc.X3bYR0szc/jgY119fI.W', 'Zack Lee', 'member', 'local', true, (SELECT id FROM group_parts WHERE parent_group = 'pe_solution' AND name = 'Software Development' LIMIT 1)),
('PE026', 'adit.wicaksono', 'adit.wicaksono@sein.local', '$2b$12$Rx1qMTNxaOYMrbGP5WtohuGfvngsTBjc.X3bYR0szc/jgY119fI.W', 'Adit Wicaksono', 'member', 'local', true, (SELECT id FROM group_parts WHERE parent_group = 'pe_solution' AND name = 'Software Development' LIMIT 1)),
('PE027', 'bella.anggraini', 'bella.anggraini@sein.local', '$2b$12$Rx1qMTNxaOYMrbGP5WtohuGfvngsTBjc.X3bYR0szc/jgY119fI.W', 'Bella Anggraini', 'member', 'local', true, (SELECT id FROM group_parts WHERE parent_group = 'pe_solution' AND name = 'Software Development' LIMIT 1)),
('PE028', 'chandra.wijaya', 'chandra.wijaya@sein.local', '$2b$12$Rx1qMTNxaOYMrbGP5WtohuGfvngsTBjc.X3bYR0szc/jgY119fI.W', 'Chandra Wijaya', 'member', 'local', true, (SELECT id FROM group_parts WHERE parent_group = 'pe_solution' AND name = 'Release Management' LIMIT 1)),
('PE029', 'doni.pratama', 'doni.pratama@sein.local', '$2b$12$Rx1qMTNxaOYMrbGP5WtohuGfvngsTBjc.X3bYR0szc/jgY119fI.W', 'Doni Pratama', 'member', 'local', true, (SELECT id FROM group_parts WHERE parent_group = 'pe_solution' AND name = 'GBA Task Manager' LIMIT 1)),
('PE030', 'umar.bakri', 'umar.bakri@sein.local', '$2b$12$Rx1qMTNxaOYMrbGP5WtohuGfvngsTBjc.X3bYR0szc/jgY119fI.W', 'Umar Bakri', 'manager', 'local', true, (SELECT id FROM group_parts WHERE parent_group = 'pe_solution' AND name = 'Software Development' LIMIT 1))
ON CONFLICT (username) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  group_part_id = EXCLUDED.group_part_id;

-- 3. Sync user_group_parts table
INSERT INTO user_group_parts (user_id, group_part_id)
SELECT u.id, u.group_part_id
FROM users u
WHERE u.group_part_id IS NOT NULL AND u.employee_id LIKE 'PE%'
ON CONFLICT DO NOTHING;
