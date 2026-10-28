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


def clean_cell_str(val):
    if val is None:
        return ""
    s = str(val).replace('\r\n', '\n').replace('\r', '\n').replace('\x0b', '\n').strip()
    return ILLEGAL_XML_CHARS_RE.sub('', s)


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

    if 'ecn' in h or 'ecnno' in h:
        return 'ecn_no'
    if h == 'model' or 'model' in h:
        return 'model'
    if 'function' in h or 'type' in h:
        return 'function_type'
    if 'purpose' in h:
        return 'purpose'
    if 'inventory' in h or 'mgmt' in h:
        return 'inventory_mgmt'
    if 'proses' in h or 'process' in h:
        return 'process'
    if 'ectitle' in h or 'title' in h:
        return 'ec_title'
    if 'parentcode' in h:
        return 'parent_code'
    if 'parentname' in h:
        return 'parent_name'
    if 'beforeafter' in h or 'before' in h:
        return 'before_after'
    if h in ['dl', 'd_l']:
        return 'dl'
    if 'childcode' in h:
        return 'child_code'
    if 'childname' in h:
        return 'child_name'
    if 'specification' in h or 'spec' in h:
        return 'specification'
    if 'qty' in h or 'quantity' in h:
        return 'quantity'
    if 'marking' in h:
        return 'marking_point'
    if 'runningdate' in h or 'running' in h:
        return 'running_date_bom'
    if 'distribution' in h or 'distdate' in h:
        return 'distribution_date'
    if 'status' in h:
        return 'status'
    if 'remark' in h or 'note' in h:
        return 'remark'

    return None


def parse_xlsx(file_path):
    import openpyxl

    wb = openpyxl.load_workbook(file_path, data_only=True)
    ws = wb.active

    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return []

    # Find header row (search first 10 rows for 'ECN NO' or 'MODEL')
    header_idx = -1
    col_mapping = {}

    for idx, r in enumerate(rows[:10]):
        row_str = ' '.join([str(c or '') for c in r]).upper()
        if 'ECN NO' in row_str or 'ECN' in row_str:
            header_idx = idx
            for c_idx, cell in enumerate(r):
                key = normalize_header(cell)
                if key:
                    col_mapping[c_idx] = key
            break

    if header_idx == -1:
        # Fallback to row 0 or default positional mapping
        default_keys = [
            'ecn_no', 'model', 'function_type', 'purpose', 'inventory_mgmt',
            'process', 'ec_title', 'parent_code', 'parent_name', 'before_after',
            'dl', 'child_code', 'child_name', 'specification', 'quantity',
            'marking_point', 'running_date_bom', 'distribution_date', 'status', 'remark'
        ]
        for i, k in enumerate(default_keys):
            col_mapping[i] = k
        data_rows = rows
    else:
        data_rows = rows[header_idx + 1:]

    records = []
    for r in data_rows:
        if not any(r):
            continue
        record = {}
        for c_idx, val in enumerate(r):
            if c_idx in col_mapping:
                record[col_mapping[c_idx]] = clean_cell_str(val)

        # Only add if has at least ECN NO or MODEL or EC TITLE
        if record.get('ecn_no') or record.get('model') or record.get('ec_title'):
            # Default status if empty
            if not record.get('status'):
                record['status'] = 'Pending'
            records.append(record)

    return records


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
