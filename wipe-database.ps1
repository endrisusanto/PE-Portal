# ============================================================================
# SEIN PE-Portal: Production Clean Wipe Script (PowerShell)
# Mode: Ponytail (Safe, Clean, Interactive Confirmation)
# ============================================================================
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "========================================================" -ForegroundColor Yellow
Write-Host "  SEIN PRODUCTION ENGINEER PORTAL - DATABASE WIPE TOOL  " -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "PERINGATAN: Script ini akan MENGHAPUS SEMUA DATA DUMMY / MOCK" -ForegroundColor Red
Write-Host "yang dibuat selama development stage agar database siap produksi." -ForegroundColor Red
Write-Host ""
Write-Host "Data yang AKAN DIHAPUS (WIPED):" -ForegroundColor Cyan
Write-Host "  - Sample Management (Semua unit dummy sample & histori flow)" -ForegroundColor Gray
Write-Host "  - Software MR (Semua mock release cheatsheet)" -ForegroundColor Gray
Write-Host "  - Milestone Tasks / Projects & Comments & Attachments" -ForegroundColor Gray
Write-Host "  - GMES Issues & Measurements (Data mock line monitor)" -ForegroundColor Gray
Write-Host "  - Online Training Modules (Data training uji coba)" -ForegroundColor Gray
Write-Host "  - Innovations, Targets & Articles" -ForegroundColor Gray
Write-Host "  - Documents, Shares & File Embeddings" -ForegroundColor Gray
Write-Host "  - DHL Shipments tracker" -ForegroundColor Gray
Write-Host "  - Audit Logs & Chat history" -ForegroundColor Gray
Write-Host "  - Akun user non-admin (hanya akun management/admin yang dipertahankan)" -ForegroundColor Gray
Write-Host ""
Write-Host "Data yang TETAP DIPERTAHANKAN (PRESERVED):" -ForegroundColor Green
Write-Host "  [OK] Akun Management & Administrator (role = admin)" -ForegroundColor Green
Write-Host "  [OK] Master Data Struktur Organisasi PE (group_parts)" -ForegroundColor Green
Write-Host "  [OK] Konfigurasi Menu Permission & Visibility" -ForegroundColor Green
Write-Host "  [OK] Konfigurasi Sistem (Auth, AI/LLM, MCP, SMTP Gateway)" -ForegroundColor Green
Write-Host "  [OK] Schema Migrations Tracking" -ForegroundColor Green
Write-Host ""

$confirmation = Read-Host "Apakah Anda yakin ingin mengosongkan data mock sekarang? (ketik 'YA' untuk lanjut)"
if ($confirmation -ne "YA") {
    Write-Host "[BATAL] Proses wipe dibatalkan oleh user. Tidak ada data yang diubah." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "[1/3] Menjalankan pembersihan database..." -ForegroundColor Yellow

$sqlPath = Join-Path $PSScriptRoot "backend\scripts\wipe_mock_data.sql"
if (-not (Test-Path $sqlPath)) {
    $sqlPath = Join-Path $PSScriptRoot "backend/scripts/wipe_mock_data.sql"
}

$envFile = Join-Path $PSScriptRoot ".env"
$dbUser = "pe_portal"
$dbPass = "sein_pe_portal_secret_2026"
$dbName = "pe_portal"
$dbHost = "localhost"
$dbPort = "5432"

if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -match "^\s*DB_PASSWORD\s*=\s*(.+)") { $dbPass = $matches[1].Trim() }
        if ($line -match "^\s*POSTGRES_USER\s*=\s*(.+)") { $dbUser = $matches[1].Trim() }
        if ($line -match "^\s*POSTGRES_DB\s*=\s*(.+)") { $dbName = $matches[1].Trim() }
        if ($line -match "^\s*DB_HOST\s*=\s*(.+)") { $dbHost = $matches[1].Trim() }
        if ($line -match "^\s*DB_PORT\s*=\s*(.+)") { $dbPort = $matches[1].Trim() }
    }
}

# 1. Cek apakah container docker pe-portal-postgres berjalan
$dockerRunning = $false
if (Get-Command docker -ErrorAction SilentlyContinue) {
    $containerCheck = docker ps --filter "name=pe-portal-postgres" --format "{{.Names}}" 2>$null
    if ($containerCheck -like "*pe-portal-postgres*") {
        $dockerRunning = $true
    }
}

if ($dockerRunning) {
    Write-Host "[2/3] Menggunakan Docker PostgreSQL (pe-portal-postgres)..." -ForegroundColor Cyan
    Get-Content $sqlPath -Raw | docker exec -i pe-portal-postgres psql -U $dbUser -d $dbName
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Gagal mengeksekusi script wipe via Docker." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[2/3] Mencari psql lokal pada sistem Windows..." -ForegroundColor Cyan
    $psqlCandidates = @(
        "psql",
        "C:\Program Files\PostgreSQL\17\bin\psql.exe",
        "C:\Program Files\PostgreSQL\16\bin\psql.exe",
        "C:\Program Files\PostgreSQL\15\bin\psql.exe",
        "C:\Program Files\PostgreSQL\14\bin\psql.exe"
    )
    $psqlCmd = $null
    foreach ($cand in $psqlCandidates) {
        if (Get-Command $cand -ErrorAction SilentlyContinue) {
            $psqlCmd = $cand
            break
        } elseif (Test-Path $cand) {
            $psqlCmd = $cand
            break
        }
    }

    if ($psqlCmd) {
        Write-Host "Menguji kredensial PostgreSQL lokal..." -ForegroundColor Cyan
        
        # Daftar kredensial yang dicoba secara otomatis
        $testUsers = @($dbUser, "postgres")
        $testPasswords = @($dbPass, "sein_pe_portal_secret_2026", "postgres", "Sein2016!", "admin", "")
        $connected = $false

        foreach ($u in $testUsers) {
            foreach ($p in $testPasswords) {
                $env:PGPASSWORD = $p
                & $psqlCmd -U $u -h $dbHost -p $dbPort -d $dbName -c "\q" *>$null
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "[OK] Terhubung ke PostgreSQL sebagai user '$u'!" -ForegroundColor Green
                    & $psqlCmd -U $u -h $dbHost -p $dbPort -d $dbName -f $sqlPath
                    if ($LASTEXITCODE -eq 0) {
                        $connected = $true
                        break
                    }
                }
            }
            if ($connected) { break }
        }

        if (-not $connected) {
            Write-Host "[!] Kredensial default (sein_pe_portal_secret_2026, postgres, Sein2016!) belum cocok." -ForegroundColor Yellow
            $manualUser = Read-Host "Masukkan username PostgreSQL [default: $dbUser]"
            if ([string]::IsNullOrWhiteSpace($manualUser)) { $manualUser = $dbUser }
            $manualPass = Read-Host "Masukkan password PostgreSQL untuk user '$manualUser'"
            $env:PGPASSWORD = $manualPass
            & $psqlCmd -U $manualUser -h $dbHost -p $dbPort -d $dbName -f $sqlPath
            if ($LASTEXITCODE -ne 0) {
                Write-Host "[ERROR] Gagal mengeksekusi script wipe dengan password yang dimasukkan." -ForegroundColor Red
                exit 1
            }
        }
    } else {
        Write-Host "[ERROR] Docker container pe-portal-postgres tidak aktif dan psql.exe tidak ditemukan di PATH." -ForegroundColor Red
        Write-Host "Silakan jalankan Docker compose atau jalankan SQL script secara manual:"
        Write-Host "  psql -U pe_portal -d pe_portal -f backend/scripts/wipe_mock_data.sql"
        exit 1
    }
}

Write-Host ""
Write-Host "[3/3] Database berhasil dibersihkan untuk Production Stage!" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host "  Portal siap digunakan dengan akun Administrator:" -ForegroundColor White
Write-Host "  Username : admin" -ForegroundColor Yellow
Write-Host "  Password : admin123 (atau password admin yang sudah diset)" -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Green
Write-Host ""
