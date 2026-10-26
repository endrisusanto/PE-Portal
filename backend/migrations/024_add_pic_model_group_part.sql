-- Migration 024: Add PIC Model job to PE Part (pe_production) group
INSERT INTO group_parts (name, parent_group, description, sort_order)
SELECT 'PIC Model', 'pe_production', 'Person In Charge of new model introduction, engineering samples & line readiness', 4
WHERE NOT EXISTS (
    SELECT 1 FROM group_parts WHERE name = 'PIC Model' AND parent_group = 'pe_production'
);
