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

echo ""
echo -e "${YELLOW}[1/3] Menjalankan pembersihan database...${NC}"

# Check if Docker container pe-portal-postgres is running
if docker ps --format '{{.Names}}' | grep -q "pe-portal-postgres"; then
    echo -e "${CYAN}[2/3] Menggunakan Docker PostgreSQL (pe-portal-postgres)...${NC}"
    docker exec -i pe-portal-postgres psql -U pe_portal -d pe_portal < "$SQL_PATH"
else
    echo -e "${CYAN}[2/3] Menggunakan psql lokal...${NC}"
    export PGPASSWORD="${DB_PASSWORD:-sein_pe_portal_secret_2026}"
    psql -U pe_portal -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -d "${POSTGRES_DB:-pe_portal}" -f "$SQL_PATH"
fi

echo ""
echo -e "${GREEN}[3/3] Database berhasil dibersihkan untuk Production Stage!${NC}"
echo -e "${GREEN}========================================================${NC}"
echo "  Portal siap digunakan dengan akun Administrator:"
echo -e "  Username : ${YELLOW}admin${NC}"
echo -e "  Password : ${YELLOW}admin123${NC} (atau password admin yang sudah diset)"
echo -e "${GREEN}========================================================${NC}"
echo ""
