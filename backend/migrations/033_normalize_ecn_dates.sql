-- ponytail: Normalize legacy date formats (M/D/YYYY) to standard YYYY-MM-DD for HTML5 date inputs
UPDATE ecn_records 
SET running_date_bom = to_char(to_date(running_date_bom, 'MM/DD/YYYY'), 'YYYY-MM-DD')
WHERE running_date_bom ~ '^\d{1,2}/\d{1,2}/\d{4}$';

UPDATE ecn_records 
SET distribution_date = to_char(to_date(distribution_date, 'MM/DD/YYYY'), 'YYYY-MM-DD')
WHERE distribution_date ~ '^\d{1,2}/\d{1,2}/\d{4}$';

