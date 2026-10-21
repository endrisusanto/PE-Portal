-- Migration 006: Innovation Class Types and Monthly Targets (BP MXPE Reference)

ALTER TABLE innovations ADD COLUMN IF NOT EXISTS class_type VARCHAR(30) DEFAULT 'Class 4';
CREATE INDEX IF NOT EXISTS idx_innovations_class_type ON innovations(class_type);

CREATE TABLE IF NOT EXISTS innovation_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year INT NOT NULL,
    month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
    target_register INT DEFAULT 0,
    target_challenge INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(year, month)
);

-- Seed Target Data for 2025 & 2026
INSERT INTO innovation_targets (year, month, target_register, target_challenge) VALUES
(2025, 1, 8, 12), (2025, 2, 8, 12), (2025, 3, 10, 15), (2025, 4, 10, 15),
(2025, 5, 8, 12), (2025, 6, 12, 16), (2025, 7, 8, 12), (2025, 8, 10, 15),
(2025, 9, 10, 15), (2025, 10, 12, 18), (2025, 11, 8, 12), (2025, 12, 6, 10),
(2026, 1, 8, 12), (2026, 2, 8, 12), (2026, 3, 10, 15), (2026, 4, 10, 15),
(2026, 5, 8, 12), (2026, 6, 12, 16), (2026, 7, 8, 12), (2026, 8, 10, 15),
(2026, 9, 10, 15), (2026, 10, 12, 18), (2026, 11, 8, 12), (2026, 12, 6, 10)
ON CONFLICT (year, month) DO UPDATE SET
    target_register = EXCLUDED.target_register,
    target_challenge = EXCLUDED.target_challenge;

-- Seed Sample SEIN PE Best Practices and Innovations across months of 2026
DO $$
DECLARE
    admin_id UUID;
    eng_id UUID;
    pe_prod_id UUID;
    pe_mecha_id UUID;
    pe_sol_id UUID;
BEGIN
    SELECT id INTO admin_id FROM users WHERE username = 'admin' LIMIT 1;
    SELECT id INTO eng_id FROM users WHERE username = 'engineer' LIMIT 1;
    IF eng_id IS NULL THEN eng_id := admin_id; END IF;

    SELECT id INTO pe_prod_id FROM group_parts WHERE name ILIKE '%BOM%' OR parent_group = 'PE Production' LIMIT 1;
    SELECT id INTO pe_mecha_id FROM group_parts WHERE name ILIKE '%JIG%' OR parent_group = 'PE Mecha' LIMIT 1;
    SELECT id INTO pe_sol_id FROM group_parts WHERE name ILIKE '%IMEI%' OR parent_group = 'PE Solution Production' LIMIT 1;

    -- Only insert seed data if innovations table is empty
    IF NOT EXISTS (SELECT 1 FROM innovations LIMIT 1) THEN
        INSERT INTO innovations (title, description, category, class_type, status, impact_score, author_id, group_part_id, created_at) VALUES
        ('Automated SMT Stencil Cleaning Optimization', 'Reduced solder paste residue defects by 42% through automated ultrasonic pulse cycles.', 'best_practice', 'Class 3', 'implemented', 5, admin_id, pe_prod_id, '2026-01-14 09:30:00+00'),
        ('JIG Quick-Clamp Pneumatic Lock for S26 Display Assembly', 'Fast-swapping pneumatic clamp mechanism reducing changeover time from 18 min to 3 min.', 'innovation', 'Class 3', 'implemented', 5, eng_id, pe_mecha_id, '2026-01-22 14:15:00+00'),
        ('Laser Soldering Temperature Feedback Calibration', 'Closed-loop IR pyrometer integration preventing board warping during BGA reflow.', 'best_practice', 'Class 4', 'approved', 4, eng_id, pe_mecha_id, '2026-01-28 11:00:00+00'),
        ('BOM Revision Automated Diff Checking Tool', 'Python script scanning SAP BOM export and highlighting component discrepancies.', 'innovation', 'Class 4', 'implemented', 4, admin_id, pe_prod_id, '2026-02-05 10:20:00+00'),
        ('GBA Flash Firmware Verification Automation', 'Automated test harness verifying Google Build Approval image checksum before line release.', 'best_practice', 'Class 3', 'implemented', 5, eng_id, pe_sol_id, '2026-02-18 16:40:00+00'),
        ('Unit BOX ESD Shielding Coating Improvement', 'Applied conductive nickel-graphite spray extending anti-static longevity to 18 months.', 'best_practice', 'Class 5', 'approved', 3, eng_id, pe_mecha_id, '2026-02-24 08:50:00+00'),
        ('IMEI Laser Marking Verification Sensor', 'High-speed 2D barcode scanner verifying IMEI readability in under 120ms per phone.', 'innovation', 'Class 3', 'implemented', 5, eng_id, pe_sol_id, '2026-03-03 13:10:00+00'),
        ('Pallet Return Conveyor Jam Detection System', 'Optical beam sensor array preventing pallet accumulation jams at main transfer station.', 'best_practice', 'Class 4', 'approved', 4, admin_id, pe_mecha_id, '2026-03-12 15:30:00+00'),
        ('PGM Programmer Socket Wear Preventive Counter', 'Digital socket insertion counter alerting maintenance before contact pin failure.', 'innovation', 'Class 4', 'implemented', 4, eng_id, pe_sol_id, '2026-03-21 09:15:00+00'),
        ('Feeder Maintenance Ultrasonic Bath Guide', 'Standardized ultrasonic cleaning protocol for high-speed Yamaha and Fuji component feeders.', 'best_practice', 'Class 5', 'approved', 3, admin_id, pe_prod_id, '2026-03-27 14:00:00+00'),
        ('Optical Inspection (AOI) False Alarm Filter Algorithm', 'Deep learning secondary filter cutting false defect calls by 68% on 0201 passives.', 'innovation', 'Class 3', 'review', 5, eng_id, pe_sol_id, '2026-04-04 11:25:00+00'),
        ('Screw Tightening Torque Graph Telemetry', 'Real-time torque-angle telemetry broadcast to line monitor for zero-defect fastening.', 'best_practice', 'Class 4', 'approved', 4, eng_id, pe_mecha_id, '2026-04-15 16:10:00+00'),
        ('Dispenser Nozzle Clog Pre-detection Sensor', 'Pressure decay monitoring detecting viscous adhesive clogging before line stoppage.', 'innovation', 'Class 4', 'implemented', 4, admin_id, pe_prod_id, '2026-04-20 10:45:00+00'),
        ('Manual Tape Feeder Splice Jig Modification', 'Mechanical alignment guide for SMD reel tape splicing, evaluated as non-adopt due to tape supplier standard.', 'innovation', 'Non Adopt', 'draft', 2, eng_id, pe_prod_id, '2026-04-28 14:00:00+00'),
        ('Smart Tool Cart RFID Real-time Inventory', 'UHF RFID shelf reading specialized torque drivers and calibrated gauges automatically.', 'innovation', 'Class 3', 'review', 5, eng_id, pe_mecha_id, '2026-05-02 08:30:00+00'),
        ('S26 Heat Pipe Thermal Paste Automated Dispensing Pattern', 'Custom multi-orifice nozzle geometry ensuring void-free thermal interface spreading.', 'best_practice', 'Class 3', 'approved', 5, admin_id, pe_prod_id, '2026-05-11 13:40:00+00'),
        ('Line Balance Tact Time Heatmap Dashboard', 'Live dashboard showing station bottleneck tact times updated every 30 seconds.', 'innovation', 'Class 4', 'implemented', 4, eng_id, pe_sol_id, '2026-05-22 17:00:00+00'),
        ('Nitrogen Purge Reflow Chamber Oxygen Sensor Probe', 'Upgraded zirconium oxygen sensor ensuring residual O2 under 50 ppm for fine-pitch BGA.', 'best_practice', 'Class 5', 'approved', 3, admin_id, pe_prod_id, '2026-06-04 10:15:00+00'),
        ('Automatic PCB Depaneling Router Bit Life Optimization', 'Spindle load current monitoring extending carbide router bit life by 25%.', 'best_practice', 'Class 4', 'review', 4, eng_id, pe_mecha_id, '2026-06-18 15:20:00+00'),
        ('Handheld Barcode Scanner Holster Contact Charger', 'Wireless inductive charging base for line scanners, currently undergoing durability review.', 'innovation', 'Under Review', 'review', 3, eng_id, pe_sol_id, '2026-07-08 11:30:00+00'),
        ('Conveyor Speed Sensor Optical Encoder Upgrade', 'High-resolution rotary encoder for seamless continuous flow without board shock.', 'best_practice', 'Class 5', 'approved', 3, admin_id, pe_mecha_id, '2026-08-14 09:00:00+00'),
        ('Camera Module Active Alignment Collimator Calibration', '6-axis robotic alignment standard for multi-lens telephoto module calibration.', 'best_practice', 'Class 3', 'implemented', 5, eng_id, pe_mecha_id, '2026-09-05 14:30:00+00'),
        ('Production Line ESD Wrist Strap Continuous Monitor Hub', 'IoT gateway alerting floor supervisor if operator ESD strap resistance exceeds 10M ohm.', 'innovation', 'Class 4', 'approved', 4, eng_id, pe_sol_id, '2026-10-12 16:00:00+00');
    END IF;
END $$;
