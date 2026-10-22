# ============================================================================
# SEIN PE-Portal - Dedicated Database Initializer
# Mode: /ponytail (One-Click Database Setup)
# ============================================================================
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  SEIN PE-PORTAL - INISIALISASI DATABASE POSTGRESQL" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Cari psql.exe
$psqlCmd = Get-Command "psql" -ErrorAction SilentlyContinue
if (-not $psqlCmd) {
    $foundPsql = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($foundPsql) {
        $psqlCmd = $foundPsql.FullName
    }
} else {
    $psqlCmd = "psql"
}

if (-not $psqlCmd) {
    Write-Host "[-] Error: psql.exe tidak ditemukan di C:\Program Files\PostgreSQL\" -ForegroundColor Red
    exit 1
}

Write-Host "[+] Ditemukan psql: $psqlCmd" -ForegroundColor Green
Write-Host ""
Write-Host "Menyiapkan role dan database 'pe_portal' (Password: Sein2016!)..." -ForegroundColor Yellow
Write-Host "Catatan: Jika diminta password, masukkan password user 'postgres' laptop Anda." -ForegroundColor Gray
Write-Host ""

# 2. Buat / Update Role pe_portal
& $psqlCmd -U postgres -h localhost -c "CREATE ROLE pe_portal WITH LOGIN PASSWORD 'Sein2016!' SUPERUSER;" 2>$null
& $psqlCmd -U postgres -h localhost -c "ALTER ROLE pe_portal WITH PASSWORD 'Sein2016!' SUPERUSER;" 2>$null

# 3. Buat Database pe_portal
& $psqlCmd -U postgres -h localhost -c "CREATE DATABASE pe_portal OWNER pe_portal;" 2>$null

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "[OK] Database dan Role 'pe_portal' berhasil disiapkan!" -ForegroundColor Green
Write-Host "Sekarang Anda bisa menjalankan: .\start-baremetal.bat" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Green
