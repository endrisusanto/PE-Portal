#!/usr/bin/env python3
"""
pdf_wi_translator.py
Working Instruction (WI/SOP) PDF Auto-Translator
Translates technical Working Instruction PDFs (Samsung PE standard) from English to Indonesian (or Korean)
while preserving 100% of the original page layout, vector tables, and illustration photos.

Features:
- LENIENT NASCA & PDF reader handling (pypdf strict=False, decrypt empty pass).
- In-place overlay: masks original text with exact bounding boxes and renders translated text.
- Auto-scaling font logic to prevent cell/table border overflow.
- Dual translation engine: OpenAI-compatible LLM endpoint with intelligent Google translate fallback.
- Streaming line-by-line JSON progress for batch multi-page processing (e.g. 40+ pages).
"""

import sys
import os
import io
import re
import json
import time
import argparse
import urllib.request
import urllib.parse

import pypdf
from reportlab.pdfgen import canvas
import reportlab.lib.colors as colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Attempt to register Unicode TrueType font (DejaVuSans) if available in system
FONT_REGULAR = "Helvetica"
FONT_BOLD = "Helvetica-Bold"

DEJAVU_PATHS = [
    "/usr/share/fonts/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/TTF/DejaVuSans.ttf",
    "/usr/local/share/fonts/DejaVuSans.ttf",
]
DEJAVU_BOLD_PATHS = [
    "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
    "/usr/local/share/fonts/DejaVuSans-Bold.ttf",
]

for p in DEJAVU_PATHS:
    if os.path.exists(p):
        try:
            pdfmetrics.registerFont(TTFont("DejaVuSans", p))
            FONT_REGULAR = "DejaVuSans"
            break
        except Exception:
            pass

for p in DEJAVU_BOLD_PATHS:
    if os.path.exists(p):
        try:
            pdfmetrics.registerFont(TTFont("DejaVuSans-Bold", p))
            FONT_BOLD = "DejaVuSans-Bold"
            break
        except Exception:
            pass

# Quick technical glossary mapping for Samsung PE
TECHNICAL_GLOSSARY = {
    "CAUTION": "PERHATIAN",
    "Caution": "Perhatian",
    "caution": "perhatian",
    "WARNING": "PERINGATAN",
    "Warning": "Peringatan",
    "NOTICE": "PEMBERITAHUAN",
    "Notice": "Pemberitahuan",
    "NOTE": "CATATAN",
    "Note": "Catatan",
    "CHECK POINT": "POIN PEMERIKSAAN",
    "Check Point": "Poin Pemeriksaan",
    "Check point": "Poin pemeriksaan",
    "WORK INSTRUCTION": "INSTRUKSI KERJA",
    "Work Instruction": "Instruksi Kerja",
    "STANDARD": "STANDAR",
    "Standard": "Standar",
    "PASS": "LOLOS",
    "DEFECT": "CACAT",
    "Defect": "Cacat",
    "TIGHTEN": "KENCANGKAN",
    "Tighten": "Kencangkan",
    "LOOSEN": "KENDURKAN",
    "Loosen": "Kendurkan",
    "ASSEMBLE": "PASANG",
    "Assemble": "Pasang",
    "DISASSEMBLE": "BONGKAR",
    "Disassemble": "Bongkar",
}

def is_translatable(text):
    """Filter out pure numbers, dates, part numbers, or pure punctuation."""
    if not text:
        return False
    t = text.strip()
    if len(t) < 2:
        return False
    # Pure numbers or codes
    if re.match(r"^[\d\s.,:;/\-–—_#*+()<>\[\]%]+$", t):
        return False
    # Part numbers like GH98-12345A, SEC-001, etc.
    if re.match(r"^[A-Z0-9]{3,}-[A-Z0-9]{3,}$", t):
        return False
    # Only translate if there are letters
    if not re.search(r"[a-zA-Z]", t):
        return False
    return True

def translate_fallback(text, target_lang="id"):
    """Fast, reliable translation via Google Translate free GTX client."""
    text_clean = text.strip()
    if not text_clean:
        return text

    # Check immediate glossary match
    if text_clean in TECHNICAL_GLOSSARY and target_lang == "id":
        return TECHNICAL_GLOSSARY[text_clean]

    url = (
        f"https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl={target_lang}&dt=t&q="
        + urllib.parse.quote(text_clean)
    )
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            res = "".join([part[0] for part in data[0] if part[0]])
            return res if res else text
    except Exception:
        # If network error, return original text unchanged
        return text

def translate_with_llm(texts, target_lang="id", llm_url="", llm_model="", llm_key=""):
    """
    Translate a batch of texts using an OpenAI-compatible LLM endpoint.
    Returns a dictionary mapping {original_text: translated_text}.
    """
    if not llm_url or not texts:
        return {}

    lang_name = "Indonesian" if target_lang == "id" else ("Korean" if target_lang == "ko" else target_lang)
    system_prompt = (
        f"You are an expert technical translator specializing in Samsung Electronics Manufacturing and Production Engineering "
        f"(Working Instructions, SOP, JIG assembly, PBA, SMT, inspection). "
        f"Translate the following list of texts from English into {lang_name}. "
        f"CRITICAL RULES:\n"
        f"1. Preserve technical acronyms and part codes unchanged: PBA, Sub PBA, Main PBA, FPCB, JIG, SMT, M1.4*3.0, Torque, Connector, Tray, B2B, OIS, Barcode, ESD, etc.\n"
        f"2. Keep the translation concise, direct, and actionable matching standard manufacturing work instructions.\n"
        f"3. Return ONLY a valid JSON array of objects with 'id' (integer) and 'translated' (string). No markdown, no conversation."
    )

    items = [{"id": i, "text": t} for i, t in enumerate(texts)]
    endpoint = llm_url.rstrip("/") + "/chat/completions"

    payload = {
        "model": llm_model if llm_model else "gpt-3.5-turbo",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(items, ensure_ascii=False)},
        ],
        "temperature": 0.2,
        "max_tokens": 4096,
    }

    req_data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        endpoint,
        data=req_data,
        headers={"Content-Type": "application/json"},
    )
    if llm_key:
        req.add_header("Authorization", f"Bearer {llm_key}")

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            res_json = json.loads(resp.read().decode("utf-8"))
            content = res_json["choices"][0]["message"]["content"]
            # Extract JSON array
            m = re.search(r"\[\s*\{.*\}\s*\]", content, re.DOTALL)
            if m:
                arr = json.loads(m.group(0))
                mapping = {}
                for it in arr:
                    idx = it.get("id")
                    translated = it.get("translated")
                    if idx is not None and 0 <= idx < len(texts) and translated:
                        mapping[texts[idx]] = translated.strip()
                return mapping
    except Exception as e:
        sys.stderr.write(f"[WARN] LLM translation error: {e}. Falling back to web/glossary.\n")

    return {}

def group_page_text_elements(page, page_width, page_height):
    """
    Extracts text elements with visitor_text and groups horizontally adjacent
    segments on the same line into coherent phrases.
    """
    raw_elements = []

    def visitor(text, cm, tm, font_dict, font_size):
        t_clean = text.strip()
        if not t_clean:
            return
        x = tm[4]
        y = tm[5]
        fs = font_size if font_size and font_size > 0 else 10.0
        raw_elements.append({
            "text": text,
            "clean_text": t_clean,
            "x": float(x),
            "y": float(y),
            "font_size": float(fs),
            "font_dict": font_dict,
        })

    try:
        page.extract_text(visitor_text=visitor)
    except Exception as e:
        sys.stderr.write(f"[WARN] Error extracting text with visitor: {e}\n")
        return []

    if not raw_elements:
        return []

    # Sort elements top-to-bottom (y descending in PDF), then left-to-right (x ascending)
    raw_elements.sort(key=lambda e: (-e["y"], e["x"]))

    # Group into lines
    lines = []
    current_line = []
    current_y = None

    for elem in raw_elements:
        if current_y is None:
            current_line = [elem]
            current_y = elem["y"]
        else:
            # Check if vertically aligned within tolerance (half font size)
            if abs(elem["y"] - current_y) <= (elem["font_size"] * 0.45):
                current_line.append(elem)
            else:
                lines.append(current_line)
                current_line = [elem]
                current_y = elem["y"]

    if current_line:
        lines.append(current_line)

    # For each line, concatenate close elements into blocks
    blocks = []
    dummy_c = canvas.Canvas(io.BytesIO(), pagesize=(page_width, page_height))

    for line in lines:
        line.sort(key=lambda e: e["x"])
        sub_block = []

        for elem in line:
            if not sub_block:
                sub_block = [elem]
            else:
                last_elem = sub_block[-1]
                # Estimate last element width
                approx_w = dummy_c.stringWidth(last_elem["text"], FONT_REGULAR, last_elem["font_size"])
                expected_next_x = last_elem["x"] + approx_w
                gap = elem["x"] - expected_next_x

                # If gap is within reasonable word spacing (~1.5 times font size)
                if -2 <= gap <= (elem["font_size"] * 1.6):
                    # Combine
                    sub_block.append(elem)
                else:
                    # Flush previous sub_block
                    b_text = "".join([e["text"] for e in sub_block]).strip()
                    if is_translatable(b_text):
                        min_x = sub_block[0]["x"]
                        y = sub_block[0]["y"]
                        fs = sum([e["font_size"] for e in sub_block]) / len(sub_block)
                        full_w = dummy_c.stringWidth(b_text, FONT_REGULAR, fs)
                        blocks.append({
                            "text": b_text,
                            "x": min_x,
                            "y": y,
                            "font_size": fs,
                            "width": full_w,
                        })
                    sub_block = [elem]

        if sub_block:
            b_text = "".join([e["text"] for e in sub_block]).strip()
            if is_translatable(b_text):
                min_x = sub_block[0]["x"]
                y = sub_block[0]["y"]
                fs = sum([e["font_size"] for e in sub_block]) / len(sub_block)
                full_w = dummy_c.stringWidth(b_text, FONT_REGULAR, fs)
                blocks.append({
                    "text": b_text,
                    "x": min_x,
                    "y": y,
                    "font_size": fs,
                    "width": full_w,
                })

    return blocks

def process_pdf(
    input_file,
    output_pdf,
    target_lang="id",
    mode="replace",
    llm_url="",
    llm_model="",
    llm_key="",
    batch_size=1,
):
    """
    Main processing loop. Iterates through pages, translates text blocks,
    creates vector overlay masks, and writes merged output PDF.
    """
    start_time = time.time()

    if not os.path.exists(input_file):
        raise FileNotFoundError(f"Input file not found: {input_file}")

    # Read leniently for NASCA encrypted files
    reader = pypdf.PdfReader(input_file, strict=False)
    if reader.is_encrypted:
        try:
            reader.decrypt("")
        except Exception:
            pass

    total_pages = len(reader.pages)
    if total_pages == 0:
        raise ValueError("PDF file has 0 pages")

    writer = pypdf.PdfWriter()
    total_translated_count = 0

    # Stream initial start message
    print(
        json.dumps({
            "current": 0,
            "total": total_pages,
            "percent": 0.0,
            "status": "processing",
            "message": f"Memulai penerjemahan {total_pages} halaman dokumen...",
        }),
        flush=True,
    )

    for page_idx in range(total_pages):
        page = reader.pages[page_idx]
        media_box = page.mediabox
        page_width = float(media_box.width)
        page_height = float(media_box.height)

        # 1. Extract and group text blocks
        blocks = group_page_text_elements(page, page_width, page_height)

        # 2. Translate translatable texts
        unique_texts = list(set([b["text"] for b in blocks]))
        translation_map = {}

        if unique_texts:
            # Try LLM if configured
            if llm_url:
                translation_map = translate_with_llm(
                    unique_texts,
                    target_lang=target_lang,
                    llm_url=llm_url,
                    llm_model=llm_model,
                    llm_key=llm_key,
                )

            # Fallback for any unmapped text
            for t in unique_texts:
                if t not in translation_map:
                    translation_map[t] = translate_fallback(t, target_lang=target_lang)

        # 3. Create ReportLab overlay canvas
        overlay_buf = io.BytesIO()
        overlay_canvas = canvas.Canvas(overlay_buf, pagesize=(page_width, page_height))

        for block in blocks:
            orig = block["text"]
            translated = translation_map.get(orig, orig)
            if not translated or translated == orig:
                continue

            total_translated_count += 1
            x = block["x"]
            y = block["y"]
            fs = block["font_size"]
            orig_w = block["width"]

            # Calculate height and padding
            # PDF text baseline: descent is ~0.25 * fs, cap height ~0.75 * fs
            pad_x = 2.0
            pad_y = 1.5
            mask_y = y - (fs * 0.28)
            mask_h = fs * 1.25

            # Font scaling calculation
            trans_w = overlay_canvas.stringWidth(translated, FONT_REGULAR, fs)

            # In replace mode: draw white rectangle mask over original text, then draw translated text
            if mode == "replace":
                # Allow max width to cover either original or translated, capped to reasonable margin
                mask_w = max(orig_w, trans_w) + (pad_x * 2)
                overlay_canvas.setFillColor(colors.white)
                overlay_canvas.rect(x - pad_x, mask_y - pad_y, mask_w, mask_h + (pad_y * 2), fill=1, stroke=0)

                # Draw translated text
                overlay_canvas.setFillColor(colors.black)
                # Auto-scale if translated text is significantly wider than cell allows
                avail_w = max(orig_w * 1.15, 30.0)
                if trans_w > avail_w:
                    scale = max(0.65, avail_w / trans_w)
                    draw_fs = fs * scale
                else:
                    draw_fs = fs

                overlay_canvas.setFont(FONT_REGULAR, draw_fs)
                overlay_canvas.drawString(x, y, translated)

            elif mode == "bilingual":
                # Bilingual mode: Keep original text visible, place translated text as subtitle
                # If room below, draw in subtle dark blue/cyan
                overlay_canvas.setFillColor(colors.HexColor("#0D47A1"))
                draw_fs = max(6.0, fs * 0.75)
                overlay_canvas.setFont(FONT_REGULAR, draw_fs)
                overlay_canvas.drawString(x, y - (fs * 0.85), f"[{translated}]")

        overlay_canvas.save()
        overlay_buf.seek(0)

        # 4. Merge overlay onto original page (preserving all vector graphics, borders, photos)
        overlay_pdf_reader = pypdf.PdfReader(overlay_buf)
        if len(overlay_pdf_reader.pages) > 0:
            page.merge_page(overlay_pdf_reader.pages[0])

        writer.add_page(page)

        # 5. Stream progress update
        curr_page = page_idx + 1
        pct = round((curr_page / total_pages) * 100, 1)
        print(
            json.dumps({
                "current": curr_page,
                "total": total_pages,
                "percent": pct,
                "status": "processing",
                "message": f"Halaman {curr_page} dari {total_pages} berhasil diproses ({pct}%)...",
            }),
            flush=True,
        )

    # 6. Save final output PDF
    os.makedirs(os.path.dirname(os.path.abspath(output_pdf)), exist_ok=True)
    with open(output_pdf, "wb") as f_out:
        writer.write(f_out)

    elapsed = round(time.time() - start_time, 2)
    final_res = {
        "success": True,
        "total_pages": total_pages,
        "translated_blocks": total_translated_count,
        "output_file": os.path.basename(output_pdf),
        "duration_sec": elapsed,
        "message": f"Berhasil menerjemahkan {total_pages} halaman ({total_translated_count} teks) dalam {elapsed} detik.",
    }
    print(json.dumps(final_res), flush=True)
    return final_res

def main():
    parser = argparse.ArgumentParser(description="Working Instruction PDF Auto-Translator")
    parser.add_argument("--input-file", required=True, help="Path to input PDF file")
    parser.add_argument("--output-pdf", required=True, help="Path for output translated PDF")
    parser.add_argument("--target-lang", default="id", help="Target language code: id (Indonesian), ko (Korean)")
    parser.add_argument("--mode", default="replace", choices=["replace", "bilingual"], help="Translation overlay mode")
    parser.add_argument("--llm-url", default="", help="Optional OpenAI-compatible endpoint URL")
    parser.add_argument("--llm-model", default="", help="Optional LLM model name")
    parser.add_argument("--llm-api-key", default="", help="Optional LLM API key")
    parser.add_argument("--batch-size", type=int, default=1, help="Page batch size")

    args = parser.parse_args()

    try:
        process_pdf(
            input_file=args.input_file,
            output_pdf=args.output_pdf,
            target_lang=args.target_lang,
            mode=args.mode,
            llm_url=args.llm_url,
            llm_model=args.llm_model,
            llm_key=args.llm_api_key,
            batch_size=args.batch_size,
        )
    except Exception as e:
        err_res = {
            "success": False,
            "error": str(e),
            "message": f"Gagal menerjemahkan dokumen: {str(e)}",
        }
        print(json.dumps(err_res), flush=True)
        sys.exit(1)

if __name__ == "__main__":
    main()
