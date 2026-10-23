#!/usr/bin/env bash
# ============================================================================
# SEIN PE-Portal: Production Clean Wipe Script (Linux / Bash / Docker)
# Mode: Ponytail (Safe, Clean, Interactive Confirmation)
# ============================================================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${YELLOW}========================================================${NC}"
echo -e "${YELLOW}  SEIN PRODUCTION ENGINEER PORTAL - DATABASE WIPE TOOL  ${NC}"
echo -e "${YELLOW}========================================================${NC}"
echo ""
echo -e "${RED}PERINGATAN: Script ini akan MENGHAPUS SEMUA DATA DUMMY / MOCK${NC}"
echo -e "${RED}yang dibuat selama development stage agar database siap produksi.${NC}"
echo ""
echo -e "${CYAN}Data yang AKAN DIHAPUS (WIPED):${NC}"
echo "  - Sample Management (Semua unit dummy sample & histori flow)"
echo "  - Software MR (Semua mock release cheatsheet)"
echo "  - Milestone Tasks / Projects & Comments & Attachments"
echo "  - GMES Issues & Measurements (Data mock line monitor)"
echo "  - Online Training Modules (Data training uji coba)"
echo "  - Innovations, Targets & Articles"
echo "  - Documents, Shares & File Embeddings"
echo "  - DHL Shipments tracker"
echo "  - Audit Logs & Chat history"
echo "  - Akun user non-admin (hanya akun management/admin yang dipertahankan)"
echo ""
echo -e "${GREEN}Data yang TETAP DIPERTAHANKAN (PRESERVED):${NC}"
echo -e "${GREEN}  [OK] Akun Management & Administrator (role = admin)${NC}"
echo -e "${GREEN}  [OK] Master Data Struktur Organisasi PE (group_parts)${NC}"
echo -e "${GREEN}  [OK] Konfigurasi Menu Permission & Visibility${NC}"
echo -e "${GREEN}  [OK] Konfigurasi Sistem (Auth, AI/LLM, MCP, SMTP Gateway)${NC}"
echo -e "${GREEN}  [OK] Schema Migrations Tracking${NC}"
echo ""

read -r -p "Apakah Anda yakin ingin mengosongkan data mock sekarang? (ketik 'YA' untuk lanjut): " CONFIRM
if [ "$CONFIRM" != "YA" ]; then
    echo -e "${YELLOW}[BATAL] Proses wipe dibatalkan oleh user. Tidak ada data yang diubah.${NC}"
    exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_PATH="${SCRIPT_DIR}/backend/scripts/wipe_mock_data.sql"

if [ ! -f "$SQL_PATH" ]; then
    echo -e "${RED}[ERROR] File ${SQL_PATH} tidak ditemukan.${NC}"
    exit 1
fi

# Load .env if present
if [ -f "$SCRIPT_DIR/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    source "$SCRIPT_DIR/.env" 2>/dev/null || true
    set +a
fi

DB_TARGET_NAME="${POSTGRES_DB:-pe_portal}"
DB_TARGET_USER="${POSTGRES_USER:-pe_portal}"
DB_TARGET_PORT="${DB_PORT:-5432}"
DB_TARGET_HOST="${DB_HOST:-localhost}"

echo ""
echo -e "${YELLOW}[1/3] Menjalankan pembersihan database '${DB_TARGET_NAME}'...${NC}"

# Check if Docker container pe-portal-postgres is running
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "pe-portal-postgres"; then
    echo -e "${CYAN}[2/3] Menggunakan Docker PostgreSQL (pe-portal-postgres)...${NC}"
    docker exec -i pe-portal-postgres psql -U "$DB_TARGET_USER" -d "$DB_TARGET_NAME" < "$SQL_PATH"
else
    echo -e "${CYAN}[2/3] Menggunakan psql lokal (Bare-Metal mode)...${NC}"
    
    # Daftar kredensial default PE-Portal yang dicoba otomatis:
    # 1. Password dari .env ($DB_PASSWORD)
    # 2. sein_pe_portal_secret_2026 (Default Docker & repo PE-Portal)
    # 3. postgres (Default superuser PostgreSQL installer)
    # 4. Sein2016! (Default baremetal installer SEIN)
    FOUND_CONN=false
    TEST_USERS=("$DB_TARGET_USER" "postgres")
    TEST_PASSWORDS=("${DB_PASSWORD:-sein_pe_portal_secret_2026}" "postgres" "Sein2016!" "sein_pe_portal_secret_2026" "admin" "")

    for u in "${TEST_USERS[@]}"; do
        for p in "${TEST_PASSWORDS[@]}"; do
            if PGPASSWORD="$p" psql -U "$u" -h "$DB_TARGET_HOST" -p "$DB_TARGET_PORT" -d "$DB_TARGET_NAME" -c '\q' >/dev/null 2>&1; then
                echo -e "${GREEN}✓ Terhubung ke PostgreSQL sebagai user '${u}'!${NC}"
                export PGPASSWORD="$p"
                psql -U "$u" -h "$DB_TARGET_HOST" -p "$DB_TARGET_PORT" -d "$DB_TARGET_NAME" -f "$SQL_PATH"
                FOUND_CONN=true
                break 2
            fi
        done
    done

    if [ "$FOUND_CONN" = false ]; then
        echo -e "${YELLOW}[!] Kredensial default (sein_pe_portal_secret_2026, postgres, Sein2016!) belum cocok.${NC}"
        read -r -p "Masukkan username PostgreSQL [default: ${DB_TARGET_USER}]: " MANUAL_USER
        MANUAL_USER="${MANUAL_USER:-$DB_TARGET_USER}"
        read -r -s -p "Masukkan password PostgreSQL untuk user '${MANUAL_USER}': " MANUAL_PASS
        echo ""
        export PGPASSWORD="$MANUAL_PASS"
        psql -U "$MANUAL_USER" -h "$DB_TARGET_HOST" -p "$DB_TARGET_PORT" -d "$DB_TARGET_NAME" -f "$SQL_PATH"
    fi
fi

echo ""
echo -e "${GREEN}[3/3] Database berhasil dibersihkan untuk Production Stage!${NC}"
echo -e "${GREEN}========================================================${NC}"
echo "  Portal siap digunakan dengan akun Administrator:"
echo -e "  Username : ${YELLOW}admin${NC}"
echo -e "  Password : ${YELLOW}admin123${NC} (atau password admin yang sudah diset)"
echo -e "${GREEN}========================================================${NC}"
echo ""
