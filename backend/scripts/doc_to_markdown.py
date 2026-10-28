#!/usr/bin/env python3
"""
doc_to_markdown.py
Universal Document to Structured Markdown Extractor for SEIN PE-Portal.
Extracts structured Markdown from PDF, PPTX, XLSX, CSV, DOCX, TXT, and JSON files.

Features:
- Lenient NASCA/Fasoo DRM PDF extraction using pypdf.
- Pure Python standard library (zipfile + xml.etree.ElementTree) for PPTX and DOCX (zero extra dependencies).
- openpyxl integration for multi-sheet Excel workbooks formatted as Markdown tables.
- Robust character encoding detection (UTF-8, CP1252, Latin-1).
- Outputs JSON with full markdown, page count, and estimated word count.
"""

import sys
import os
import io
import re
import json
import argparse
import zipfile
import xml.etree.ElementTree as ET
import warnings

warnings.filterwarnings("ignore")

# Ensure stdout uses UTF-8
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

def detect_drm_signature(file_path):
    signatures = [b"FASOO", b"FSD_DRM", b"NASCA", b"SoftCamp", b"SAMSUNG_DRM", b"DRMSecurity"]
    try:
        with open(file_path, "rb") as f:
            chunk_head = f.read(4096)
            f.seek(max(0, os.path.getsize(file_path) - 4096))
            chunk_tail = f.read(4096)
            for sig in signatures:
                if sig in chunk_head or sig in chunk_tail:
                    return True
    except Exception:
        pass
    return False

def extract_pdf_markdown(file_path, title):
    import pypdf
    drm_detected = detect_drm_signature(file_path)

    try:
        with open(file_path, "rb") as f:
            stream = io.BytesIO(f.read())
        reader = pypdf.PdfReader(stream, strict=False)
    except Exception:
        reader = pypdf.PdfReader(file_path, strict=False)

    if reader.is_encrypted:
        try:
            reader.decrypt("")
        except Exception:
            try:
                reader.decrypt(b"")
            except Exception:
                try:
                    reader.decrypt(" ")
                except Exception:
                    pass

    total_pages = len(reader.pages)
    md_lines = []
    md_lines.append(f"# 📄 {title}\n")
    md_lines.append(f"> **Format**: PDF Document | **Total Halaman**: {total_pages} Hal | **Keamanan**: {'Terenkripsi NASCA Corporate (Bypassed)' if drm_detected else 'Standar'}\n")
    md_lines.append("---\n")

    for idx, page in enumerate(reader.pages):
        page_num = idx + 1
        md_lines.append(f"## 📑 Halaman {page_num}\n")
        try:
            raw_text = page.extract_text() or ""
        except Exception as e:
            raw_text = f"(Teks halaman tidak dapat diekstrak: {e})"

        lines = raw_text.split("\n")
        in_table_buffer = []

        def flush_table_buffer():
            nonlocal in_table_buffer
            if in_table_buffer:
                for t_line in in_table_buffer:
                    md_lines.append(t_line + "\n")
                in_table_buffer = []

        for line in lines:
            line_str = line.strip()
            if not line_str:
                continue

            # Heading candidate: short, uppercase
            if line_str.isupper() and 3 < len(line_str) < 60:
                flush_table_buffer()
                md_lines.append(f"### {line_str}\n")
            # Step or bullet candidate
            elif re.match(r"^(Step\s*\d+|Langkah\s*\d+|\d+\.)", line_str, re.IGNORECASE):
                flush_table_buffer()
                md_lines.append(f"\n**{line_str}**\n")
            elif line_str.startswith(("-", "*", "•", "–")):
                flush_table_buffer()
                clean_bullet = re.sub(r"^[-*•–]\s*", "", line_str)
                md_lines.append(f"- {clean_bullet}\n")
            # Pipe-separated table detection
            elif line_str.count("|") >= 2:
                in_table_buffer.append(line_str)
            else:
                flush_table_buffer()
                md_lines.append(f"{line_str}\n")

        flush_table_buffer()
        md_lines.append("\n---\n")

    full_md = "".join(md_lines)
    words = len(re.findall(r"\w+", full_md))
    return full_md, total_pages, words

def extract_pptx_markdown(file_path, title):
    """Extracts slides, titles, bullet points, and tables from PPTX using zipfile + XML."""
    md_lines = []
    md_lines.append(f"# 🖥️ {title}\n")
    md_lines.append(f"> **Format**: PowerPoint Presentation (.pptx)\n")
    md_lines.append("---\n")

    slide_count = 0
    with zipfile.ZipFile(file_path, "r") as z:
        # Find slide xml files
        slide_entries = [
            f for f in z.namelist()
            if f.startswith("ppt/slides/slide") and f.endswith(".xml")
        ]
        # Sort slides numerically: slide1.xml, slide2.xml...
        def slide_key(name):
            m = re.search(r"slide(\d+)\.xml", name)
            return int(m.group(1)) if m else 999999
        slide_entries.sort(key=slide_key)
        slide_count = len(slide_entries)

        ns = {
            "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
            "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
        }

        for idx, entry in enumerate(slide_entries):
            slide_num = idx + 1
            md_lines.append(f"## 🎞️ Slide {slide_num}\n")
            try:
                xml_data = z.read(entry)
                root = ET.fromstring(xml_data)

                # Extract slide title
                slide_title = ""
                title_elem = root.find(".//p:sp[p:nvSpPr/p:nvPr/p:ph[@type='title']]", ns)
                if title_elem is None:
                    title_elem = root.find(".//p:sp[p:nvSpPr/p:nvPr/p:ph[@type='ctrTitle']]", ns)
                if title_elem is not None:
                    texts = [t.text for t in title_elem.findall(".//a:t", ns) if t.text]
                    slide_title = " ".join(texts).strip()

                if slide_title:
                    md_lines.append(f"### {slide_title}\n\n")

                # Extract tables
                for tbl in root.findall(".//a:tbl", ns):
                    rows = tbl.findall("a:tr", ns)
                    if rows:
                        table_rows = []
                        for tr in rows:
                            row_cells = []
                            for tc in tr.findall("a:tc", ns):
                                cell_texts = [t.text for t in tc.findall(".//a:t", ns) if t.text]
                                row_cells.append(" ".join(cell_texts).strip().replace("\n", " "))
                            table_rows.append(row_cells)

                        if table_rows:
                            col_count = max(len(r) for r in table_rows)
                            header = table_rows[0] + [""] * (col_count - len(table_rows[0]))
                            md_lines.append("| " + " | ".join(header) + " |\n")
                            md_lines.append("| " + " | ".join([":---"] * col_count) + " |\n")
                            for r in table_rows[1:]:
                                padded = r + [""] * (col_count - len(r))
                                md_lines.append("| " + " | ".join(padded) + " |\n")
                            md_lines.append("\n")

                # Extract general paragraphs & bullet points (excluding title shape)
                for sp in root.findall(".//p:sp", ns):
                    if sp == title_elem:
                        continue
                    paragraphs = sp.findall(".//a:p", ns)
                    for p in paragraphs:
                        runs = p.findall("a:r", ns)
                        p_texts = [r.find("a:t", ns).text for r in runs if r.find("a:t", ns) is not None and r.find("a:t", ns).text]
                        text = "".join(p_texts).strip()
                        if not text:
                            continue

                        # Check indent level
                        pPr = p.find("a:pPr", ns)
                        lvl = int(pPr.attrib.get("lvl", "0")) if pPr is not None else 0
                        indent = "  " * lvl
                        if text.startswith(("-", "*", "•", "–")):
                            clean_t = re.sub(r"^[-*•–]\s*", "", text)
                            md_lines.append(f"{indent}- {clean_t}\n")
                        else:
                            md_lines.append(f"{indent}- {text}\n")
            except Exception as e:
                md_lines.append(f"(Gagal mengekstrak konten slide: {e})\n")

            md_lines.append("\n---\n")

    full_md = "".join(md_lines)
    words = len(re.findall(r"\w+", full_md))
    return full_md, slide_count, words

def extract_xlsx_markdown(file_path, title):
    """Extracts Excel worksheets into clean Markdown tables using openpyxl."""
    import openpyxl

    md_lines = []
    md_lines.append(f"# 📊 {title}\n")
    md_lines.append(f"> **Format**: Excel Workbook (.xlsx)\n")
    md_lines.append("---\n")

    wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
    sheet_count = len(wb.sheetnames)

    for sheet_name in wb.sheetnames:
        md_lines.append(f"## 📋 Sheet: {sheet_name}\n\n")
        ws = wb[sheet_name]

        all_rows = []
        for row in ws.iter_rows(values_only=True):
            # Check if row has any non-empty cell
            cleaned_row = [str(c).strip().replace("\n", " ") if c is not None else "" for c in row]
            if any(cleaned_row):
                all_rows.append(cleaned_row)

        if not all_rows:
            md_lines.append("*(Sheet ini kosong)*\n\n")
            continue

        col_count = max(len(r) for r in all_rows)
        # Limit to 50 columns max for readability
        col_count = min(col_count, 50)

        header = all_rows[0][:col_count] + [""] * max(0, col_count - len(all_rows[0]))
        # Replace empty headers with Col N
        header = [h if h else f"Col {i+1}" for i, h in enumerate(header)]

        md_lines.append("| " + " | ".join(header) + " |\n")
        md_lines.append("| " + " | ".join([":---"] * col_count) + " |\n")

        # Max 200 rows per sheet in markdown preview to prevent DOM lag
        data_rows = all_rows[1:201]
        for r in data_rows:
            padded = r[:col_count] + [""] * max(0, col_count - len(r))
            md_lines.append("| " + " | ".join(padded) + " |\n")

        if len(all_rows) > 201:
            md_lines.append(f"\n*(... dan {len(all_rows) - 201} baris lainnya disembunyikan)*\n")

        md_lines.append("\n---\n")

    wb.close()
    full_md = "".join(md_lines)
    words = len(re.findall(r"\w+", full_md))
    return full_md, sheet_count, words

def extract_docx_markdown(file_path, title):
    """Extracts Word (.docx) paragraphs using zipfile + XML."""
    md_lines = []
    md_lines.append(f"# 📝 {title}\n")
    md_lines.append(f"> **Format**: Word Document (.docx)\n")
    md_lines.append("---\n")

    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    with zipfile.ZipFile(file_path, "r") as z:
        xml_data = z.read("word/document.xml")
        root = ET.fromstring(xml_data)

        for p in root.findall(".//w:p", ns):
            texts = [t.text for t in p.findall(".//w:t", ns) if t.text]
            line = "".join(texts).strip()
            if not line:
                continue

            # Check style
            pStyle = p.find(".//w:pStyle", ns)
            style_val = pStyle.attrib.get(f"{{{ns['w']}}}val", "") if pStyle is not None else ""
            if "Heading1" in style_val or "heading 1" in style_val:
                md_lines.append(f"\n## {line}\n\n")
            elif "Heading2" in style_val or "heading 2" in style_val:
                md_lines.append(f"\n### {line}\n\n")
            elif "Heading3" in style_val or "heading 3" in style_val:
                md_lines.append(f"\n#### {line}\n\n")
            elif line.startswith(("-", "*", "•", "–")):
                clean_bullet = re.sub(r"^[-*•–]\s*", "", line)
                md_lines.append(f"- {clean_bullet}\n")
            else:
                md_lines.append(f"{line}\n\n")

    full_md = "".join(md_lines)
    words = len(re.findall(r"\w+", full_md))
    return full_md, 1, words

def extract_text_markdown(file_path, title, ext):
    encodings = ["utf-8", "cp1252", "latin-1"]
    content = ""
    for enc in encodings:
        try:
            with open(file_path, "r", encoding=enc) as f:
                content = f.read()
            break
        except UnicodeDecodeError:
            continue

    if ext.lower() == ".json":
        try:
            parsed = json.loads(content)
            pretty = json.dumps(parsed, indent=2, ensure_ascii=False)
            content = f"```json\n{pretty}\n```"
        except Exception:
            content = f"```json\n{content}\n```"
    elif ext.lower() in [".csv"]:
        lines = content.splitlines()
        if lines:
            import csv
            reader = csv.reader(io.StringIO(content))
            table_md = []
            rows = list(reader)
            if rows:
                col_count = max(len(r) for r in rows)
                header = rows[0] + [""] * (col_count - len(rows[0]))
                table_md.append("| " + " | ".join(header) + " |")
                table_md.append("| " + " | ".join([":---"] * col_count) + " |")
                for r in rows[1:300]:
                    padded = r + [""] * (col_count - len(r))
                    table_md.append("| " + " | ".join(padded) + " |")
                content = "\n".join(table_md)

    md = f"# 📄 {title}\n\n" + content
    words = len(re.findall(r"\w+", md))
    return md, 1, words

def main():
    parser = argparse.ArgumentParser(description="Universal Document to Markdown Extractor")
    parser.add_argument("--input", required=True, help="Input document path")
    parser.add_argument("--output", default="", help="Optional output .md path")
    parser.add_argument("--title", default="", help="Document Title")
    parser.add_argument("--type", default="", help="File extension override")

    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(json.dumps({"success": False, "error": f"File not found: {args.input}"}))
        sys.exit(1)

    title = args.title or os.path.basename(args.input)
    ext = (args.type or os.path.splitext(args.input)[1]).lower()
    if not ext.startswith("."):
        ext = "." + ext

    try:
        if ext == ".pdf":
            md, pages, words = extract_pdf_markdown(args.input, title)
        elif ext in [".pptx", ".ppt"]:
            md, pages, words = extract_pptx_markdown(args.input, title)
        elif ext in [".xlsx", ".xls"]:
            md, pages, words = extract_xlsx_markdown(args.input, title)
        elif ext in [".docx", ".doc"]:
            md, pages, words = extract_docx_markdown(args.input, title)
        else:
            md, pages, words = extract_text_markdown(args.input, title, ext)

        if args.output:
            os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
            with open(args.output, "w", encoding="utf-8") as f_out:
                f_out.write(md)

        result = {
            "success": True,
            "title": title,
            "pages": pages,
            "word_count": words,
            "markdown": md,
        }
        print(json.dumps(result, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e),
            "markdown": f"# ⚠️ Gagal Mengekstrak Dokumen\n\nTerjadi kesalahan saat mengekstrak isi dokumen: `{str(e)}`",
            "pages": 0,
            "word_count": 0,
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()
