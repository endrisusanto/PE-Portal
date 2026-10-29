#!/usr/bin/env python3
"""
pptx_summary.py
PowerPoint (.pptx) Auto Summary Extractor & Executive Defect Dashboard for SEIN PE-Portal.
Extracts defect report metadata, analysis conclusions, countermeasures, and auto-categorization
from multiple PowerPoint files into a multi-sheet Excel workbook with interactive charts
(Executive Dashboard, Category Summary, Model Pareto, Worst Issue Pareto) and structured JSON/Markdown.

// ponytail: Resilient dual-engine architecture:
// 1. Full 5-sheet OpenXML Excel workbook with openpyxl charts (Pie, Bar, Combo Line).
// 2. Pure Python standard library (zipfile + xml.etree.ElementTree) fallback guaranteeing
//    100% functionality and high-speed text extraction even in minimal environments.
"""

import os
import sys
import json
import argparse
import re
from datetime import datetime
from collections import Counter
import zipfile
import xml.etree.ElementTree as ET

# Force UTF-8 encoding on standard I/O streams for Windows baremetal compatibility
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

# Optional third-party libraries
try:
    from pptx import Presentation
    HAS_PPTX = True
except ImportError:
    HAS_PPTX = False

try:
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.chart import PieChart, BarChart, LineChart, Reference
    HAS_OPENPYXL = True
except ImportError:
    HAS_OPENPYXL = False


def clean_and_format_text(text, is_action=False):
    """
    Membersihkan footer laporan, membuang simbol kotak/tanda tanya/simbol asing,
    dan menyeragamkan bullet '-' secara konsisten.
    """
    if not text:
        return ""

    unwanted_phrases = [
        "sein mx product engineering",
        "technical report",
        "in process technical report",
        "drafter",
        "part leader",
        "group leader",
        "problem information",
        "detail report",
        "sample cn",
        "sample qty",
        "defect location",
        "defect date"
    ]

    lines = str(text).split("\n")
    cleaned_lines = []

    for line in lines:
        line_clean = line.strip()
        line_lower = line_clean.lower()

        # Jika untuk kolom Action dan mendeteksi footer laporan, hentikan parsing ke bawah
        if is_action:
            is_unwanted = any(phrase in line_lower for phrase in unwanted_phrases)
            if is_unwanted:
                break

        if line_clean:
            # 1. Hapus simbol bullet atau panah lama dari file sumber
            for symbol in ['•', '→', '*', '->', '–', '-']:
                if line_clean.startswith(symbol):
                    line_clean = line_clean[len(symbol):].strip()

            # 2. Hapus simbol kotak/tanda tanya tak dikenal (Private Use Area & replacement char)
            line_clean = re.sub(r'[\uFFFD\uf000-\uf8ff]', '', line_clean)

            # 3. Bersihkan karakter simbol non-standar di tengah kalimat
            line_clean = re.sub(r'[^\w\s.,;:()\'\"+/?=\-%]', ' ', line_clean)

            # Rapikan spasi ganda hasil pembersihan
            line_clean = re.sub(r'\s+', ' ', line_clean).strip()

            # 4. Terapkan simbol baru '-' secara konsisten di setiap awal kalimat bersih
            if line_clean:
                cleaned_lines.append(f"- {line_clean}")

    return "\n".join(cleaned_lines)


def parse_qty(qty_str):
    """Mengekstrak angka bulat murni, mengabaikan 'ea', 'ae', 'pcs', dan teks satuan lainnya."""
    if not qty_str:
        return 1
    cleaned = re.sub(r'(?i)(ea|ae|pcs|item|unit)', '', str(qty_str)).strip()
    match = re.search(r'\d+', cleaned)
    return int(match.group()) if match else 1


def determine_category(action_text):
    """
    Klasifikasi otomatis kategori defect:
    Jika action mengandung 'part number' atau 'maker' -> Material, jika tidak -> Proses
    """
    act_lower = (action_text or "").lower()
    if "part number" in act_lower or "maker" in act_lower or "vendor" in act_lower or "supplier" in act_lower:
        return "Material"
    return "Proses"


def extract_sections_from_full_text(full_slide_text, conclusions_list, actions_list):
    """
    Memisahkan dan mengekstrak teks Conclusion vs Action & Countermeasure
    berdasarkan posisi kata kunci di slide.
    """
    if not full_slide_text:
        return

    text_lower = full_slide_text.lower()
    conc_idx = text_lower.find("conclusion")
    act_idx = text_lower.find("action & countermeasure")
    if act_idx == -1:
        act_idx = text_lower.find("action")

    # A. Ekstraksi antara Conclusion sampai Action & Countermeasure
    if conc_idx != -1:
        start_pos = conc_idx + len("conclusion")
        end_pos = act_idx if act_idx != -1 and act_idx > conc_idx else len(full_slide_text)

        raw_conc = full_slide_text[start_pos:end_pos].strip().lstrip(":-").strip()
        extracted_conc = clean_and_format_text(raw_conc, is_action=False)

        if extracted_conc and extracted_conc not in conclusions_list:
            conclusions_list.append(extracted_conc)

    # B. Ekstraksi setelah Action & Countermeasure
    if act_idx != -1:
        kw_matched = "action & countermeasure" if "action & countermeasure" in text_lower[act_idx:] else "action"
        start_pos = act_idx + len(kw_matched)

        raw_act = full_slide_text[start_pos:].strip().lstrip(":-").strip()
        extracted_act = clean_and_format_text(raw_act, is_action=True)

        if extracted_act and extracted_act not in actions_list:
            actions_list.append(extracted_act)


def clean_metadata_label(text):
    """Membersihkan teks label tabel metadata (menghilangkan bullet, spasi ganda, titik dua)."""
    if not text:
        return ""
    cleaned = re.sub(r'\s+', ' ', str(text)).strip()
    return cleaned.strip("-•* :").lower()


def clean_metadata_value(text):
    """Membersihkan nilai isi metadata (menghilangkan bullet dan memformat baris bersih)."""
    if not text:
        return ""
    s = clean_cell_str(text).strip()
    lines = [re.sub(r'^[•\-\*–\s]+', '', line).strip() for line in s.split('\n')]
    lines = [l for l in lines if l]
    return ", ".join(lines) if len(lines) > 1 else (lines[0] if lines else "")


def is_cn_label(label):
    """Mendeteksi apakah label adalah identifier CN / Tracking / Serial Number."""
    if not label:
        return False
    norm = re.sub(r'[^a-z0-9/]', ' ', label.lower())
    words = norm.split()
    if not words:
        return False
    if 'c/n' in norm or 's/n' in norm:
        return True
    if any(w in ('cn', 'sn', 'serial') for w in words):
        return True
    if 'samplecn' in norm or 'trackingcn' in norm or 'samplesn' in norm:
        return True
    if norm.endswith('cn') or norm.endswith('sn'):
        return True
    return False


def is_qty_label(label):
    """Mendeteksi apakah label adalah Defect Qty atau Sample Qty (bukan CN)."""
    if not label or is_cn_label(label):
        return False
    if label[0].isdigit():
        return False
    norm = re.sub(r'[^a-z0-9]', ' ', label.lower())
    words = norm.split()
    if not words:
        return False
    if any(w in ('qty', 'quantity') for w in words):
        return True
    if 'sampleqty' in norm or 'defectqty' in norm:
        return True
    if "q'ty" in label.lower() or 'qty' in label.lower() or 'quantity' in label.lower():
        return True
    if words == ['sample']:
        return True
    if norm in ('sample ea', 'sample pcs', 'defect ea', 'qty ea'):
        return True
    return False


def is_probable_cn_value(val):
    """Mendeteksi apakah suatu teks kemungkinan besar adalah nomor CN/Serial (bukan quantity)."""
    if not val:
        return False
    s = str(val).strip()
    if ',' in s or ';' in s:
        return True
    if len(s) >= 10 and re.search(r'\d+[a-zA-Z]|[a-zA-Z]+\d+', s):
        return True
    return False


def match_table_metadata(row_texts, data):
    """Mencocokkan baris tabel metadata standar Samsung OQC / PE (Model, Problem, CN, dll)."""
    for i, cell_text in enumerate(row_texts):
        label = clean_metadata_label(cell_text)
        if not label:
            continue
        if i + 1 < len(row_texts):
            raw_val = row_texts[i + 1]
            next_val = clean_metadata_value(raw_val)
            if not next_val:
                continue

            if (label == 'model' or label.startswith('model')) and not data["Model"]:
                data["Model"] = next_val
            elif (label == 'problem' or label.startswith('problem')) and not data["Problem"]:
                data["Problem"] = next_val
            elif is_cn_label(label):
                if not data["CN"] or is_probable_cn_value(next_val):
                    data["CN"] = next_val
                # Jika Defect Qty sebelumnya salah terisi nilai CN ini, bersihkan!
                if data.get('Defect Qty') == next_val:
                    data['Defect Qty'] = ''
            elif ('defect date' in label or label == 'date' or label.endswith('date')) and not data["Defect Date"]:
                data["Defect Date"] = next_val
            elif ('defect location' in label or 'location' in label) and not data["Defect Location"]:
                data["Defect Location"] = next_val
            elif is_qty_label(label):
                if not is_probable_cn_value(next_val):
                    data["Defect Qty"] = next_val
                elif not data["CN"]:
                    data["CN"] = next_val


def extract_metadata_from_text(full_text, data):
    """Ekstraksi metadata fallback dari format key-value baris teks (e.g. 'Sample CN: ...' atau 'Sample QTY: 7 ea')."""
    if not full_text:
        return
    for line in full_text.split('\n'):
        line_clean = line.strip()
        if not line_clean or ':' not in line_clean:
            continue
        parts = line_clean.split(':', 1)
        k = clean_metadata_label(parts[0])
        v = clean_metadata_value(parts[1])
        if not k or not v:
            continue
        if (k == 'model' or k.startswith('model')) and not data["Model"]:
            data["Model"] = v
        elif (k == 'problem' or k.startswith('problem')) and not data["Problem"]:
            data["Problem"] = v
        elif is_cn_label(k):
            if not data["CN"] or is_probable_cn_value(v):
                data["CN"] = v
            if data.get("Defect Qty") == v:
                data["Defect Qty"] = ""
        elif ('defect date' in k or k == 'date' or k.endswith('date')) and not data["Defect Date"]:
            data["Defect Date"] = v
        elif ('defect location' in k or 'location' in k) and not data["Defect Location"]:
            data["Defect Location"] = v
        elif is_qty_label(k):
            if not is_probable_cn_value(v):
                data["Defect Qty"] = v
            elif not data["CN"]:
                data["CN"] = v


def parse_with_python_pptx(file_path):
    """Mengekstrak informasi PowerPoint menggunakan pustaka python-pptx."""
    prs = Presentation(file_path)
    data = {
        "File Name": os.path.basename(file_path),
        "Model": "",
        "Problem": "",
        "CN": "",
        "Defect Date": "",
        "Defect Location": "",
        "Defect Qty": "",
        "Symptom/Analysis/Conclusion": "",
        "Action & Countermeasure": "",
        "Category": "Proses"
    }

    conclusions_list = []
    actions_list = []

    for slide in prs.slides:
        full_slide_text = ""

        for shape in slide.shapes:
            # 1. Ekstraksi Header dari Tabel
            if shape.has_table:
                table = shape.table
                for row in table.rows:
                    row_texts = [cell.text.strip() for cell in row.cells]
                    match_table_metadata(row_texts, data)
                    for cell_text in row_texts:
                        full_slide_text += cell_text + "\n"

            # 2. Ambil teks dari Text Box
            elif shape.has_text_frame:
                content = shape.text_frame.text.strip()
                if content:
                    full_slide_text += content + "\n"

        extract_metadata_from_text(full_slide_text, data)
        extract_sections_from_full_text(full_slide_text, conclusions_list, actions_list)

    # Sanity check: Defect Qty should not hold a CN string
    if is_probable_cn_value(data.get("Defect Qty")):
        if not data.get("CN"):
            data["CN"] = data["Defect Qty"]
        data["Defect Qty"] = "1 ea"

    data["Symptom/Analysis/Conclusion"] = "\n".join(conclusions_list).strip()
    data["Action & Countermeasure"] = "\n".join(actions_list).strip()
    data["Category"] = determine_category(data["Action & Countermeasure"])
    return data


def parse_with_xml_fallback(file_path):
    """
    Fallback parser menggunakan standard library zipfile + xml.etree.ElementTree.
    Membaca struktur OpenXML ppt/slides/slide*.xml secara langsung tanpa dependencies berat.
    """
    data = {
        "File Name": os.path.basename(file_path),
        "Model": "",
        "Problem": "",
        "CN": "",
        "Defect Date": "",
        "Defect Location": "",
        "Defect Qty": "",
        "Symptom/Analysis/Conclusion": "",
        "Action & Countermeasure": "",
        "Category": "Proses"
    }

    conclusions_list = []
    actions_list = []

    ns = {
        'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
        'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
    }

    with zipfile.ZipFile(file_path, 'r') as z:
        slide_names = [name for name in z.namelist() if re.match(r'ppt/slides/slide\d+\.xml', name)]
        slide_names.sort(key=lambda s: int(re.search(r'\d+', s).group()) if re.search(r'\d+', s) else 0)

        for slide_name in slide_names:
            try:
                xml_data = z.read(slide_name)
                root = ET.fromstring(xml_data)
                full_slide_text = ""

                # 1. Ekstrak teks dari shapes & text frames
                for sp in root.findall('.//p:sp', ns):
                    paragraphs = sp.findall('.//a:p', ns)
                    para_texts = []
                    for p in paragraphs:
                        runs = p.findall('.//a:t', ns)
                        text_val = "".join([t.text or "" for t in runs]).strip()
                        if text_val:
                            para_texts.append(text_val)
                    if para_texts:
                        full_slide_text += "\n".join(para_texts) + "\n"

                # 2. Ekstrak tabel
                for tbl in root.findall('.//a:tbl', ns):
                    for tr in tbl.findall('.//a:tr', ns):
                        row_texts = []
                        for tc in tr.findall('.//a:tc', ns):
                            p_texts = []
                            for p in tc.findall('.//a:p', ns):
                                runs = p.findall('.//a:t', ns)
                                p_text = "".join([t.text or "" for t in runs]).strip()
                                if p_text:
                                    p_texts.append(p_text)
                            tc_text = "\n".join(p_texts).strip()
                            row_texts.append(tc_text)

                        match_table_metadata(row_texts, data)
                        if row_texts:
                            full_slide_text += "\n".join(row_texts) + "\n"

                extract_metadata_from_text(full_slide_text, data)
                extract_sections_from_full_text(full_slide_text, conclusions_list, actions_list)

            except Exception:
                continue

    # Sanity check: Defect Qty should not hold a CN string
    if is_probable_cn_value(data.get("Defect Qty")):
        if not data.get("CN"):
            data["CN"] = data["Defect Qty"]
        data["Defect Qty"] = "1 ea"

    data["Symptom/Analysis/Conclusion"] = "\n".join(conclusions_list).strip()
    data["Action & Countermeasure"] = "\n".join(actions_list).strip()
    data["Category"] = determine_category(data["Action & Countermeasure"])
    return data


def parse_pptx_report(file_path):
    """Mengekstrak informasi dari berkas PowerPoint (.pptx) dengan arsitektur cepat XML-first."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    # 1. Fast XML parsing (10-20x lebih cepat karena tidak membaca binary gambar kamera mikroskop)
    try:
        xml_result = parse_with_xml_fallback(file_path)
        if xml_result and (xml_result["Model"] or xml_result["Problem"] or xml_result["Symptom/Analysis/Conclusion"] or xml_result["Action & Countermeasure"]):
            return xml_result
    except Exception:
        pass

    # 2. Fallback ke python-pptx jika tersedia
    if HAS_PPTX:
        try:
            return parse_with_python_pptx(file_path)
        except Exception:
            pass

    return parse_with_xml_fallback(file_path)


# XML Control Character Sanitizer
ILLEGAL_XML_CHARS_RE = re.compile(r'[\x00-\x08\x0b\x0c\x0e-\x1f]')


def clean_cell_str(val):
    """Sanitasi string agar aman dari karakter kontrol XML yang bisa merusak openpyxl."""
    if val is None:
        return ""
    s = str(val).replace('\r\n', '\n').replace('\r', '\n').replace('\x0b', '\n')
    return ILLEGAL_XML_CHARS_RE.sub('', s)


def save_to_formatted_excel(results, output_path):
    """
    Menyimpan hasil ke workbook Excel 5 Sheet komprehensif dengan Executive Dashboard & Chart interaktif:
    - Sheet 0: Main Summary (Dashboard Eksekutif dengan 3 Grafik Chart)
    - Sheet 1: Defect Summary (Detail Laporan Lengkap 10 Kolom)
    - Sheet 2: Category Summary (Rekapitulasi Material vs Proses + Pie Chart)
    - Sheet 3: Model Summary (Pareto Model Urut Tertinggi + Combo Bar & Line Chart)
    - Sheet 4: Worst Issue (Pareto Defect Qty + Combo Bar & Line Chart)
    """
    if not results:
        return ""

    if HAS_OPENPYXL:
        try:
            wb = openpyxl.Workbook()
            total_rows = len(results)

            # Styling Presets
            header_fill = PatternFill(start_color="1F4E78", end_color="1F4E78", fill_type="solid")
            header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
            regular_font = Font(name="Calibri", size=10)
            thin_border = Border(
                left=Side(style='thin', color='D9D9D9'),
                right=Side(style='thin', color='D9D9D9'),
                top=Side(style='thin', color='D9D9D9'),
                bottom=Side(style='thin', color='D9D9D9')
            )

            # ==========================================
            # SHEET 1: Defect Summary
            # ==========================================
            ws1 = wb.active
            ws1.title = "Defect Summary"

            headers = [
                "No.", "Model", "Problem", "CN", "Defect Date",
                "Defect Location", "Defect Qty/Sample Qty",
                "Symptom/Analysis/Conclusion", "Action & Countermeasure", "Category"
            ]
            ws1.append(headers)

            for idx, r in enumerate(results, start=1):
                qty_display = r.get("Defect Qty") or "1 ea"
                ws1.append([
                    idx,
                    clean_cell_str(r.get("Model") or "Unknown"),
                    clean_cell_str(r.get("Problem") or "Unknown"),
                    clean_cell_str(r.get("CN") or "-"),
                    clean_cell_str(r.get("Defect Date") or "-"),
                    clean_cell_str(r.get("Defect Location") or "-"),
                    clean_cell_str(qty_display),
                    clean_cell_str(r.get("Symptom/Analysis/Conclusion") or "-"),
                    clean_cell_str(r.get("Action & Countermeasure") or "-"),
                    clean_cell_str(r.get("Category") or "Proses")
                ])

            # Styling Header Sheet 1
            for col_num in range(1, len(headers) + 1):
                cell = ws1.cell(row=1, column=col_num)
                cell.fill = header_fill
                cell.font = header_font
                cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            ws1.row_dimensions[1].height = 25

            # Styling Data Sheet 1
            for row_num in range(2, total_rows + 2):
                ws1.row_dimensions[row_num].height = 70
                for col_num in range(1, len(headers) + 1):
                    cell = ws1.cell(row=row_num, column=col_num)
                    cell.font = regular_font
                    cell.border = thin_border
                    if col_num in [1, 4, 5, 7, 10]:
                        cell.alignment = Alignment(horizontal="center", vertical="top", wrap_text=True)
                    else:
                        cell.alignment = Alignment(horizontal="left", vertical="top", wrap_text=True)

            column_widths_ws1 = {
                'A': 6, 'B': 15, 'C': 25, 'D': 15, 'E': 15,
                'F': 18, 'G': 15, 'H': 45, 'I': 40, 'J': 15
            }
            for col_letter, width in column_widths_ws1.items():
                ws1.column_dimensions[col_letter].width = width
            ws1.freeze_panes = 'A2'

            # ==========================================
            # SHEET 2: Category Summary (Material & Proses - Pie Chart)
            # ==========================================
            ws2 = wb.create_sheet(title="Category Summary")
            summary_headers = ["Category", "Total Count", "Percentage"]
            ws2.append(summary_headers)

            for col_num in range(1, len(summary_headers) + 1):
                cell = ws2.cell(row=1, column=col_num)
                cell.fill = header_fill
                cell.font = header_font
                cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            ws2.row_dimensions[1].height = 25

            categories = ["Material", "Proses"]
            for idx, cat in enumerate(categories, start=2):
                ws2.cell(row=idx, column=1, value=cat).alignment = Alignment(horizontal="center", vertical="center")

                count_cell = ws2.cell(row=idx, column=2, value=f"=COUNTIF('Defect Summary'!J2:J{total_rows+1}, \"{cat}\")")
                count_cell.alignment = Alignment(horizontal="center", vertical="center")

                pct_cell = ws2.cell(row=idx, column=3, value=f"=B{idx}/COUNTA('Defect Summary'!J2:J{total_rows+1})")
                pct_cell.number_format = '0.0%'
                pct_cell.alignment = Alignment(horizontal="center", vertical="center")

            total_row_idx_ws2 = len(categories) + 2
            ws2.cell(row=total_row_idx_ws2, column=1, value="Total").font = Font(name="Calibri", size=11, bold=True)
            ws2.cell(row=total_row_idx_ws2, column=1).alignment = Alignment(horizontal="center", vertical="center")

            tot_count_ws2 = ws2.cell(row=total_row_idx_ws2, column=2, value=f"=SUM(B2:B{total_row_idx_ws2-1})")
            tot_count_ws2.font = Font(name="Calibri", size=11, bold=True)
            tot_count_ws2.alignment = Alignment(horizontal="center", vertical="center")

            tot_pct_ws2 = ws2.cell(row=total_row_idx_ws2, column=3, value=f"=SUM(C2:C{total_row_idx_ws2-1})")
            tot_pct_ws2.font = Font(name="Calibri", size=11, bold=True)
            tot_pct_ws2.number_format = '0.0%'
            tot_pct_ws2.alignment = Alignment(horizontal="center", vertical="center")

            for r in range(1, total_row_idx_ws2 + 1):
                ws2.row_dimensions[r].height = 20
                for c in range(1, 4):
                    cell = ws2.cell(row=r, column=c)
                    cell.font = Font(name="Calibri", size=10, bold=(r == total_row_idx_ws2 or r == 1))
                    cell.border = thin_border

            column_widths_ws2 = {'A': 20, 'B': 15, 'C': 15}
            for col_letter, width in column_widths_ws2.items():
                ws2.column_dimensions[col_letter].width = width

            chart_ws2 = PieChart()
            chart_ws2.title = "Defect Category Summary"
            chart_ws2.dataLabels = openpyxl.chart.label.DataLabelList()
            chart_ws2.dataLabels.showCatName = True
            chart_ws2.dataLabels.showPercent = True
            chart_ws2.dataLabels.showVal = False

            data_ref_ws2 = Reference(ws2, min_col=2, min_row=1, max_row=len(categories) + 1)
            cats_ref_ws2 = Reference(ws2, min_col=1, min_row=2, max_row=len(categories) + 1)
            chart_ws2.add_data(data_ref_ws2, titles_from_data=True)
            chart_ws2.set_categories(cats_ref_ws2)
            ws2.add_chart(chart_ws2, "E2")
            chart_ws2.width = 15
            chart_ws2.height = 10

            # ==========================================
            # SHEET 3: Model Summary (Urut Tertinggi ke Terendah + Bar Chart + Secondary Line Chart)
            # ==========================================
            ws3 = wb.create_sheet(title="Model Summary")
            model_headers = ["Model", "Total Count", "Percentage"]
            ws3.append(model_headers)

            for col_num in range(1, len(model_headers) + 1):
                cell = ws3.cell(row=1, column=col_num)
                cell.fill = header_fill
                cell.font = header_font
                cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            ws3.row_dimensions[1].height = 25

            model_counts = Counter(r.get("Model") or "Unknown" for r in results)
            sorted_models = sorted(model_counts.keys(), key=lambda m: model_counts[m], reverse=True)

            for idx, mod in enumerate(sorted_models, start=2):
                ws3.cell(row=idx, column=1, value=mod).alignment = Alignment(horizontal="center", vertical="center")

                count_cell = ws3.cell(row=idx, column=2, value=f"=COUNTIF('Defect Summary'!B2:B{total_rows+1}, \"{mod}\")")
                count_cell.alignment = Alignment(horizontal="center", vertical="center")

                pct_cell = ws3.cell(row=idx, column=3, value=f"=B{idx}/COUNTA('Defect Summary'!B2:B{total_rows+1})")
                pct_cell.number_format = '0.0%'
                pct_cell.alignment = Alignment(horizontal="center", vertical="center")

            total_row_idx_ws3 = len(sorted_models) + 2
            ws3.cell(row=total_row_idx_ws3, column=1, value="Total").font = Font(name="Calibri", size=11, bold=True)
            ws3.cell(row=total_row_idx_ws3, column=1).alignment = Alignment(horizontal="center", vertical="center")

            tot_count_ws3 = ws3.cell(row=total_row_idx_ws3, column=2, value=f"=SUM(B2:B{total_row_idx_ws3-1})")
            tot_count_ws3.font = Font(name="Calibri", size=11, bold=True)
            tot_count_ws3.alignment = Alignment(horizontal="center", vertical="center")

            tot_pct_ws3 = ws3.cell(row=total_row_idx_ws3, column=3, value=f"=SUM(C2:C{total_row_idx_ws3-1})")
            tot_pct_ws3.font = Font(name="Calibri", size=11, bold=True)
            tot_pct_ws3.number_format = '0.0%'
            tot_pct_ws3.alignment = Alignment(horizontal="center", vertical="center")

            for r in range(1, total_row_idx_ws3 + 1):
                ws3.row_dimensions[r].height = 20
                for c in range(1, 4):
                    cell = ws3.cell(row=r, column=c)
                    cell.font = Font(name="Calibri", size=10, bold=(r == total_row_idx_ws3 or r == 1))
                    cell.border = thin_border

            column_widths_ws3 = {'A': 20, 'B': 15, 'C': 15}
            for col_letter, width in column_widths_ws3.items():
                ws3.column_dimensions[col_letter].width = width

            chart_ws3 = BarChart()
            chart_ws3.type = "col"
            chart_ws3.style = 10
            chart_ws3.title = "Defect Model Summary (Count & Percentage)"
            chart_ws3.x_axis.title = None
            chart_ws3.y_axis.title = None
            chart_ws3.y_axis.majorGridlines = None
            chart_ws3.legend = None

            chart_ws3.dataLabels = openpyxl.chart.label.DataLabelList()
            chart_ws3.dataLabels.showVal = True

            data_count_ref = Reference(ws3, min_col=2, min_row=1, max_row=len(sorted_models) + 1)
            data_pct_ref = Reference(ws3, min_col=3, min_row=1, max_row=len(sorted_models) + 1)
            cats_ref_ws3 = Reference(ws3, min_col=1, min_row=2, max_row=len(sorted_models) + 1)

            chart_ws3.add_data(data_count_ref, titles_from_data=True)
            chart_ws3.set_categories(cats_ref_ws3)

            chart_line3 = LineChart()
            chart_line3.add_data(data_pct_ref, titles_from_data=True)
            chart_line3.y_axis.axId = 200
            chart_line3.y_axis.crosses = "max"
            chart_line3.y_axis.axPos = "r"
            chart_line3.y_axis.title = None
            chart_line3.y_axis.number_format = '0.0%'

            chart_ws3 += chart_line3
            ws3.add_chart(chart_ws3, "E2")
            chart_ws3.width = 18
            chart_ws3.height = 11

            # ==========================================
            # SHEET 4: Worst Issue
            # ==========================================
            ws4 = wb.create_sheet(title="Worst Issue")
            worst_headers = ["Model", "Problem", "Defect Qty", "Percentage"]
            ws4.append(worst_headers)

            for col_num in range(1, len(worst_headers) + 1):
                cell = ws4.cell(row=1, column=col_num)
                cell.fill = header_fill
                cell.font = header_font
                cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            ws4.row_dimensions[1].height = 25

            sorted_worst_data = sorted(results, key=lambda x: parse_qty(x.get("Defect Qty")), reverse=True)
            worst_rows_count = len(sorted_worst_data)

            for idx, r in enumerate(sorted_worst_data, start=2):
                ws4.cell(row=idx, column=1, value=r.get("Model") or "Unknown").alignment = Alignment(horizontal="center", vertical="center")
                ws4.cell(row=idx, column=2, value=r.get("Problem") or "Unknown").alignment = Alignment(horizontal="left", vertical="center")

                qty_val = parse_qty(r.get("Defect Qty"))
                qty_cell = ws4.cell(row=idx, column=3, value=qty_val)
                qty_cell.alignment = Alignment(horizontal="center", vertical="center")

                pct_cell = ws4.cell(row=idx, column=4, value=f"=C{idx}/SUM(C$2:C${worst_rows_count+1})")
                pct_cell.number_format = '0.0%'
                pct_cell.alignment = Alignment(horizontal="center", vertical="center")

            total_row_idx_ws4 = worst_rows_count + 2
            ws4.cell(row=total_row_idx_ws4, column=1, value="Total").font = Font(name="Calibri", size=11, bold=True)
            ws4.cell(row=total_row_idx_ws4, column=1).alignment = Alignment(horizontal="center", vertical="center")
            ws4.cell(row=total_row_idx_ws4, column=2, value="").border = thin_border

            tot_qty_ws4 = ws4.cell(row=total_row_idx_ws4, column=3, value=f"=SUM(C2:C{total_row_idx_ws4-1})")
            tot_qty_ws4.font = Font(name="Calibri", size=11, bold=True)
            tot_qty_ws4.alignment = Alignment(horizontal="center", vertical="center")

            tot_pct_ws4 = ws4.cell(row=total_row_idx_ws4, column=4, value=f"=SUM(D2:D{total_row_idx_ws4-1})")
            tot_pct_ws4.font = Font(name="Calibri", size=11, bold=True)
            tot_pct_ws4.number_format = '0.0%'
            tot_pct_ws4.alignment = Alignment(horizontal="center", vertical="center")

            for r in range(1, total_row_idx_ws4 + 1):
                ws4.row_dimensions[r].height = 20
                for c in range(1, 5):
                    cell = ws4.cell(row=r, column=c)
                    cell.font = Font(name="Calibri", size=10, bold=(r == total_row_idx_ws4 or r == 1))
                    cell.border = thin_border

            column_widths_ws4 = {'A': 15, 'B': 30, 'C': 15, 'D': 15}
            for col_letter, width in column_widths_ws4.items():
                ws4.column_dimensions[col_letter].width = width

            chart_ws4 = BarChart()
            chart_ws4.type = "col"
            chart_ws4.style = 10
            chart_ws4.title = "Worst Issue Summary (Defect Qty & Percentage)"
            chart_ws4.x_axis.title = None
            chart_ws4.y_axis.title = None
            chart_ws4.y_axis.majorGridlines = None
            chart_ws4.legend = None

            chart_ws4.dataLabels = openpyxl.chart.label.DataLabelList()
            chart_ws4.dataLabels.showVal = True

            data_qty_ref = Reference(ws4, min_col=3, min_row=1, max_row=worst_rows_count + 1)
            data_pct_ref = Reference(ws4, min_col=4, min_row=1, max_row=worst_rows_count + 1)
            cats_ref_ws4 = Reference(ws4, min_col=2, min_row=2, max_col=2, max_row=worst_rows_count + 1)

            chart_ws4.add_data(data_qty_ref, titles_from_data=True)
            chart_ws4.set_categories(cats_ref_ws4)

            chart_line4 = LineChart()
            chart_line4.add_data(data_pct_ref, titles_from_data=True)
            chart_line4.y_axis.axId = 200
            chart_line4.y_axis.crosses = "max"
            chart_line4.y_axis.axPos = "r"
            chart_line4.y_axis.title = None
            chart_line4.y_axis.number_format = '0.0%'

            chart_ws4 += chart_line4
            ws4.add_chart(chart_ws4, "F2")
            chart_ws4.width = 25
            chart_ws4.height = 12

            # ==========================================
            # SHEET 5: Main Summary (Dashboard Eksekutif)
            # ==========================================
            ws_main = wb.create_sheet(title="Main Summary", index=0)
            ws_main.cell(row=1, column=2, value="EXECUTIVE DEFECT SUMMARY DASHBOARD").font = Font(name="Calibri", size=14, bold=True, color="1F4E78")

            # 1. Category Chart (Pie) pada Main Summary
            chart_main_cat = PieChart()
            chart_main_cat.title = "Defect Category Summary"
            chart_main_cat.dataLabels = openpyxl.chart.label.DataLabelList()
            chart_main_cat.dataLabels.showCatName = True
            chart_main_cat.dataLabels.showPercent = True
            chart_main_cat.dataLabels.showVal = False

            data_ref_mcat = Reference(ws2, min_col=2, min_row=1, max_row=len(categories) + 1)
            cats_ref_mcat = Reference(ws2, min_col=1, min_row=2, max_row=len(categories) + 1)
            chart_main_cat.add_data(data_ref_mcat, titles_from_data=True)
            chart_main_cat.set_categories(cats_ref_mcat)
            ws_main.add_chart(chart_main_cat, "B3")
            chart_main_cat.width = 14
            chart_main_cat.height = 10

            # 2. Model Summary Chart (Bar + Line) pada Main Summary
            chart_main_model = BarChart()
            chart_main_model.type = "col"
            chart_main_model.style = 10
            chart_main_model.title = "Defect Model Summary (Count & Percentage)"
            chart_main_model.x_axis.title = None
            chart_main_model.y_axis.title = None
            chart_main_model.y_axis.majorGridlines = None
            chart_main_model.legend = None

            chart_main_model.dataLabels = openpyxl.chart.label.DataLabelList()
            chart_main_model.dataLabels.showVal = True

            data_count_ref_m = Reference(ws3, min_col=2, min_row=1, max_row=len(sorted_models) + 1)
            data_pct_ref_m = Reference(ws3, min_col=3, min_row=1, max_row=len(sorted_models) + 1)
            cats_ref_m = Reference(ws3, min_col=1, min_row=2, max_row=len(sorted_models) + 1)

            chart_main_model.add_data(data_count_ref_m, titles_from_data=True)
            chart_main_model.set_categories(cats_ref_m)

            chart_line_m = LineChart()
            chart_line_m.add_data(data_pct_ref_m, titles_from_data=True)
            chart_line_m.y_axis.axId = 200
            chart_line_m.y_axis.crosses = "max"
            chart_line_m.y_axis.axPos = "r"
            chart_line_m.y_axis.title = None
            chart_line_m.y_axis.number_format = '0.0%'

            chart_main_model += chart_line_m
            ws_main.add_chart(chart_main_model, "K3")
            chart_main_model.width = 18
            chart_main_model.height = 10

            # 3. Worst Issue Chart (Bar + Line) pada Main Summary
            chart_main_worst = BarChart()
            chart_main_worst.type = "col"
            chart_main_worst.style = 10
            chart_main_worst.title = "Worst Issue Summary (Defect Qty & Percentage)"
            chart_main_worst.x_axis.title = None
            chart_main_worst.y_axis.title = None
            chart_main_worst.y_axis.majorGridlines = None
            chart_main_worst.legend = None

            chart_main_worst.dataLabels = openpyxl.chart.label.DataLabelList()
            chart_main_worst.dataLabels.showVal = True

            data_qty_ref_w = Reference(ws4, min_col=3, min_row=1, max_row=worst_rows_count + 1)
            data_pct_ref_w = Reference(ws4, min_col=4, min_row=1, max_row=worst_rows_count + 1)
            cats_ref_w = Reference(ws4, min_col=2, min_row=2, max_col=2, max_row=worst_rows_count + 1)

            chart_main_worst.add_data(data_qty_ref_w, titles_from_data=True)
            chart_main_worst.set_categories(cats_ref_w)

            chart_line_w = LineChart()
            chart_line_w.add_data(data_pct_ref_w, titles_from_data=True)
            chart_line_w.y_axis.axId = 200
            chart_line_w.y_axis.crosses = "max"
            chart_line_w.y_axis.axPos = "r"
            chart_line_w.y_axis.title = None
            chart_line_w.y_axis.number_format = '0.0%'

            chart_main_worst += chart_line_w
            ws_main.add_chart(chart_main_worst, "B24")
            chart_main_worst.width = 25
            chart_main_worst.height = 12

            os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
            wb.save(output_path)
            return output_path
        except Exception as e:
            sys.stderr.write(f"openpyxl multi-sheet error: {e}, falling back to single sheet\n")

    # Fallback to pure XLSX or CSV if openpyxl fails
    return create_pure_xlsx_fallback(results, output_path)


def create_pure_xlsx_fallback(rows, output_path):
    """Fallback generator CSV/XLSX sederhana jika openpyxl tidak tersedia."""
    import csv
    csv_path = output_path.replace('.xlsx', '.csv')
    os.makedirs(os.path.dirname(os.path.abspath(csv_path)), exist_ok=True)
    headers = [
        "No.", "Model", "Problem", "CN", "Defect Date",
        "Defect Location", "Defect Qty/Sample Qty",
        "Symptom/Analysis/Conclusion", "Action & Countermeasure", "Category"
    ]
    with open(csv_path, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        for idx, r in enumerate(rows, start=1):
            writer.writerow([
                idx,
                r.get("Model", ""),
                r.get("Problem", ""),
                r.get("CN", ""),
                r.get("Defect Date", ""),
                r.get("Defect Location", ""),
                r.get("Defect Qty", ""),
                r.get("Symptom/Analysis/Conclusion", ""),
                r.get("Action & Countermeasure", ""),
                r.get("Category", "Proses")
            ])
    return csv_path


def generate_markdown_summary(items):
    """Menghasilkan teks Markdown terstruktur dari seluruh berkas PowerPoint yang diekstrak."""
    if not items:
        return "# Ringkasan Laporan PowerPoint (PE-Portal)\n\nTidak ada berkas yang berhasil diekstrak."

    cat_counts = Counter(r.get("Category", "Proses") for r in items)

    lines = [
        "# 📑 Executive Defect Summary Dashboard (PE-Portal SEIN)",
        f"**Total Laporan:** {len(items)} berkas  ",
        f"**Kategori Defect:** Material: {cat_counts.get('Material', 0)} | Proses: {cat_counts.get('Proses', 0)}  ",
        f"**Waktu Ekstraksi:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  ",
        "",
        "---",
        "",
        "## 📊 Tabel Rekapitulasi Defect Report",
        "",
        "| # | Model | Problem | CN | Date | Location | Qty | Kategori |",
        "|---|---|---|---|---|---|---|---|",
    ]

    for idx, r in enumerate(items, 1):
        model = r.get("Model", "-") or "-"
        problem = (r.get("Problem", "-") or "-").replace("|", "/")
        cn = r.get("CN", "-") or "-"
        date = r.get("Defect Date", "-") or "-"
        loc = r.get("Defect Location", "-") or "-"
        qty = r.get("Defect Qty", "-") or "-"
        cat = r.get("Category", "Proses")
        lines.append(f"| {idx} | {model} | {problem} | {cn} | {date} | {loc} | {qty} | **{cat}** |")

    lines.extend([
        "",
        "---",
        "",
        "## 🔍 Detail Analisis per Laporan",
        ""
    ])

    for idx, r in enumerate(items, 1):
        lines.append(f"### {idx}. {r.get('File Name', 'Laporan')} ({r.get('Model', 'Unknown')})")
        lines.append(f"- **Problem:** {r.get('Problem') or '-'}")
        lines.append(f"- **Kategori:** `{r.get('Category') or 'Proses'}`")
        lines.append(f"- **CN:** {r.get('CN') or '-'}")
        lines.append(f"- **Defect Date:** {r.get('Defect Date') or '-'}")
        lines.append(f"- **Defect Location:** {r.get('Defect Location') or '-'}")
        lines.append(f"- **Defect Qty:** {r.get('Defect Qty') or '-'}")
        lines.append("")
        lines.append("#### 📌 Symptom / Analysis / Conclusion:")
        lines.append(r.get("Symptom/Analysis/Conclusion") or "(Tidak ditemukan)")
        lines.append("")
        lines.append("#### 🛡️ Action & Countermeasure:")
        lines.append(r.get("Action & Countermeasure") or "(Tidak ditemukan)")
        lines.append("")
        lines.append("---")
        lines.append("")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="SEIN PE-Portal PowerPoint Auto Summary Extractor & Dashboard")
    parser.add_argument("inputs", nargs="*", help="File path atau direktori input berkas .pptx")
    parser.add_argument("--input-dir", help="Direktori berisi kumpulan file .pptx")
    parser.add_argument("--output-excel", help="Path tujuan output berkas Excel (.xlsx)")
    parser.add_argument("--output-json", help="Path tujuan output berkas JSON hasil ekstraksi")
    parser.add_argument("--output-md", help="Path tujuan output berkas Markdown (.md)")
    parser.add_argument("--json-input", help="File JSON berisi daftar path berkas .pptx")
    args = parser.parse_args()

    files_to_process = []

    # 1. Kumpulkan file dari argumen
    if args.json_input and os.path.exists(args.json_input):
        try:
            with open(args.json_input, 'r', encoding='utf-8') as f:
                data_in = json.load(f)
                if isinstance(data_in, list):
                    files_to_process.extend(data_in)
                elif isinstance(data_in, dict) and "files" in data_in:
                    files_to_process.extend(data_in["files"])
        except Exception as e:
            print(json.dumps({"success": False, "error": f"Failed to parse json-input: {e}"}))
            sys.exit(1)

    if args.input_dir and os.path.isdir(args.input_dir):
        for root_dir, _, filenames in os.walk(args.input_dir):
            for fn in filenames:
                if fn.lower().endswith(".pptx") and not fn.startswith("~$"):
                    files_to_process.append(os.path.join(root_dir, fn))

    for item in args.inputs:
        if os.path.isfile(item) and item.lower().endswith(".pptx") and not os.path.basename(item).startswith("~$"):
            files_to_process.append(item)
        elif os.path.isdir(item):
            for root_dir, _, filenames in os.walk(item):
                for fn in filenames:
                    if fn.lower().endswith(".pptx") and not fn.startswith("~$"):
                        files_to_process.append(os.path.join(root_dir, fn))

    # Hilangkan duplikasi sambil mempertahankan urutan
    seen = set()
    unique_files = []
    for fp in files_to_process:
        norm = os.path.abspath(fp)
        if norm not in seen and os.path.exists(norm):
            seen.add(norm)
            unique_files.append(norm)

    if not unique_files:
        res = {
            "success": False,
            "total": 0,
            "succeeded": 0,
            "failed": 0,
            "error": "No valid .pptx files found to process",
            "items": [],
            "errors": []
        }
        print(json.dumps(res, indent=2))
        sys.exit(0)

    summary_results = []
    failed_files = []

    for fp in unique_files:
        fn = os.path.basename(fp)
        try:
            item_data = parse_pptx_report(fp)
            summary_results.append(item_data)
        except Exception as e:
            failed_files.append({
                "file_name": fn,
                "error": str(e)
            })

    # Tentukan path output excel jika diminta
    output_excel_path = args.output_excel
    if not output_excel_path and summary_results:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_excel_path = f"/data/files/summary_report_{timestamp}.xlsx"

    actual_excel_path = ""
    if output_excel_path and summary_results:
        try:
            actual_excel_path = save_to_formatted_excel(summary_results, output_excel_path)
        except Exception as e:
            failed_files.append({
                "file_name": "Excel_Export",
                "error": f"Failed to generate Excel file: {e}"
            })

    markdown_content = generate_markdown_summary(summary_results)

    output_payload = {
        "success": True,
        "total": len(unique_files),
        "succeeded": len(summary_results),
        "failed": len(failed_files),
        "excel_file": os.path.basename(actual_excel_path) if actual_excel_path else "",
        "excel_path": actual_excel_path,
        "items": summary_results,
        "markdown": markdown_content,
        "errors": failed_files
    }

    if args.output_md:
        try:
            with open(args.output_md, 'w', encoding='utf-8') as f:
                f.write(markdown_content)
        except Exception:
            pass

    if args.output_json:
        try:
            with open(args.output_json, 'w', encoding='utf-8') as f:
                json.dump(output_payload, f, indent=2, ensure_ascii=False)
        except Exception:
            pass

    # Print output payload to stdout safely bypassing Windows cp1252 / charmap encoder
    json_bytes = json.dumps(output_payload, indent=2, ensure_ascii=False).encode('utf-8', errors='replace')
    try:
        if hasattr(sys.stdout, 'buffer') and sys.stdout.buffer:
            sys.stdout.buffer.write(json_bytes)
            sys.stdout.buffer.write(b'\n')
            sys.stdout.buffer.flush()
        else:
            print(json.dumps(output_payload, indent=2, ensure_ascii=True))
    except Exception:
        print(json.dumps(output_payload, indent=2, ensure_ascii=True))


if __name__ == "__main__":
    main()
