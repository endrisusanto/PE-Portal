# ============================================================================
# SEIN PE-Portal - Automated Bare Metal Deployment for Windows
# Mode: /ponytail (Minimalist, Automated 1-Click Setup, Zero Docker/VM Overhead)
# ============================================================================
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  SEIN PRODUCTION ENGINEER PORTAL - BARE METAL AUTO DEPLOY" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

$RootPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RootPath

function Check-And-Install ($cmd, $packageId, $name) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Host "[!] $name belum terdeteksi. Menginstal otomatis via winget..." -ForegroundColor Yellow
        try {
            winget install --id $packageId -e --silent --accept-package-agreements --accept-source-agreements
            Write-Host "[+] $name berhasil diinstal." -ForegroundColor Green
            # Refresh PATH in current session
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        } catch {
            Write-Host "[-] Gagal menginstal $name otomatis. Silakan instal manual: $packageId" -ForegroundColor Red
        }
    } else {
        Write-Host "[OK] $name terdeteksi ($cmd)." -ForegroundColor Green
    }
}

# 1. Pastikan Runtime Dasar Tersedia
Write-Host "--- [1/6] Memeriksa & Menginstal Runtimes ---" -ForegroundColor Cyan
Check-And-Install "git" "Git.Git" "Git for Windows"
Check-And-Install "go" "GoLang.Go" "Go Compiler (1.22+)"
Check-And-Install "node" "OpenJS.NodeJS.LTS" "Node.js LTS (20+)"
Check-And-Install "ffmpeg" "Gyan.FFmpeg" "FFmpeg Media Tool"

# 2. Database & Redis Services
Write-Host ""
Write-Host "--- [2/6] Memeriksa PostgreSQL & Redis ---" -ForegroundColor Cyan
Check-And-Install "psql" "PostgreSQL.PostgreSQL.16" "PostgreSQL 16 Server"
Check-And-Install "memurai-cli" "Memurai.Developer" "Memurai (Native Windows Redis)"

# Start services if registered as Windows Service
$pgServices = @("postgresql-x64-16", "postgresql-x64-15", "postgresql-x64-14", "postgresql")
foreach ($svc in $pgServices) {
    if (Get-Service -Name $svc -ErrorAction SilentlyContinue) {
        if ((Get-Service -Name $svc).Status -ne "Running") {
            Write-Host "Memulai Windows Service $svc..." -ForegroundColor Yellow
            Start-Service -Name $svc
        }
        break
    }
}

if (Get-Service -Name "memurai" -ErrorAction SilentlyContinue) {
    if ((Get-Service -Name "memurai").Status -ne "Running") {
        Write-Host "Memulai Windows Service memurai..." -ForegroundColor Yellow
        Start-Service -Name "memurai"
    }
}

# 3. Konfigurasi Environment (.env)
Write-Host ""
Write-Host "--- [3/6] Konfigurasi Environment (.env) ---" -ForegroundColor Cyan
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "[OK] File .env disalin dari .env.example." -ForegroundColor Green
    }
} else {
    Write-Host "[OK] File .env sudah ada." -ForegroundColor Green
}

# Pastikan folder penyimpanan lokal ada
$dirs = @("bin", "logs", "data\files")
foreach ($d in $dirs) {
    if (-not (Test-Path $d)) {
        New-Item -ItemType Directory -Path $d -Force | Out-Null
    }
}

# 4. Inisialisasi Database PostgreSQL
Write-Host ""
Write-Host "--- [4/6] Inisialisasi Database PostgreSQL ---" -ForegroundColor Cyan

# ponytail: auto-locate psql.exe if not directly in PATH
$psqlCmd = Get-Command "psql" -ErrorAction SilentlyContinue
if (-not $psqlCmd) {
    $foundPsql = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($foundPsql) {
        $psqlBinDir = Split-Path -Parent $foundPsql.FullName
        $env:Path = "$psqlBinDir;$env:Path"
        $psqlCmd = $foundPsql.FullName
    }
} else {
    $psqlCmd = "psql"
}

if ($psqlCmd) {
    Write-Host "Mengonfigurasi Role & Database 'pe_portal'..." -ForegroundColor Yellow
    try {
        & $psqlCmd -U postgres -h localhost -c "CREATE ROLE pe_portal WITH LOGIN PASSWORD 'Sein2016!' SUPERUSER;" 2>$null
        & $psqlCmd -U postgres -h localhost -c "CREATE DATABASE pe_portal OWNER pe_portal;" 2>$null
        Write-Host "[OK] Database dan Role 'pe_portal' siap." -ForegroundColor Green
    } catch {
        Write-Host "[Note] Jalankan manual jika postgres meminta password khusus: psql -U postgres" -ForegroundColor Yellow
    }
} else {
    Write-Host "[Note] psql belum terdeteksi di PATH. Pastikan DB 'pe_portal' dapat diakses via .env." -ForegroundColor Yellow
}

# 5. Build Backend & Frontend
Write-Host ""
Write-Host "--- [5/6] Kompilasi Backend & Frontend ---" -ForegroundColor Cyan
Write-Host "Mengompilasi Go Backend..." -ForegroundColor Yellow
Push-Location backend
go mod download
go build -ldflags="-w -s" -o "..\bin\pe-portal-backend.exe" ./cmd/server
Pop-Location
Write-Host "[OK] Binary Backend selesai: bin\pe-portal-backend.exe" -ForegroundColor Green

Write-Host "Membangun Frontend SPA..." -ForegroundColor Yellow
Push-Location frontend
npm install --silent
npm run build
Pop-Location
Write-Host "[OK] Frontend build selesai: frontend\dist" -ForegroundColor Green

# 6. Registrasi Windows Auto-Start (Opsional Shortcut Startup)
Write-Host ""
Write-Host "--- [6/6] Konfigurasi Auto-Start Windows ---" -ForegroundColor Cyan
$StartupFolder = [Environment]::GetFolderPath("Startup")
$ShortcutPath = Join-Path $StartupFolder "SEIN-PE-Portal.lnk"
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = (Join-Path $RootPath "start-baremetal.bat")
$Shortcut.WorkingDirectory = $RootPath
$Shortcut.WindowStyle = 7 # Minimized
$Shortcut.Description = "SEIN Production Engineer Portal Auto-Start"
$Shortcut.Save()
Write-Host "[OK] Shortcut Auto-Start dibuat di: $ShortcutPath" -ForegroundColor Green

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Instalasi Bare Metal Windows Selesai!" -ForegroundColor Green
Write-Host "  Portal akan otomatis berjalan setiap Windows booting." -ForegroundColor Green
Write-Host "  Memulai aplikasi sekarang..." -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# Jalankan portal sekarang
Start-Process (Join-Path $RootPath "start-baremetal.bat")
