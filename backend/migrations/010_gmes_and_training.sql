-- Migration 010: GMES Production Line Monitoring & Online Training Portal

-- 1. GMES Production Line Issues / Worst Defect List
CREATE TABLE IF NOT EXISTS gmes_issues (
    id SERIAL PRIMARY KEY,
    process VARCHAR(100) NOT NULL,
    line_name VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    test_item VARCHAR(200) NOT NULL,
    share VARCHAR(20) DEFAULT '0%',
    fail_qty INT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'OPEN', -- OPEN, INVESTIGATING, ACTION_TAKEN, RESOLVED
    pic VARCHAR(150) DEFAULT '',
    countermeasure TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gmes_issues_process ON gmes_issues(process);
CREATE INDEX IF NOT EXISTS idx_gmes_issues_line ON gmes_issues(line_name);
CREATE INDEX IF NOT EXISTS idx_gmes_issues_status ON gmes_issues(status);

-- 2. GMES Measurement Data History
CREATE TABLE IF NOT EXISTS gmes_measurements (
    id SERIAL PRIMARY KEY,
    process VARCHAR(100) NOT NULL,
    line_name VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    test_item VARCHAR(200) NOT NULL,
    sn VARCHAR(100) NOT NULL,
    cn VARCHAR(100) DEFAULT '',
    port VARCHAR(50) DEFAULT '',
    test_time VARCHAR(100) DEFAULT '',
    equip_no VARCHAR(100) DEFAULT '',
    measure_usl VARCHAR(50) DEFAULT '',
    measure_value VARCHAR(50) DEFAULT '',
    measure_lsl VARCHAR(50) DEFAULT '',
    remark TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gmes_measurements_process ON gmes_measurements(process);
CREATE INDEX IF NOT EXISTS idx_gmes_measurements_sn ON gmes_measurements(sn);

-- 3. Online Training Modules with Password-Locked Answer Keys
CREATE TABLE IF NOT EXISTS training_modules (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'General',
    description TEXT DEFAULT '',
    link_url VARCHAR(500) DEFAULT '',
    deadline TIMESTAMPTZ,
    is_mandatory BOOLEAN DEFAULT TRUE,
    banner_image VARCHAR(500) DEFAULT '',
    has_answer_key BOOLEAN DEFAULT FALSE,
    answer_key_password VARCHAR(100) DEFAULT '2025',
    answer_key_images JSONB DEFAULT '[]'::jsonb,
    answer_key_notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_modules_category ON training_modules(category);
CREATE INDEX IF NOT EXISTS idx_training_modules_deadline ON training_modules(deadline);

-- SEED DATA for GMES
INSERT INTO gmes_issues (process, line_name, model, test_item, share, fail_qty, status, pic, countermeasure) VALUES
('VISUAL F/T(L)', 'Line 02', 'SM-S928B', 'Back Cover Gap Inspection', '28.4%', 142, 'INVESTIGATING', 'Budi Santoso', 'Cek tekanan roller press dan akurasi sensor vision'),
('VISUAL F/T(L)', 'Line 05', 'SM-A556B', 'Display Bezel Scratch', '19.2%', 96, 'ACTION_TAKEN', 'Ahmad Dani', 'Ganti jig carrier pembawa LCD dengan pelapis silicone baru'),
('VISUAL F/T(L)', 'Line 01', 'SM-A356E', 'Logo Laser Printing Contrast', '14.5%', 72, 'RESOLVED', 'Siti Rahma', 'Kalibrasi ulang daya laser marking pada station 3'),
('CAMERA MAIN F/T', 'Line 03', 'SM-S928B', 'Tele 5x OIS Actuator Tilt', '36.8%', 184, 'OPEN', 'Rian Hidayat', 'Koordinasi vendor module terkait toleransi aktuator lot 2026W42'),
('CAMERA MAIN F/T', 'Line 02', 'SM-S921B', 'Wide Camera AF Step Loss', '24.1%', 120, 'INVESTIGATING', 'Endri Susanto', 'Verifikasi driver script tuning AF v2.4 pada test fixture'),
('CAMERA MAIN F/T', 'Line 06', 'SM-A556B', 'Macro Camera Vignetting', '16.3%', 81, 'RESOLVED', 'Fajar Ramadhan', 'Pembersihan test chart illuminator di chamber inspection'),
('RF CAL LTE', 'Line 01', 'SM-A556B', 'LTE Band 7 Tx Max Power Low', '31.2%', 156, 'ACTION_TAKEN', 'Dwi Cahyo', 'Penggantian RF dummy load cable dan re-kalibrasi spectrum analyzer'),
('RF CAL LTE', 'Line 04', 'SM-S928B', 'LTE Band 3 Rx EVM Fail', '22.7%', 113, 'INVESTIGATING', 'Bambang Tri', 'Pemeriksaan shielding box attenuation leakage'),
('RF CAL LTE', 'Line 02', 'SM-A356E', 'LTE Band 40 Sensitivity Drift', '18.5%', 92, 'OPEN', 'Agus Setiawan', 'Pembersihan RF probe connector pin'),
('FINAL LTE', 'Line 03', 'SM-S928B', 'B1/B3 Carrier Aggregation Throughput', '33.9%', 169, 'INVESTIGATING', 'Endri Susanto', 'Review firmware test image modem Qualcomm baseline'),
('FINAL LTE', 'Line 01', 'SM-A556B', 'VoLTE Call Drop Simulation', '26.4%', 132, 'ACTION_TAKEN', 'Hendra Wijaya', 'Restart base station emulator CMW500 unit 2'),
('FINAL LTE', 'Line 05', 'SM-S921B', 'Current Drain in Connected Mode', '15.8%', 79, 'RESOLVED', 'Budi Santoso', 'Perbaikan grounding probe multimeter station Final 4');

-- SEED DATA for GMES Measurements
INSERT INTO gmes_measurements (process, line_name, model, test_item, sn, cn, port, test_time, equip_no, measure_usl, measure_value, measure_lsl, remark) VALUES
('VISUAL F/T(L)', 'Line 02', 'SM-S928B', 'Back Cover Gap Inspection', 'R5CXA00129F', 'CN-04', 'PORT-1', '07:15:22', 'VIS-EQ-09', '0.25mm', '0.34mm', '0.05mm', 'Gap melebihi USL pada sisi kanan atas'),
('VISUAL F/T(L)', 'Line 02', 'SM-S928B', 'Back Cover Gap Inspection', 'R5CXA00130A', 'CN-04', 'PORT-2', '07:18:41', 'VIS-EQ-09', '0.25mm', '0.31mm', '0.05mm', 'Gap melebihi USL'),
('CAMERA MAIN F/T', 'Line 03', 'SM-S928B', 'Tele 5x OIS Actuator Tilt', 'R5CXA00984E', 'CN-02', 'PORT-1', '07:20:10', 'CAM-EQ-03', '0.08deg', '0.14deg', '-0.08deg', 'Tilt angle di luar batas USL'),
('RF CAL LTE', 'Line 01', 'SM-A556B', 'LTE Band 7 Tx Max Power Low', 'R5CXA00452M', 'CN-01', 'PORT-RF1', '07:22:55', 'RF-EQ-12', '24.5dBm', '21.8dBm', '23.0dBm', 'Tx Power drop 1.2dB di bawah LSL'),
('FINAL LTE', 'Line 03', 'SM-S928B', 'B1/B3 Carrier Aggregation Throughput', 'R5CXA00771K', 'CN-03', 'PORT-ETH', '07:24:03', 'FIN-EQ-07', '150Mbps', '98Mbps', '120Mbps', 'Throughput drop under minimum specification');

-- SEED DATA for Training Modules
INSERT INTO training_modules (title, category, description, link_url, deadline, is_mandatory, banner_image, has_answer_key, answer_key_password, answer_key_images, answer_key_notes) VALUES
(
    '2026 Global EHS & Safety Compliance Training',
    'EHS & Safety',
    'Pelatihan keselamatan kerja, penanganan bahan kimia berbahaya, dan prosedur tanggap darurat pabrik SEIN.',
    'https://samsungu.csod.com/LMS/UserTranscript/MainView.aspx',
    NOW() + INTERVAL '5 days 14 hours',
    true,
    '/training-assets/EHSss.png',
    true,
    '2025',
    '["/training-assets/1759219281_jawaban.png", "/training-assets/1784256129_JAWABAN.PNG"]'::jsonb,
    'Kunci Post-Test EHS 2026: 1.C, 2.A, 3.D, 4.B, 5.C, 6.A, 7.D, 8.B, 9.A, 10.C. Perhatikan rambu APD dan rute evakuasi Assembly Line.'
),
(
    'Global Security & Data Privacy Awareness',
    'Information Security',
    'Panduan keamanan informasi rahasia perusahaan, proteksi data model baru (unreleased), dan pencegahan kebocoran informasi.',
    'https://samsungu.csod.com/LMS/UserTranscript/MainView.aspx',
    NOW() + INTERVAL '12 days 8 hours',
    true,
    '/training-assets/PRIVACY.PNG',
    true,
    '2025',
    '["/training-assets/1742775454_korup.png", "/training-assets/cpr.PNG"]'::jsonb,
    'Kunci Post-Test Security & Privacy: 1. Benar, 2. D, 3. B, 4. Dilarang foto di area produksi, 5. Laporkan ke Security Team dalam < 1 jam.'
),
(
    'Generative AI for Engineers & Workplace Productivity',
    'Technical & AI',
    'Pemanfaatan tools Generative AI internal untuk analisa data produksi, efisiensi automasi, dan kepatuhan IP.',
    'https://samsungu.csod.com/LMS/UserTranscript/MainView.aspx',
    NOW() + INTERVAL '18 days 2 hours',
    false,
    '/training-assets/gen.png',
    true,
    '2025',
    '["/training-assets/1739838614_AI1 (1).png", "/training-assets/1739838614_AI1 (2).png"]'::jsonb,
    'Jawaban AI Module: 1. Prompt engineering, 2. Tidak mengunggah source code rahasia ke publik, 3. Evaluasi human-in-the-loop.'
),
(
    'Anti-Corruption & Business Ethics 2026',
    'Compliance',
    'Kode etik perilaku bisnis Samsung Electronics, kepatuhan anti-gratifikasi, dan integritas hubungan vendor.',
    'https://samsungu.csod.com/LMS/UserTranscript/MainView.aspx',
    NOW() + INTERVAL '24 days 6 hours',
    true,
    '/training-assets/training.png',
    true,
    '2025',
    '["/training-assets/1742775454_korup.png", "/training-assets/1761202757_oke.png"]'::jsonb,
    'Etika Bisnis: 1. Laporkan penerimaan bingkisan > Rp 500rb ke HR/Audit, 2. Transparansi proses lelang, 3. Zero tolerance bribery.'
),
(
    'Basic ESD & Cleanroom Work Standards',
    'Quality & Standards',
    'Standar penanganan komponen sensitif elektrostatik (ESD) dan protokol kebersihan Cleanroom Class 100/1000.',
    'https://samsungu.csod.com/LMS/UserTranscript/MainView.aspx',
    NOW() - INTERVAL '2 days', -- Expired demo
    true,
    '/training-assets/EHSss.png',
    false,
    '',
    '[]'::jsonb,
    'Post-test dilakukan secara offline di Training Center lantai 2.'
);
