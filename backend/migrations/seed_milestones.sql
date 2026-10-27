-- Seed Models from sample milestone reference
-- ON1 (SM-S952BE), ON2 (SM-S956BE), ON3 (SM-S957BE), ON4 (SM-S958BE), Galaxy A08 5G (SM-A086B), Galaxy A18 5G (SM-A186BE)

DO $$
DECLARE
    m1_id UUID;
    m2_id UUID;
    m3_id UUID;
    m4_id UUID;
    m5_id UUID;
    m6_id UUID;
BEGIN
    -- 1. SM-S952BE (ON1)
    INSERT INTO new_models (model_name, marketing_name, codename, basic_models, stage, sort_order)
    VALUES ('SM-S952BE', 'ON1', 'ON1', '["BSM-S952BE/2D1", "BSM-S952BE/5D1"]'::jsonb, 'pvt', 1)
    ON CONFLICT DO NOTHING;
    SELECT id INTO m1_id FROM new_models WHERE model_name = 'SM-S952BE' LIMIT 1;

    -- 2. SM-S956BE (ON2)
    INSERT INTO new_models (model_name, marketing_name, codename, basic_models, stage, sort_order)
    VALUES ('SM-S956BE', 'ON2', 'ON2', '["BSM-S956BE/2D1", "BSM-S956BE/5D1"]'::jsonb, 'pvt', 2)
    ON CONFLICT DO NOTHING;
    SELECT id INTO m2_id FROM new_models WHERE model_name = 'SM-S956BE' LIMIT 1;

    -- 3. SM-S957BE (ON3)
    INSERT INTO new_models (model_name, marketing_name, codename, basic_models, stage, sort_order)
    VALUES ('SM-S957BE', 'ON3', 'ON3', '["BSM-S957BE/2D1", "BSM-S957BE/5D1", "BSM-S957BE/1TD"]'::jsonb, 'pvt', 3)
    ON CONFLICT DO NOTHING;
    SELECT id INTO m3_id FROM new_models WHERE model_name = 'SM-S957BE' LIMIT 1;

    -- 4. SM-S958BE (ON4)
    INSERT INTO new_models (model_name, marketing_name, codename, basic_models, stage, sort_order)
    VALUES ('SM-S958BE', 'ON4', 'ON4', '["BSM-S958BE/2D1", "BSM-S958BE/5D1", "BSM-S958BE/1TD"]'::jsonb, 'pvt', 4)
    ON CONFLICT DO NOTHING;
    SELECT id INTO m4_id FROM new_models WHERE model_name = 'SM-S958BE' LIMIT 1;

    -- 5. SM-A086B (Galaxy A08 5G)
    INSERT INTO new_models (model_name, marketing_name, codename, basic_models, stage, sort_order)
    VALUES ('SM-A086B', 'Galaxy A08 5G', 'Luxshare', '["BSM-A086B/6R4D", "BSM-A086B/1R4D", "BSM-A086B/1R6D", "BSM-A086B/2R8D"]'::jsonb, 'dvt', 5)
    ON CONFLICT DO NOTHING;
    SELECT id INTO m5_id FROM new_models WHERE model_name = 'SM-A086B' LIMIT 1;

    -- 6. SM-A186BE (Galaxy A18 5G)
    INSERT INTO new_models (model_name, marketing_name, codename, basic_models, stage, sort_order)
    VALUES ('SM-A186BE', 'Galaxy A18 5G', 'A18', '["BSM-A186BE/1D8", "BSM-A186BE/2D8"]'::jsonb, 'dvt', 6)
    ON CONFLICT DO NOTHING;
    SELECT id INTO m6_id FROM new_models WHERE model_name = 'SM-A186BE' LIMIT 1;

    -- Upsert sample values for SM-S952BE (ON1)
    IF m1_id IS NOT NULL THEN
        INSERT INTO new_model_milestones (model_id, category, sub_category, milestone_key, label, plan_value, sort_order) VALUES
        (m1_id, 'gating', 'Gating', 'pvr_basic', 'PVR (BASIC)', '23-Oct', 10),
        (m1_id, 'gating', 'Gating', 'pra_sea', 'PRA (SEA)', '27-Nov', 20),
        (m1_id, 'gating', 'Gating', 'sra_sea', 'SRA (SEA)', '11-Dec', 30),
        (m1_id, 'lqv', 'LQV', 'lqv_subline', 'Subline', '2-Dec (W49)', 40),
        (m1_id, 'lqv', 'LQV', 'lqv_smd_sec', 'SMD Secondary', '-', 50),
        (m1_id, 'lqv', 'LQV', 'lqv_smd_main', 'SMD Main', '-', 60),
        (m1_id, 'lqv', 'LQV', 'lqv_assembly', 'Assembly', '3-Dec (W49)', 70),
        (m1_id, 'lqv', 'LQV', 'lqv_inspection', 'Inspection', '7-Dec (W50)', 80),
        (m1_id, 'lqva_mp', 'LQVA', 'lqva', 'LQVA', '14-Dec (W51)', 90),
        (m1_id, 'lqva_mp', 'MP Plan', 'mp_sop', 'MP (Base on SOP Plan)', 'W1', 100),
        (m1_id, 'bom', 'BOM', 'bom_hq', 'HQ', 'TBD', 110),
        (m1_id, 'bom', 'BOM', 'bom_sein', 'SEIN', 'TBD', 120),
        (m1_id, 'sample', 'Sample', 'sample_tkdn_bom', 'TKDN/BOM', '-', 130),
        (m1_id, 'sample', 'Sample', 'sample_std_oqc', 'STD OQC', 'W48', 140),
        (m1_id, 'sample', 'Sample', 'sample_std_main', 'STD Main', 'W48', 150),
        (m1_id, 'sample', 'Sample', 'sample_disassembly', 'Disassembly', 'W48', 160),
        (m1_id, 'eng_verify', 'Engineering Verify', 'working_spec_register', 'Working Spec Register', 'W48', 170),
        (m1_id, 'eng_verify', 'Engineering Verify', 'sw_confirm_verify', 'S/W confirm & verify', 'W48', 180),
        (m1_id, 'eng_verify', 'Engineering Verify', 'pgm_verify', 'PGM verify', 'W48', 190),
        (m1_id, 'jig', 'JIG Status', 'jig_list', 'Jig List', 'W44', 200),
        (m1_id, 'jig', 'JIG Status', 'jig_pr_po', 'JIG PR & PO', 'W44', 210),
        (m1_id, 'jig', 'JIG Status', 'jig_eta', 'JIG ETA', 'W48', 220),
        (m1_id, 'jig', 'JIG Status', 'jig_verify', 'JIG Verify', 'W49', 230),
        (m1_id, 'equipment', 'Equipment & Cable', 'cable_list', 'Cable List', 'W44', 240),
        (m1_id, 'equipment', 'Equipment & Cable', 'cable_pr_po', 'Cable PR & PO', 'W44', 250),
        (m1_id, 'equipment', 'Equipment & Cable', 'cable_eta', 'Cable ETA', 'W48', 260),
        (m1_id, 'local_part', 'Local Part Approval', 'part_drawing', 'Drawing data', 'W45', 270),
        (m1_id, 'local_part', 'Local Part Approval', 'part_bidding', 'Bidding', 'N/A', 280),
        (m1_id, 'local_part', 'Local Part Approval', 'part_sample', 'Sample', 'W48', 290),
        (m1_id, 'local_part', 'Local Part Approval', 'part_iqc', 'IQC Test', 'W48', 300),
        (m1_id, 'local_part', 'Local Part Approval', 'part_approval', 'Approval', 'W49', 310),
        (m1_id, 'cert', 'Certification & Docs', 'tkdn_approved', 'TKDN Approved', 'W49', 320),
        (m1_id, 'cert', 'Certification & Docs', 'tkdn_value', 'TKDN Value', 'TBD', 330),
        (m1_id, 'cert', 'Certification & Docs', 'postel_approved', 'Postel Approved', 'W51', 340),
        (m1_id, 'cert', 'Certification & Docs', 'mkg_approved', 'MKG (Manual & Kartu Garansi)', 'W46', 350)
        ON CONFLICT (model_id, milestone_key) DO UPDATE SET plan_value = EXCLUDED.plan_value;
    END IF;

    -- Upsert sample values for SM-S956BE (ON2)
    IF m2_id IS NOT NULL THEN
        INSERT INTO new_model_milestones (model_id, category, sub_category, milestone_key, label, plan_value, sort_order) VALUES
        (m2_id, 'gating', 'Gating', 'pvr_basic', 'PVR (BASIC)', '23-Oct', 10),
        (m2_id, 'gating', 'Gating', 'pra_sea', 'PRA (SEA)', '27-Nov', 20),
        (m2_id, 'gating', 'Gating', 'sra_sea', 'SRA (SEA)', '11-Dec', 30),
        (m2_id, 'lqv', 'LQV', 'lqv_subline', 'Subline', '3-Dec (W49)', 40),
        (m2_id, 'lqv', 'LQV', 'lqv_smd_sec', 'SMD Secondary', '-', 50),
        (m2_id, 'lqv', 'LQV', 'lqv_smd_main', 'SMD Main', '-', 60),
        (m2_id, 'lqv', 'LQV', 'lqv_assembly', 'Assembly', '7-Dec (W50)', 70),
        (m2_id, 'lqv', 'LQV', 'lqv_inspection', 'Inspection', '8-Dec (W50)', 80),
        (m2_id, 'lqva_mp', 'LQVA', 'lqva', 'LQVA', '15-Dec (W51)', 90),
        (m2_id, 'lqva_mp', 'MP Plan', 'mp_sop', 'MP (Base on SOP Plan)', 'W1', 100),
        (m2_id, 'bom', 'BOM', 'bom_hq', 'HQ', '16-Oct', 110),
        (m2_id, 'bom', 'BOM', 'bom_sein', 'SEIN', '26-Oct', 120),
        (m2_id, 'sample', 'Sample', 'sample_tkdn_bom', 'TKDN/BOM', '-', 130),
        (m2_id, 'sample', 'Sample', 'sample_std_oqc', 'STD OQC', 'W48', 140),
        (m2_id, 'sample', 'Sample', 'sample_std_main', 'STD Main', 'W48', 150),
        (m2_id, 'sample', 'Sample', 'sample_disassembly', 'Disassembly', 'W48', 160),
        (m2_id, 'eng_verify', 'Engineering Verify', 'working_spec_register', 'Working Spec Register', 'W48', 170),
        (m2_id, 'eng_verify', 'Engineering Verify', 'sw_confirm_verify', 'S/W confirm & verify', 'W48', 180),
        (m2_id, 'eng_verify', 'Engineering Verify', 'pgm_verify', 'PGM verify', 'W48', 190),
        (m2_id, 'jig', 'JIG Status', 'jig_list', 'Jig List', 'W44', 200),
        (m2_id, 'jig', 'JIG Status', 'jig_pr_po', 'JIG PR & PO', 'W44', 210),
        (m2_id, 'jig', 'JIG Status', 'jig_eta', 'JIG ETA', 'W48', 220),
        (m2_id, 'jig', 'JIG Status', 'jig_verify', 'JIG Verify', 'W49', 230),
        (m2_id, 'equipment', 'Equipment & Cable', 'cable_list', 'Cable List', 'W44', 240),
        (m2_id, 'equipment', 'Equipment & Cable', 'cable_pr_po', 'Cable PR & PO', 'W44', 250),
        (m2_id, 'equipment', 'Equipment & Cable', 'cable_eta', 'Cable ETA', 'W48', 260),
        (m2_id, 'local_part', 'Local Part Approval', 'part_drawing', 'Drawing data', 'W45', 270),
        (m2_id, 'local_part', 'Local Part Approval', 'part_bidding', 'Bidding', 'N/A', 280),
        (m2_id, 'local_part', 'Local Part Approval', 'part_sample', 'Sample', 'W48', 290),
        (m2_id, 'local_part', 'Local Part Approval', 'part_iqc', 'IQC Test', 'W48', 300),
        (m2_id, 'local_part', 'Local Part Approval', 'part_approval', 'Approval', 'W49', 310),
        (m2_id, 'cert', 'Certification & Docs', 'tkdn_approved', 'TKDN Approved', 'W49', 320),
        (m2_id, 'cert', 'Certification & Docs', 'tkdn_value', 'TKDN Value', 'TBD', 330),
        (m2_id, 'cert', 'Certification & Docs', 'postel_approved', 'Postel Approved', 'W51', 340),
        (m2_id, 'cert', 'Certification & Docs', 'mkg_approved', 'MKG (Manual & Kartu Garansi)', 'W46', 350)
        ON CONFLICT (model_id, milestone_key) DO UPDATE SET plan_value = EXCLUDED.plan_value;
    END IF;

    -- Upsert sample values for SM-S957BE (ON3)
    IF m3_id IS NOT NULL THEN
        INSERT INTO new_model_milestones (model_id, category, sub_category, milestone_key, label, plan_value, sort_order) VALUES
        (m3_id, 'gating', 'Gating', 'pvr_basic', 'PVR (BASIC)', '23-Oct', 10),
        (m3_id, 'gating', 'Gating', 'pra_sea', 'PRA (SEA)', '27-Nov', 20),
        (m3_id, 'gating', 'Gating', 'sra_sea', 'SRA (SEA)', '11-Dec', 30),
        (m3_id, 'lqv', 'LQV', 'lqv_subline', 'Subline', '10-Dec (W50)', 40),
        (m3_id, 'lqv', 'LQV', 'lqv_smd_sec', 'SMD Secondary', '-', 50),
        (m3_id, 'lqv', 'LQV', 'lqv_smd_main', 'SMD Main', '-', 60),
        (m3_id, 'lqv', 'LQV', 'lqv_assembly', 'Assembly', '11-Dec (W50)', 70),
        (m3_id, 'lqv', 'LQV', 'lqv_inspection', 'Inspection', '14-Dec (W51)', 80),
        (m3_id, 'lqva_mp', 'LQVA', 'lqva', 'LQVA', '21-Dec (W52)', 90),
        (m3_id, 'lqva_mp', 'MP Plan', 'mp_sop', 'MP (Base on SOP Plan)', 'W1', 100),
        (m3_id, 'bom', 'BOM', 'bom_hq', 'HQ', '20-Oct', 110),
        (m3_id, 'bom', 'BOM', 'bom_sein', 'SEIN', '23-Oct', 120),
        (m3_id, 'sample', 'Sample', 'sample_tkdn_bom', 'TKDN/BOM', '-', 130),
        (m3_id, 'sample', 'Sample', 'sample_std_oqc', 'STD OQC', 'W48', 140),
        (m3_id, 'sample', 'Sample', 'sample_std_main', 'STD Main', 'W48', 150),
        (m3_id, 'sample', 'Sample', 'sample_disassembly', 'Disassembly', 'W48', 160),
        (m3_id, 'eng_verify', 'Engineering Verify', 'working_spec_register', 'Working Spec Register', 'W48', 170),
        (m3_id, 'eng_verify', 'Engineering Verify', 'sw_confirm_verify', 'S/W confirm & verify', 'W48', 180),
        (m3_id, 'eng_verify', 'Engineering Verify', 'pgm_verify', 'PGM verify', 'W48', 190),
        (m3_id, 'jig', 'JIG Status', 'jig_list', 'Jig List', 'W44', 200),
        (m3_id, 'jig', 'JIG Status', 'jig_pr_po', 'JIG PR & PO', 'W44', 210),
        (m3_id, 'jig', 'JIG Status', 'jig_eta', 'JIG ETA', 'W49', 220),
        (m3_id, 'jig', 'JIG Status', 'jig_verify', 'JIG Verify', 'W50', 230),
        (m3_id, 'equipment', 'Equipment & Cable', 'cable_list', 'Cable List', 'W44', 240),
        (m3_id, 'equipment', 'Equipment & Cable', 'cable_pr_po', 'Cable PR & PO', 'W44', 250),
        (m3_id, 'equipment', 'Equipment & Cable', 'cable_eta', 'Cable ETA', 'W48', 260),
        (m3_id, 'local_part', 'Local Part Approval', 'part_drawing', 'Drawing data', 'W45', 270),
        (m3_id, 'local_part', 'Local Part Approval', 'part_bidding', 'Bidding', 'N/A', 280),
        (m3_id, 'local_part', 'Local Part Approval', 'part_sample', 'Sample', 'W49', 290),
        (m3_id, 'local_part', 'Local Part Approval', 'part_iqc', 'IQC Test', 'W49', 300),
        (m3_id, 'local_part', 'Local Part Approval', 'part_approval', 'Approval', 'W50', 310),
        (m3_id, 'cert', 'Certification & Docs', 'tkdn_approved', 'TKDN Approved', 'W49', 320),
        (m3_id, 'cert', 'Certification & Docs', 'tkdn_value', 'TKDN Value', 'TBD', 330),
        (m3_id, 'cert', 'Certification & Docs', 'postel_approved', 'Postel Approved', 'W51', 340),
        (m3_id, 'cert', 'Certification & Docs', 'mkg_approved', 'MKG (Manual & Kartu Garansi)', 'W46', 350)
        ON CONFLICT (model_id, milestone_key) DO UPDATE SET plan_value = EXCLUDED.plan_value;
    END IF;

    -- Upsert sample values for SM-S958BE (ON4)
    IF m4_id IS NOT NULL THEN
        INSERT INTO new_model_milestones (model_id, category, sub_category, milestone_key, label, plan_value, sort_order) VALUES
        (m4_id, 'gating', 'Gating', 'pvr_basic', 'PVR (BASIC)', '23-Oct', 10),
        (m4_id, 'gating', 'Gating', 'pra_sea', 'PRA (SEA)', '27-Nov', 20),
        (m4_id, 'gating', 'Gating', 'sra_sea', 'SRA (SEA)', '11-Dec', 30),
        (m4_id, 'lqv', 'LQV', 'lqv_subline', 'Subline', '11-Dec (W50)', 40),
        (m4_id, 'lqv', 'LQV', 'lqv_smd_sec', 'SMD Secondary', '-', 50),
        (m4_id, 'lqv', 'LQV', 'lqv_smd_main', 'SMD Main', '-', 60),
        (m4_id, 'lqv', 'LQV', 'lqv_assembly', 'Assembly', '14-Dec (W51)', 70),
        (m4_id, 'lqv', 'LQV', 'lqv_inspection', 'Inspection', '15-Dec (W51)', 80),
        (m4_id, 'lqva_mp', 'LQVA', 'lqva', 'LQVA', '22-Dec (W52)', 90),
        (m4_id, 'lqva_mp', 'MP Plan', 'mp_sop', 'MP (Base on SOP Plan)', 'W1', 100),
        (m4_id, 'bom', 'BOM', 'bom_hq', 'HQ', 'TBD', 110),
        (m4_id, 'bom', 'BOM', 'bom_sein', 'SEIN', 'TBD', 120),
        (m4_id, 'sample', 'Sample', 'sample_tkdn_bom', 'TKDN/BOM', '-', 130),
        (m4_id, 'sample', 'Sample', 'sample_std_oqc', 'STD OQC', 'W48', 140),
        (m4_id, 'sample', 'Sample', 'sample_std_main', 'STD Main', 'W48', 150),
        (m4_id, 'sample', 'Sample', 'sample_disassembly', 'Disassembly', 'W48', 160),
        (m4_id, 'eng_verify', 'Engineering Verify', 'working_spec_register', 'Working Spec Register', 'W48', 170),
        (m4_id, 'eng_verify', 'Engineering Verify', 'sw_confirm_verify', 'S/W confirm & verify', 'W48', 180),
        (m4_id, 'eng_verify', 'Engineering Verify', 'pgm_verify', 'PGM verify', 'W48', 190),
        (m4_id, 'jig', 'JIG Status', 'jig_list', 'Jig List', 'W44', 200),
        (m4_id, 'jig', 'JIG Status', 'jig_pr_po', 'JIG PR & PO', 'W44', 210),
        (m4_id, 'jig', 'JIG Status', 'jig_eta', 'JIG ETA', 'W49', 220),
        (m4_id, 'jig', 'JIG Status', 'jig_verify', 'JIG Verify', 'W50', 230),
        (m4_id, 'equipment', 'Equipment & Cable', 'cable_list', 'Cable List', 'W44', 240),
        (m4_id, 'equipment', 'Equipment & Cable', 'cable_pr_po', 'Cable PR & PO', 'W44', 250),
        (m4_id, 'equipment', 'Equipment & Cable', 'cable_eta', 'Cable ETA', 'W48', 260),
        (m4_id, 'local_part', 'Local Part Approval', 'part_drawing', 'Drawing data', 'W45', 270),
        (m4_id, 'local_part', 'Local Part Approval', 'part_bidding', 'Bidding', 'N/A', 280),
        (m4_id, 'local_part', 'Local Part Approval', 'part_sample', 'Sample', 'W49', 290),
        (m4_id, 'local_part', 'Local Part Approval', 'part_iqc', 'IQC Test', 'W49', 300),
        (m4_id, 'local_part', 'Local Part Approval', 'part_approval', 'Approval', 'W50', 310),
        (m4_id, 'cert', 'Certification & Docs', 'tkdn_approved', 'TKDN Approved', 'W49', 320),
        (m4_id, 'cert', 'Certification & Docs', 'tkdn_value', 'TKDN Value', 'TBD', 330),
        (m4_id, 'cert', 'Certification & Docs', 'postel_approved', 'Postel Approved', 'W51', 340),
        (m4_id, 'cert', 'Certification & Docs', 'mkg_approved', 'MKG (Manual & Kartu Garansi)', 'W46', 350)
        ON CONFLICT (model_id, milestone_key) DO UPDATE SET plan_value = EXCLUDED.plan_value;
    END IF;

    -- Upsert sample values for SM-A086B (Luxshare / Galaxy A08 5G)
    IF m5_id IS NOT NULL THEN
        INSERT INTO new_model_milestones (model_id, category, sub_category, milestone_key, label, plan_value, sort_order) VALUES
        (m5_id, 'gating', 'Gating', 'pvr_basic', 'PVR (BASIC)', '-', 10),
        (m5_id, 'gating', 'Gating', 'pra_sea', 'PRA (SEA)', '20-Nov', 20),
        (m5_id, 'gating', 'Gating', 'sra_sea', 'SRA (SEA)', '12-Dec', 30),
        (m5_id, 'lqv', 'LQV', 'lqv_assembly', 'Assembly', 'TBD', 70),
        (m5_id, 'lqva_mp', 'MP Plan', 'mp_sop', 'MP (Base on SOP Plan)', 'TBD', 100)
        ON CONFLICT (model_id, milestone_key) DO UPDATE SET plan_value = EXCLUDED.plan_value;
    END IF;

    -- Upsert sample values for SM-A186BE (Galaxy A18 5G)
    IF m6_id IS NOT NULL THEN
        INSERT INTO new_model_milestones (model_id, category, sub_category, milestone_key, label, plan_value, sort_order) VALUES
        (m6_id, 'gating', 'Gating', 'pvr_basic', 'PVR (BASIC)', '13-Nov', 10),
        (m6_id, 'gating', 'Gating', 'pra_sea', 'PRA (SEA)', '21-Dec', 20),
        (m6_id, 'gating', 'Gating', 'sra_sea', 'SRA (SEA)', '7-Jan', 30),
        (m6_id, 'lqv', 'LQV', 'lqv_assembly', 'Assembly', 'TBD', 70),
        (m6_id, 'lqva_mp', 'MP Plan', 'mp_sop', 'MP (Base on SOP Plan)', 'TBD', 100)
        ON CONFLICT (model_id, milestone_key) DO UPDATE SET plan_value = EXCLUDED.plan_value;
    END IF;

END $$;
