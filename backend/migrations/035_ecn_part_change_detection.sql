-- Migration 035: Add part_before and part_after columns to ecn_records and populate them from remark / ec_title
ALTER TABLE ecn_records ADD COLUMN IF NOT EXISTS part_before TEXT;
ALTER TABLE ecn_records ADD COLUMN IF NOT EXISTS part_after TEXT;

CREATE INDEX IF NOT EXISTS idx_ecn_part_before ON ecn_records(part_before);
CREATE INDEX IF NOT EXISTS idx_ecn_part_after ON ecn_records(part_after);

-- Backfill existing part number changes from remark or ec_title
UPDATE ecn_records
SET 
  part_before = COALESCE(
    (regexp_match(remark, '([A-Za-z0-9]{2,6}-[A-Za-z0-9]{4,7}[A-Za-z0-9]?)\s*(?:->|➔|→|=>|to)\s*([A-Za-z0-9]{2,6}-[A-Za-z0-9]{4,7}[A-Za-z0-9]?)'))[1],
    (regexp_match(ec_title, '([A-Za-z0-9]{2,6}-[A-Za-z0-9]{4,7}[A-Za-z0-9]?)\s*(?:->|➔|→|=>|to)\s*([A-Za-z0-9]{2,6}-[A-Za-z0-9]{4,7}[A-Za-z0-9]?)'))[1]
  ),
  part_after = COALESCE(
    (regexp_match(remark, '([A-Za-z0-9]{2,6}-[A-Za-z0-9]{4,7}[A-Za-z0-9]?)\s*(?:->|➔|→|=>|to)\s*([A-Za-z0-9]{2,6}-[A-Za-z0-9]{4,7}[A-Za-z0-9]?)'))[2],
    (regexp_match(ec_title, '([A-Za-z0-9]{2,6}-[A-Za-z0-9]{4,7}[A-Za-z0-9]?)\s*(?:->|➔|→|=>|to)\s*([A-Za-z0-9]{2,6}-[A-Za-z0-9]{4,7}[A-Za-z0-9]?)'))[2]
  )
WHERE (part_before IS NULL OR part_before = '')
  AND (
    remark ~ '([A-Za-z0-9]{2,6}-[A-Za-z0-9]{4,7}[A-Za-z0-9]?)\s*(?:->|➔|→|=>|to)\s*([A-Za-z0-9]{2,6}-[A-Za-z0-9]{4,7}[A-Za-z0-9]?)'
    OR ec_title ~ '([A-Za-z0-9]{2,6}-[A-Za-z0-9]{4,7}[A-Za-z0-9]?)\s*(?:->|➔|→|=>|to)\s*([A-Za-z0-9]{2,6}-[A-Za-z0-9]{4,7}[A-Za-z0-9]?)'
  );
