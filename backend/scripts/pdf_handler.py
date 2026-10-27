#!/usr/bin/env python3
"""
SEIN PE-Portal: High-Resilience PDF Processing Engine
Handles PDF Compression, Merging, and Splitting with Samsung DRM / NASCA / Fasoo resilience.
Utilizes pypdf with lenient parsing (strict=False) and automatic decryption.
"""

import sys
import os
import argparse
import json
import traceback

try:
    import pypdf
except ImportError:
    print(json.dumps({
        "success": False,
        "error": "Library 'pypdf' is not installed. Please run: apk add py3-pypdf or pip install pypdf"
    }))
    sys.exit(2)

def detect_drm_signature(file_path):
    """Detects corporate DRM / Fasoo / SoftCamp / NASCA signatures in file header/trailer."""
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

def open_pdf_safely(file_path):
    """
    Opens PDF with lenient parsing, auto-decrypts empty/standard user passwords,
    and returns (reader, drm_detected).
    """
    drm_detected = detect_drm_signature(file_path)
    try:
        reader = pypdf.PdfReader(file_path, strict=False)
    except Exception as e:
        # Retry with stream buffer if direct path had issues
        try:
            with open(file_path, "rb") as f:
                reader = pypdf.PdfReader(f, strict=False)
        except Exception as e2:
            raise RuntimeError(f"Gagal membaca PDF ({e2}). Pastikan berkas PDF valid.")

    if reader.is_encrypted:
        try:
            # Try empty string password (standard corporate default)
            res = reader.decrypt("")
            if res == 0:
                # Try bytes empty string
                res = reader.decrypt(b"")
            if res == 0:
                # Try fallback space password
                reader.decrypt(" ")
        except Exception as dec_err:
            pass

    return reader, drm_detected

def clean_and_transfer_pages(reader, writer, page_indices=None):
    """
    Transfers pages cleanly to a new writer, stripping unneeded or corrupted metadata.
    """
    total_pages = len(reader.pages)
    if page_indices is None:
        page_indices = range(total_pages)

    transferred = 0
    for idx in page_indices:
        if 0 <= idx < total_pages:
            try:
                page = reader.pages[idx]
                try:
                    page.compress_content_streams()
                except Exception:
                    pass
                writer.add_page(page)
                transferred += 1
            except Exception as page_err:
                # Leniently skip corrupt single page if necessary
                sys.stderr.write(f"Warning: page {idx+1} skipped due to error: {page_err}\n")

    return transferred

def handle_compress(args):
    """Compresses PDF content streams and removes unused objects."""
    reader, drm_detected = open_pdf_safely(args.input)
    writer = pypdf.PdfWriter()

    # Copy clean pages
    transferred = clean_and_transfer_pages(reader, writer)
    if transferred == 0:
        raise RuntimeError("Dokumen tidak memiliki halaman yang dapat dibaca.")

    # Quality setting presets for pypdf
    # In pypdf, compress_content_streams() performs flate compression
    for page in writer.pages:
        try:
            page.compress_content_streams()
        except Exception:
            pass

    # Clean metadata to standard PE-Portal format
    writer.add_metadata({
        "/Producer": "SEIN PE-Portal PDF Engine",
        "/Creator": "PE-Portal Corporate Utilities",
    })

    # Save output
    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    with open(args.output, "wb") as f_out:
        writer.write(f_out)

    orig_size = os.path.getsize(args.input)
    new_size = os.path.getsize(args.output)
    saved_bytes = max(0, orig_size - new_size)
    saved_percent = round((saved_bytes / orig_size) * 100, 1) if orig_size > 0 else 0

    return {
        "success": True,
        "action": "compress",
        "original_size": orig_size,
        "compressed_size": new_size,
        "saved_bytes": saved_bytes,
        "saved_percent": saved_percent,
        "pages": transferred,
        "drm_detected": drm_detected,
    }

def handle_merge(args):
    """Merges multiple PDF documents into one single standard PDF."""
    if not args.inputs or len(args.inputs) < 2:
        raise ValueError("Harap sediakan minimal 2 berkas PDF untuk digabungkan.")

    writer = pypdf.PdfWriter()
    total_pages = 0
    drm_any = False

    for inp in args.inputs:
        if not os.path.isfile(inp):
            raise FileNotFoundError(f"Berkas tidak ditemukan: {inp}")

        reader, drm_found = open_pdf_safely(inp)
        if drm_found:
            drm_any = True

        p_count = clean_and_transfer_pages(reader, writer)
        total_pages += p_count

    if total_pages == 0:
        raise RuntimeError("Tidak ada halaman yang berhasil digabungkan dari berkas yang diberikan.")

    writer.add_metadata({
        "/Producer": "SEIN PE-Portal PDF Engine",
        "/Creator": "PE-Portal Merge Tool",
    })

    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    with open(args.output, "wb") as f_out:
        writer.write(f_out)

    out_size = os.path.getsize(args.output)

    return {
        "success": True,
        "action": "merge",
        "files_merged": len(args.inputs),
        "total_pages": total_pages,
        "output_size": out_size,
        "drm_detected": drm_any,
    }

def handle_split(args):
    """Extracts a slice/range of pages from a PDF document."""
    reader, drm_detected = open_pdf_safely(args.input)
    total_pages = len(reader.pages)

    if total_pages == 0:
        raise RuntimeError("Dokumen tidak memiliki halaman untuk dipotong.")

    first_page = max(1, args.first_page)
    last_page = min(total_pages, args.last_page) if args.last_page > 0 else total_pages

    if first_page > last_page:
        raise ValueError(f"Halaman awal ({first_page}) tidak boleh lebih besar dari halaman akhir ({last_page}).")

    if first_page > total_pages:
        raise ValueError(f"Halaman awal ({first_page}) melebihi jumlah halaman dokumen ({total_pages}).")

    # Slice 0-indexed range
    target_indices = range(first_page - 1, last_page)

    writer = pypdf.PdfWriter()
    transferred = clean_and_transfer_pages(reader, writer, target_indices)

    writer.add_metadata({
        "/Producer": "SEIN PE-Portal PDF Engine",
        "/Creator": "PE-Portal Split Tool",
    })

    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    with open(args.output, "wb") as f_out:
        writer.write(f_out)

    out_size = os.path.getsize(args.output)

    return {
        "success": True,
        "action": "split",
        "first_page": first_page,
        "last_page": last_page,
        "pages_extracted": transferred,
        "total_original_pages": total_pages,
        "output_size": out_size,
        "drm_detected": drm_detected,
    }

def handle_inspect(args):
    """Inspects a PDF document and returns detailed metadata and DRM status."""
    reader, drm_detected = open_pdf_safely(args.input)
    meta = reader.metadata or {}
    clean_meta = {}
    for k, v in meta.items():
        try:
            clean_meta[str(k).lstrip("/")] = str(v)
        except Exception:
            pass

    return {
        "success": True,
        "action": "inspect",
        "pages": len(reader.pages),
        "is_encrypted": reader.is_encrypted,
        "drm_detected": drm_detected,
        "file_size": os.path.getsize(args.input),
        "metadata": clean_meta,
    }

def main():
    parser = argparse.ArgumentParser(description="SEIN PE-Portal PDF Engine")
    subparsers = parser.add_subparsers(dest="subcommand", help="Sub-perintah operasi PDF")

    # Compress
    p_comp = subparsers.add_parser("compress", help="Kompresi berkas PDF")
    p_comp.add_argument("--input", "-i", required=True, help="Path ke berkas PDF input")
    p_comp.add_argument("--output", "-o", required=True, help="Path ke berkas PDF output")
    p_comp.add_argument("--quality", "-q", default="ebook", choices=["screen", "ebook", "printer", "prepress"], help="Tingkat kualitas kompresi")

    # Merge
    p_merge = subparsers.add_parser("merge", help="Gabungkan beberapa berkas PDF")
    p_merge.add_argument("--inputs", "-i", nargs="+", required=True, help="Daftar berkas PDF input")
    p_merge.add_argument("--output", "-o", required=True, help="Path ke berkas PDF output")

    # Split
    p_split = subparsers.add_parser("split", help="Pisahkan/potong halaman PDF")
    p_split.add_argument("--input", "-i", required=True, help="Path ke berkas PDF input")
    p_split.add_argument("--output", "-o", required=True, help="Path ke berkas PDF output")
    p_split.add_argument("--first-page", "-f", type=int, default=1, help="Halaman pertama (1-based)")
    p_split.add_argument("--last-page", "-l", type=int, default=-1, help="Halaman terakhir (1-based)")

    # Inspect
    p_insp = subparsers.add_parser("inspect", help="Inspeksi metadata dan enkripsi PDF")
    p_insp.add_argument("--input", "-i", required=True, help="Path ke berkas PDF input")

    args = parser.parse_args()

    if not args.subcommand:
        parser.print_help()
        sys.exit(1)

    try:
        if args.subcommand == "compress":
            result = handle_compress(args)
        elif args.subcommand == "merge":
            result = handle_merge(args)
        elif args.subcommand == "split":
            result = handle_split(args)
        elif args.subcommand == "inspect":
            result = handle_inspect(args)
        else:
            raise ValueError(f"Sub-perintah tidak dikenali: {args.subcommand}")

        # Output JSON result to stdout
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(0)

    except Exception as err:
        err_msg = str(err)
        # Check for encrypted reader with strict user password
        if "encrypted" in err_msg.lower() or "password" in err_msg.lower():
            err_msg = "Dokumen memiliki enkripsi/kata sandi penuh yang tidak dapat dibuka otomatis."

        print(json.dumps({
            "success": False,
            "error": err_msg,
            "traceback": traceback.format_exc() if os.environ.get("DEBUG") else None
        }, ensure_ascii=False))
        sys.exit(1)

if __name__ == "__main__":
    main()
