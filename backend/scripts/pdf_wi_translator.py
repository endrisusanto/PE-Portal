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
import tempfile
import urllib.request
import urllib.parse
import math

# ponytail: graceful auto-install & error reporting for missing PDF dependencies
try:
    import pypdf
    from reportlab.pdfgen import canvas
    import reportlab.lib.colors as colors
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
except ImportError:
    try:
        import subprocess
        # Attempt quiet auto-installation of pypdf and reportlab
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", "--quiet", "pypdf", "reportlab"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        import pypdf
        from reportlab.pdfgen import canvas
        import reportlab.lib.colors as colors
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
    except Exception as e:
        err_obj = {
            "success": False,
            "error": f"Dependensi Python 'pypdf' atau 'reportlab' belum terpasang: {e}",
            "message": "Dependensi translator belum terpasang. Silakan jalankan 'pip install pypdf reportlab' di terminal server.",
        }
        print(json.dumps(err_obj), flush=True)
        sys.exit(1)

# Attempt to register Unicode TrueType font (DejaVuSans) if available in system
FONT_REGULAR = "Helvetica"
FONT_BOLD = "Helvetica-Bold"

# ponytail: Monkey-patch pypdf reader to tolerate truncated streams when reading lines backwards
try:
    import pypdf
    import pypdf._utils as _pypdf_utils
    import pypdf._reader as _pypdf_reader

    _orig_read_prev = _pypdf_utils.read_previous_line

    def _tolerant_read_previous_line(stream):
        try:
            return _orig_read_prev(stream)
        except Exception:
            return b""

    _pypdf_utils.read_previous_line = _tolerant_read_previous_line
    _pypdf_reader.read_previous_line = _tolerant_read_previous_line
except Exception:
    pass

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
        # ponytail: combined affine transform M = Tm x CTM to get real user-space coordinates and font size
        a = tm[0] * cm[0] + tm[1] * cm[2]
        b = tm[0] * cm[1] + tm[1] * cm[3]
        c = tm[2] * cm[0] + tm[3] * cm[2]
        d = tm[2] * cm[1] + tm[3] * cm[3]
        x = tm[4] * cm[0] + tm[5] * cm[2] + cm[4]
        y = tm[4] * cm[1] + tm[5] * cm[3] + cm[5]
        sy = math.sqrt(c * c + d * d)
        sx = math.sqrt(a * a + b * b)
        scale = sy if sy > 0 else (sx if sx > 0 else 1.0)
        fs = (font_size or 10.0) * scale

        base_font = str(font_dict.get("/BaseFont", "")) if font_dict and isinstance(font_dict, dict) else ""
        is_bold = any(k in base_font.lower() for k in ["bold", "black", "heavy"])

        raw_elements.append({
            "text": text,
            "clean_text": t_clean,
            "x": float(x),
            "y": float(y),
            "font_size": float(fs),
            "is_bold": is_bold,
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
                last_font = FONT_BOLD if last_elem.get("is_bold") else FONT_REGULAR
                approx_w = dummy_c.stringWidth(last_elem["text"], last_font, last_elem["font_size"])
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
                        is_bold = any(e.get("is_bold") for e in sub_block)
                        b_font = FONT_BOLD if is_bold else FONT_REGULAR
                        full_w = dummy_c.stringWidth(b_text, b_font, fs)
                        blocks.append({
                            "text": b_text,
                            "x": min_x,
                            "y": y,
                            "font_size": fs,
                            "is_bold": is_bold,
                            "width": full_w,
                        })
                    sub_block = [elem]

        if sub_block:
            b_text = "".join([e["text"] for e in sub_block]).strip()
            if is_translatable(b_text):
                min_x = sub_block[0]["x"]
                y = sub_block[0]["y"]
                fs = sum([e["font_size"] for e in sub_block]) / len(sub_block)
                is_bold = any(e.get("is_bold") for e in sub_block)
                b_font = FONT_BOLD if is_bold else FONT_REGULAR
                full_w = dummy_c.stringWidth(b_text, b_font, fs)
                blocks.append({
                    "text": b_text,
                    "x": min_x,
                    "y": y,
                    "font_size": fs,
                    "is_bold": is_bold,
                    "width": full_w,
                })

    return blocks

def verify_pdf_readable(source):
    """
    ponytail: test if a PDF file path or raw bytes can be opened AND its pages accessed.
    Crucial: touches first page mediabox to ensure stream decompression doesn't raise PdfStreamError.
    """
    try:
        if isinstance(source, (bytes, bytearray)):
            r = pypdf.PdfReader(io.BytesIO(source), strict=False)
        else:
            r = pypdf.PdfReader(source, strict=False)
        if r.is_encrypted:
            try:
                r.decrypt("")
            except Exception:
                pass
        count = len(r.pages)
        if count > 0:
            p0 = r.pages[0]
            _ = p0.mediabox
            return True, count
    except Exception:
        pass
    return False, 0

def heal_pdf_bytes(raw_bytes):
    """
    ponytail: multi-strategy pure-Python byte stream healer for truncated or corrupted PDFs.
    Zero external dependencies. Works across all OS platforms without Ghostscript.
    """
    if not raw_bytes or len(raw_bytes) < 32:
        return None

    # Strategy 1: Iterate backwards through all %%EOF occurrences (handles aborted saves & revision history)
    eof_positions = [m.start() for m in re.finditer(rb"%%EOF", raw_bytes)]
    for pos in reversed(eof_positions):
        candidate = raw_bytes[: pos + 5] + b"\n"
        ok, _ = verify_pdf_readable(candidate)
        if ok:
            return candidate

    # Strategy 2: If startxref exists without clean %%EOF
    sx_matches = list(re.finditer(rb"startxref\s*(\d+)", raw_bytes))
    if sx_matches:
        last_sx = sx_matches[-1]
        candidate = raw_bytes[: last_sx.end()] + b"\n%%EOF\n"
        ok, _ = verify_pdf_readable(candidate)
        if ok:
            return candidate

    # Strategy 3: Find last xref table and synthesize missing trailer & %%EOF
    xref_pos = raw_bytes.rfind(b"xref\n")
    if xref_pos != -1:
        cat_m = re.search(rb"/Root\s+(\d+\s+\d+\s+R)", raw_bytes)
        root_part = b" /Root " + cat_m.group(1) if cat_m else b""
        synth = (
            raw_bytes[:xref_pos]
            + b"xref\n"
            + raw_bytes[xref_pos + 5 :]
            + b"\ntrailer\n<<"
            + root_part
            + b" >>\nstartxref\n"
            + str(xref_pos).encode()
            + b"\n%%EOF\n"
        )
        ok, _ = verify_pdf_readable(synth)
        if ok:
            return synth

    # Strategy 4: Fallback trailer with startxref 0
    candidate = raw_bytes + b"\ntrailer\n<< >>\nstartxref\n0\n%%EOF\n"
    ok, _ = verify_pdf_readable(candidate)
    if ok:
        return candidate

    return None

def repair_pdf_if_needed(input_path):
    """
    ponytail: robust multi-tier pre-flight stream healer for truncated or corrupted PDFs.
    Tier 0: Check if source is already 100% readable without repair.
    Tier 1: Ghostscript CLI (prepress repair, full Windows path autodiscovery, 180s timeout for large files).
    Tier 2: Pure Python byte stream healer (handles missing/corrupted %%EOF and cut-off streams).
    Tier 3: In-memory page salvager (recovers all readable pages into a clean PDF).
    Returns (usable_pdf_path, temp_file_to_clean_or_None).
    """
    # Tier 0: Direct verification
    ok, num_pages = verify_pdf_readable(input_path)
    if ok:
        return input_path, None

    sys.stderr.write(f"[INFO] Source PDF '{os.path.basename(input_path)}' has truncated or corrupted stream. Initiating multi-tier repair...\n")

    # Tier 1: Ghostscript CLI
    try:
        import shutil
        import subprocess

        gs_bin = shutil.which("gs") or shutil.which("gswin64c") or shutil.which("gswin32c")
        # On Windows, check standard Program Files installation paths
        if not gs_bin and os.name == "nt":
            import glob
            candidates = (
                glob.glob(r"C:\Program Files\gs\gs*\bin\gswin64c.exe")
                + glob.glob(r"C:\Program Files (x86)\gs\gs*\bin\gswin32c.exe")
            )
            if candidates:
                gs_bin = candidates[-1]

        if gs_bin:
            tmp_gs = tempfile.NamedTemporaryFile(suffix="_gs_repaired.pdf", delete=False)
            tmp_gs.close()
            cmd = [
                gs_bin,
                "-dBATCH",
                "-dNOPAUSE",
                "-dQUIET",
                "-sDEVICE=pdfwrite",
                "-dPDFSETTINGS=/prepress",
                "-dCompatibilityLevel=1.4",
                "-dAutoRotatePages=/None",
                f"-sOutputFile={tmp_gs.name}",
                input_path,
            ]
            # 180 second timeout for large 15MB+ documents
            subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=180)
            if os.path.exists(tmp_gs.name) and os.path.getsize(tmp_gs.name) > 1024:
                gs_ok, gs_pages = verify_pdf_readable(tmp_gs.name)
                if gs_ok:
                    sys.stderr.write(f"[INFO] Ghostscript successfully repaired PDF ({gs_pages} pages recovered).\n")
                    return tmp_gs.name, tmp_gs.name
            if os.path.exists(tmp_gs.name):
                try:
                    os.remove(tmp_gs.name)
                except Exception:
                    pass
    except Exception as gs_err:
        sys.stderr.write(f"[WARN] Ghostscript repair skipped or failed: {gs_err}\n")

    # Tier 2: Pure Python byte stream healer
    try:
        with open(input_path, "rb") as f:
            raw_bytes = f.read()

        healed_bytes = heal_pdf_bytes(raw_bytes)
        if healed_bytes:
            tmp_py = tempfile.NamedTemporaryFile(suffix="_py_repaired.pdf", delete=False)
            tmp_py.write(healed_bytes)
            tmp_py.close()
            py_ok, py_pages = verify_pdf_readable(tmp_py.name)
            if py_ok:
                sys.stderr.write(f"[INFO] Pure Python stream healer successfully repaired PDF ({py_pages} pages recovered).\n")
                return tmp_py.name, tmp_py.name
            if os.path.exists(tmp_py.name):
                try:
                    os.remove(tmp_py.name)
                except Exception:
                    pass
    except Exception as py_err:
        sys.stderr.write(f"[WARN] Pure Python repair failed: {py_err}\n")

    # Tier 3: In-memory page salvager
    try:
        r = pypdf.PdfReader(input_path, strict=False)
        salvage_writer = pypdf.PdfWriter()
        salvaged_count = 0
        for p in r.pages:
            try:
                _ = p.mediabox
                salvage_writer.add_page(p)
                salvaged_count += 1
            except Exception:
                salvage_writer.add_blank_page(width=595.0, height=842.0)
        if salvaged_count > 0:
            tmp_salvage = tempfile.NamedTemporaryFile(suffix="_salvaged.pdf", delete=False)
            with open(tmp_salvage.name, "wb") as f_salvage:
                salvage_writer.write(f_salvage)
            tmp_salvage.close()
            s_ok, s_pages = verify_pdf_readable(tmp_salvage.name)
            if s_ok:
                sys.stderr.write(f"[INFO] In-memory page salvager recovered {s_pages} pages.\n")
                return tmp_salvage.name, tmp_salvage.name
            if os.path.exists(tmp_salvage.name):
                try:
                    os.remove(tmp_salvage.name)
                except Exception:
                    pass
    except Exception as s_err:
        sys.stderr.write(f"[WARN] In-memory salvage failed: {s_err}\n")

    return input_path, None

def process_pdf(
    input_file,
    output_pdf,
    target_lang="id",
    mode="replace",
    llm_url="",
    llm_model="",
    llm_key="",
    batch_size=5,
):
    """
    ponytail: auto-chunking batch processor (5 pages per batch) with shared document-level
    translation cache and per-page fault tolerance to prevent memory exhaustion and stream truncation.
    """
    start_time = time.time()

    if not os.path.exists(input_file):
        raise FileNotFoundError(f"Input file not found: {input_file}")

    # 1. Pre-flight repair if needed
    usable_path, temp_repair_file = repair_pdf_if_needed(input_file)

    try:
        try:
            reader = pypdf.PdfReader(usable_path, strict=False)
            if reader.is_encrypted:
                try:
                    reader.decrypt("")
                except Exception:
                    pass

            total_pages = len(reader.pages)
            if total_pages == 0:
                raise ValueError("PDF file has 0 pages")
            _ = reader.pages[0].mediabox
        except Exception as open_err:
            sys.stderr.write(f"[WARN] Initial reader failed ({open_err}). Forcing deep pure-Python heal...\n")
            with open(usable_path, "rb") as f_raw:
                raw_bytes = f_raw.read()
            healed = heal_pdf_bytes(raw_bytes)
            if healed:
                tmp_forced = tempfile.NamedTemporaryFile(suffix="_forced_healed.pdf", delete=False)
                tmp_forced.write(healed)
                tmp_forced.close()
                usable_path = tmp_forced.name
                if temp_repair_file and os.path.exists(temp_repair_file):
                    try:
                        os.remove(temp_repair_file)
                    except Exception:
                        pass
                temp_repair_file = tmp_forced.name
                reader = pypdf.PdfReader(usable_path, strict=False)
                if reader.is_encrypted:
                    try:
                        reader.decrypt("")
                    except Exception:
                        pass
                total_pages = len(reader.pages)
            else:
                raise open_err

        chunk_size = batch_size if batch_size and batch_size > 0 else 5
        total_chunks = (total_pages + chunk_size - 1) // chunk_size

        # Stream initial start message
        print(
            json.dumps({
                "current": 0,
                "total": total_pages,
                "percent": 0.0,
                "status": "processing",
                "message": f"Memulai penerjemahan {total_pages} halaman ({total_chunks} batch)...",
            }),
            flush=True,
        )

        doc_translation_cache = {}
        total_translated_count = 0
        chunk_files = []
        temp_dir = tempfile.mkdtemp(prefix="wi_chunks_")

        try:
            for chunk_idx in range(total_chunks):
                start_p = chunk_idx * chunk_size
                end_p = min(start_p + chunk_size, total_pages)
                chunk_num = chunk_idx + 1

                chunk_writer = pypdf.PdfWriter()

                for page_idx in range(start_p, end_p):
                    curr_page = page_idx + 1
                    try:
                        page = reader.pages[page_idx]
                        media_box = page.mediabox
                        page_width = float(media_box.width)
                        page_height = float(media_box.height)

                        # Extract text
                        blocks = group_page_text_elements(page, page_width, page_height)
                        unique_texts = list(set([b["text"] for b in blocks]))

                        # Determine missing texts not in doc_translation_cache
                        missing_texts = [t for t in unique_texts if t not in doc_translation_cache]
                        if missing_texts:
                            if llm_url:
                                llm_mapped = translate_with_llm(
                                    missing_texts,
                                    target_lang=target_lang,
                                    llm_url=llm_url,
                                    llm_model=llm_model,
                                    llm_key=llm_key,
                                )
                                doc_translation_cache.update(llm_mapped)

                            # Fallback for remaining missing texts
                            for t in missing_texts:
                                if t not in doc_translation_cache:
                                    doc_translation_cache[t] = translate_fallback(t, target_lang=target_lang)

                        # Create ReportLab overlay canvas
                        overlay_buf = io.BytesIO()
                        overlay_canvas = canvas.Canvas(overlay_buf, pagesize=(page_width, page_height))

                        for block in blocks:
                            orig = block["text"]
                            translated = doc_translation_cache.get(orig, orig)
                            if not translated or translated == orig:
                                continue

                            total_translated_count += 1
                            x = block["x"]
                            y = block["y"]
                            fs = block["font_size"]
                            orig_w = block["width"]

                            pad_x = 2.0
                            pad_y = 1.5
                            mask_y = y - (fs * 0.28)
                            mask_h = fs * 1.25

                            font_to_use = FONT_BOLD if block.get("is_bold") else FONT_REGULAR
                            trans_w = overlay_canvas.stringWidth(translated, font_to_use, fs)

                            if mode == "replace":
                                # Calculate available width without overly shrinking translated text
                                max_page_w = max(page_width - x - 20.0, orig_w)
                                avail_w = max(orig_w * 1.35, min(max_page_w, orig_w + 50.0))
                                if trans_w > avail_w:
                                    scale = max(0.80, avail_w / trans_w)
                                    draw_fs = fs * scale
                                    drawn_w = overlay_canvas.stringWidth(translated, font_to_use, draw_fs)
                                else:
                                    draw_fs = fs
                                    drawn_w = trans_w

                                mask_w = max(orig_w, drawn_w) + (pad_x * 2)
                                overlay_canvas.setFillColor(colors.white)
                                overlay_canvas.rect(x - pad_x, mask_y - pad_y, mask_w, mask_h + (pad_y * 2), fill=1, stroke=0)

                                overlay_canvas.setFillColor(colors.black)
                                overlay_canvas.setFont(font_to_use, draw_fs)
                                overlay_canvas.drawString(x, y, translated)
                            elif mode == "bilingual":
                                overlay_canvas.setFillColor(colors.HexColor("#0D47A1"))
                                draw_fs = max(6.0, fs * 0.75)
                                overlay_canvas.setFont(font_to_use, draw_fs)
                                overlay_canvas.drawString(x, y - (fs * 0.85), f"[{translated}]")

                        overlay_canvas.save()
                        overlay_buf.seek(0)

                        # Merge overlay with per-page error protection
                        try:
                            overlay_pdf_reader = pypdf.PdfReader(overlay_buf, strict=False)
                            if len(overlay_pdf_reader.pages) > 0:
                                page.merge_page(overlay_pdf_reader.pages[0])
                        except Exception as merge_err:
                            sys.stderr.write(f"[WARN] Overlay merge error on page {curr_page}: {merge_err}\n")

                        chunk_writer.add_page(page)

                    except Exception as page_err:
                        sys.stderr.write(f"[WARN] Error on page {curr_page}: {page_err}. Preserving raw page.\n")
                        try:
                            chunk_writer.add_page(reader.pages[page_idx])
                        except Exception:
                            pass

                    # Stream progress per-page
                    pct = round((curr_page / total_pages) * 100, 1)
                    print(
                        json.dumps({
                            "current": curr_page,
                            "total": total_pages,
                            "percent": pct,
                            "status": "processing",
                            "message": f"Halaman {curr_page} dari {total_pages} (Batch {chunk_num}/{total_chunks}) berhasil diproses ({pct}%)...",
                        }),
                        flush=True,
                    )

                # Write chunk to disk and free memory
                chunk_file = os.path.join(temp_dir, f"chunk_{chunk_idx:03d}_{start_p}_{end_p}.pdf")
                with open(chunk_file, "wb") as f_chunk:
                    chunk_writer.write(f_chunk)
                chunk_files.append(chunk_file)
                del chunk_writer

            # Final Assembly: Merge all chunks into output_pdf
            os.makedirs(os.path.dirname(os.path.abspath(output_pdf)), exist_ok=True)
            if len(chunk_files) == 1:
                import shutil
                shutil.copy2(chunk_files[0], output_pdf)
            else:
                # ponytail: Use pypdf.PdfWriter for assembling chunks (PdfMerger was removed in pypdf >= 5.0)
                final_writer = pypdf.PdfWriter()
                if hasattr(final_writer, "append"):
                    for cf in chunk_files:
                        final_writer.append(cf)
                elif hasattr(pypdf, "PdfMerger"):
                    merger = pypdf.PdfMerger(strict=False)
                    for cf in chunk_files:
                        merger.append(cf)
                    with open(output_pdf, "wb") as f_final:
                        merger.write(f_final)
                    merger.close()
                    final_writer = None
                else:
                    for cf in chunk_files:
                        cf_reader = pypdf.PdfReader(cf)
                        for page in cf_reader.pages:
                            final_writer.add_page(page)

                if final_writer is not None:
                    with open(output_pdf, "wb") as f_final:
                        final_writer.write(f_final)
                    final_writer.close()

        finally:
            # Clean up temporary chunk files
            for cf in chunk_files:
                if os.path.exists(cf):
                    try:
                        os.remove(cf)
                    except Exception:
                        pass
            if os.path.exists(temp_dir):
                try:
                    os.rmdir(temp_dir)
                except Exception:
                    pass

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

    finally:
        if temp_repair_file and os.path.exists(temp_repair_file):
            try:
                os.remove(temp_repair_file)
            except Exception:
                pass

def main():
    parser = argparse.ArgumentParser(description="Working Instruction PDF Auto-Translator")
    parser.add_argument("--input-file", required=True, help="Path to input PDF file")
    parser.add_argument("--output-pdf", required=True, help="Path for output translated PDF")
    parser.add_argument("--target-lang", default="id", help="Target language code: id (Indonesian), ko (Korean)")
    parser.add_argument("--mode", default="replace", choices=["replace", "bilingual"], help="Translation overlay mode")
    parser.add_argument("--llm-url", default="", help="Optional OpenAI-compatible endpoint URL")
    parser.add_argument("--llm-model", default="", help="Optional LLM model name")
    parser.add_argument("--llm-api-key", default="", help="Optional LLM API key")
    parser.add_argument("--batch-size", type=int, default=5, help="Page batch size (default: 5)")

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
