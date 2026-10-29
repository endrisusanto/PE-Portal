#!/usr/bin/env python3
"""
ecn_parser.py
Parses ECN Monitoring Excel spreadsheets for SEIN PE-Portal.
Supports standard .xlsx files and detects NASCA/Fasoo/Samsung corporate DRM encryption.
Outputs structured JSON to stdout for the Go backend.
"""

import sys
import os
import json
import argparse
import re

# Force UTF-8 encoding on standard I/O streams for Windows compatibility
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    try:
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

ILLEGAL_XML_CHARS_RE = re.compile(r'[\x00-\x08\x0b\x0c\x0e-\x1f]')

DRM_SIGNATURES = [
    b"NASCA",
    b"FASOO",
    b"FSD_DRM",
    b"SoftCamp",
    b"SAMSUNG_DRM",
    b"DRMSecurity",
    b"<## NASCA DRM",
]

ALL_KEYS = [
    'ecn_no', 'model', 'function_type', 'purpose', 'inventory_mgmt',
    'process', 'ec_title', 'parent_code', 'parent_name', 'part_before', 'part_after', 'before_after',
    'dl', 'child_code', 'child_name', 'specification', 'quantity',
    'marking_point', 'running_date_bom', 'distribution_date', 'status', 'remark'
]


def clean_cell_str(val):
    if val is None:
        return ""
    s = str(val).replace('\r\n', '\n').replace('\r', '\n').replace('\x0b', '\n').strip()
    return ILLEGAL_XML_CHARS_RE.sub('', s)


# ponytail: normalize dates (datetime objects, M/D/YYYY, etc.) to YYYY-MM-DD
def clean_date_str(val):
    if val is None:
        return ""
    if hasattr(val, 'strftime'):
        return val.strftime('%Y-%m-%d')
    s = clean_cell_str(val)
    if not s or s == '-' or s.lower() == 'eco cancel':
        return s
    m = re.match(r'^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$', s)
    if m:
        p1, p2, y = int(m.group(1)), int(m.group(2)), m.group(3)
        month = p2 if p1 > 12 else p1
        day = p1 if p1 > 12 else p2
        return f"{y}-{month:02d}-{day:02d}"
    if re.match(r'^\d{4}-\d{2}-\d{2}', s):
        return s[:10]
    return s


def is_drm_protected(file_path):
    """Check if the file has corporate DRM signatures or is encrypted."""
    try:
        with open(file_path, 'rb') as f:
            header = f.read(512)
            for sig in DRM_SIGNATURES:
                if sig.lower() in header.lower():
                    return True, sig.decode('utf-8', errors='ignore')
            # Check if standard zip magic PK\x03\x04
            if not header.startswith(b'PK\x03\x04'):
                return True, "Non-ZIP (Possible Encrypted Container)"
    except Exception as e:
        return True, str(e)
    return False, ""


def normalize_header(header_text):
    """Normalize column header to internal key."""
    h = str(header_text or '').strip().lower()
    h = re.sub(r'[^a-z0-9]', '', h)

    if not h:
        return None

    if 'ecn' in h:
        return 'ecn_no'
    if 'model' in h:
        return 'model'
    if 'function' in h or 'division' in h or 'dept' in h or (h in ['type', 'tipe']):
        return 'function_type'
    if 'purpose' in h or 'alasan' in h or 'reason' in h:
        return 'purpose'
    if 'inventory' in h or 'mgmt' in h or 'disposition' in h or 'stock' in h or 'wip' in h:
        return 'inventory_mgmt'
    if 'proses' in h or 'process' in h:
        return 'process'
    if 'title' in h or 'subject' in h or 'judul' in h:
        return 'ec_title'
    if 'parent' in h:
        if any(x in h for x in ['name', 'desc', 'nm', 'nama']):
            return 'parent_name'
        return 'parent_code'
    if 'child' in h:
        if any(x in h for x in ['name', 'desc', 'nm', 'nama']):
            return 'child_name'
        return 'child_code'
    if 'before' in h or 'after' in h or 'change' in h:
        return 'before_after'
    if h in ['dl', 'd_l']:
        return 'dl'
    if 'itemcode' in h or 'partcode' in h or 'partno' in h:
        return 'child_code'
    if 'itemname' in h or 'partname' in h or 'partdesc' in h:
        return 'child_name'
    if 'specification' in h or 'spec' in h:
        return 'specification'
    if 'qty' in h or 'quantity' in h or 'count' in h or 'amount' in h:
        return 'quantity'
    if 'marking' in h or 'location' in h or 'designator' in h:
        return 'marking_point'
    if 'running' in h or 'apply' in h or 'bomdate' in h:
        return 'running_date_bom'
    if 'dist' in h or 'release' in h or 'issued' in h:
        return 'distribution_date'
    if 'status' in h:
        return 'status'
    if 'remark' in h or 'note' in h or 'keterangan' in h:
        return 'remark'

    return None


def parse_xlsx(file_path):
    import openpyxl

    # Use read_only=True and data_only=True for streaming large files with minimal RAM and maximum speed
    wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
    try:
        ws = wb.active
        row_iter = ws.iter_rows(values_only=True)

        # 1. Read first up to 15 rows to find header
        header_idx = -1
        col_mapping = {}
        sample_rows = []
        for idx in range(15):
            try:
                r = next(row_iter)
                sample_rows.append(r)
                row_str = ' '.join([str(c or '') for c in r]).upper()
                if 'ECN' in row_str or 'MODEL' in row_str:
                    header_idx = idx
                    for c_idx, cell in enumerate(r):
                        key = normalize_header(cell)
                        if key:
                            col_mapping[c_idx] = key
                    break
            except StopIteration:
                break

        if header_idx == -1:
            # Fallback to default positional mapping
            for i, k in enumerate(ALL_KEYS):
                col_mapping[i] = k
            data_rows_initial = sample_rows
        else:
            data_rows_initial = sample_rows[header_idx + 1:]

        records = []
        current_cache = {k: "" for k in ALL_KEYS}
        last_ecn_no = ""

        def process_row(r):
            nonlocal current_cache, last_ecn_no
            if not any(r):
                return
            record = {k: "" for k in ALL_KEYS}
            has_any_content = False
            for c_idx, val in enumerate(r):
                if c_idx in col_mapping:
                    k = col_mapping[c_idx]
                    clean_val = clean_date_str(val) if k in ('running_date_bom', 'distribution_date') else clean_cell_str(val)
                    if clean_val:
                        has_any_content = True
                    record[k] = clean_val

            if not has_any_content:
                return

            row_ecn_no = record['ecn_no'].strip()
            # If a new distinct ECN NO is encountered, start a fresh cache block
            if row_ecn_no and row_ecn_no != last_ecn_no:
                current_cache = {k: "" for k in ALL_KEYS}
                last_ecn_no = row_ecn_no

            # Forward-fill all columns for merged cells (from parent_code to marking_point and headers)
            for k in ALL_KEYS:
                val = record[k].strip()
                if val:
                    current_cache[k] = val
                elif current_cache[k]:
                    record[k] = current_cache[k]

            # Safe fallbacks for missing/empty columns
            if not record['ecn_no']:
                record['ecn_no'] = '-'
            if not record['status']:
                record['status'] = 'Pending'

            # ponytail: Auto-detect part number change from remark or ec_title
            if not record.get('part_before') and not record.get('part_after'):
                text_to_check = (record.get('remark') or '') + ' ' + (record.get('ec_title') or '')
                m = re.search(r'([A-Za-z0-9]{2,6}-[A-Za-z0-9]{4,7}[A-Za-z0-9]?)\s*(?:->|➔|→|=>|to)\s*([A-Za-z0-9]{2,6}-[A-Za-z0-9]{4,7}[A-Za-z0-9]?)', text_to_check)
                if m:
                    record['part_before'] = m.group(1)
                    record['part_after'] = m.group(2)

            records.append(record)

        # Process initial cached rows
        for r in data_rows_initial:
            process_row(r)

        # Stream remaining rows
        for r in row_iter:
            process_row(r)

        return records
    finally:
        wb.close()


def main():
    parser = argparse.ArgumentParser(description="SEIN PE-Portal ECN Excel Parser")
    parser.add_argument("--input-file", required=True, help="Path ke file Excel (.xlsx)")
    args = parser.parse_args()

    if not os.path.exists(args.input_file):
        print(json.dumps({"success": False, "error": "File tidak ditemukan"}, ensure_ascii=False))
        sys.exit(1)

    # 1. DRM check
    is_drm, drm_sig = is_drm_protected(args.input_file)
    if is_drm:
        res = {
            "success": False,
            "is_drm": True,
            "drm_signature": drm_sig,
            "message": f"File terproteksi Samsung Corporate DRM ({drm_sig}). Silakan gunakan fitur 'Paste Table' (Copy seluruh tabel dari Microsoft Excel lalu Paste) untuk mengimpor data secara instan."
        }
        print(json.dumps(res, ensure_ascii=False))
        sys.exit(0)

    # 2. Parse clean Excel
    try:
        records = parse_xlsx(args.input_file)
        res = {
            "success": True,
            "is_drm": False,
            "total": len(records),
            "records": records
        }
        print(json.dumps(res, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"success": False, "is_drm": False, "error": f"Gagal membaca file Excel: {str(e)}"}, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
