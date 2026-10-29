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

# Tambahkan path PostgreSQL & tools jika ada di Program Files tapi belum ada di PATH
$candidatePaths = @(
    "C:\Program Files\PostgreSQL\16\bin",
    "C:\Program Files\PostgreSQL\15\bin",
    "C:\Program Files\PostgreSQL\14\bin",
    "C:\Program Files\Memurai",
    "C:\Program Files\Redis",
    "C:\Program Files\Git\cmd",
    "C:\Program Files\Go\bin",
    "C:\Program Files\nodejs"
)

foreach ($dir in $candidatePaths) {
    if (Test-Path $dir) {
        if ($env:Path -notlike "*$dir*") {
            $env:Path = "$dir;" + $env:Path
        }
    }
}

function Check-And-Install ($cmd, $packageId, $name, [switch]$Optional) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Host "[!] $name belum terdeteksi. Mencoba instalasi otomatis via winget..." -ForegroundColor Yellow
        try {
            $proc = Start-Process winget -ArgumentList "install --id $packageId -e --silent --accept-package-agreements --accept-source-agreements" -NoNewWindow -Wait -PassThru -ErrorAction SilentlyContinue
            if ($proc.ExitCode -eq 0) {
                Write-Host "[+] $name berhasil diinstal." -ForegroundColor Green
                $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
            } else {
                if ($Optional) {
                    Write-Host "[i] $name dilewati (opsional untuk mode bare-metal)." -ForegroundColor DarkGray
                } else {
                    Write-Host "[-] Gagal menginstal $name otomatis. Silakan instal manual: $packageId" -ForegroundColor Yellow
                }
            }
        } catch {
            if ($Optional) {
                Write-Host "[i] $name dilewati (opsional)." -ForegroundColor DarkGray
            } else {
                Write-Host "[-] Gagal menginstal $name otomatis: $_" -ForegroundColor Red
            }
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
Check-And-Install "python" "Python.Python.3.11" "Python 3 Runtime" -Optional
Check-And-Install "ffmpeg" "Gyan.FFmpeg.Essentials" "FFmpeg Media Tool" -Optional

# Instal paket Python esensial untuk PDF WI Translator dan PPTX Summary
try {
    Write-Host "[i] Memeriksa & menginstal paket Python pendukung (pypdf, reportlab, openpyxl)..." -ForegroundColor Yellow
    Start-Process python -ArgumentList "-m pip install --quiet pypdf reportlab openpyxl" -NoNewWindow -Wait -ErrorAction SilentlyContinue
} catch {}

# 2. Database & Redis Services
Write-Host ""
Write-Host "--- [2/6] Memeriksa PostgreSQL & Redis ---" -ForegroundColor Cyan
Check-And-Install "psql" "PostgreSQL.PostgreSQL.16" "PostgreSQL 16 Server"
Check-And-Install "memurai-cli" "Memurai.MemuraiDeveloper" "Memurai (Native Windows Redis)" -Optional

# Start services if registered as Windows Service
$pgServices = @("postgresql-x64-16", "postgresql-x64-15", "postgresql-x64-14", "postgresql")
foreach ($svc in $pgServices) {
    if (Get-Service -Name $svc -ErrorAction SilentlyContinue) {
        if ((Get-Service -Name $svc).Status -ne "Running") {
            Write-Host "Memulai Windows Service $svc..." -ForegroundColor Yellow
            Start-Service -Name $svc -ErrorAction SilentlyContinue
        } else {
            Write-Host "[OK] Service $svc sedang berjalan." -ForegroundColor Green
        }
        break
    }
}

$redisServices = @("memurai", "redis")
foreach ($rsvc in $redisServices) {
    if (Get-Service -Name $rsvc -ErrorAction SilentlyContinue) {
        if ((Get-Service -Name $rsvc).Status -ne "Running") {
            Write-Host "Memulai Windows Service $rsvc..." -ForegroundColor Yellow
            Start-Service -Name $rsvc -ErrorAction SilentlyContinue
        } else {
            Write-Host "[OK] Service $rsvc sedang berjalan." -ForegroundColor Green
        }
        break
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
try {
    # Ambil DB_PASSWORD dari .env jika ada
    $dbPass = "Sein2016!"
    if (Test-Path ".env") {
        $lines = Get-Content ".env"
        foreach ($l in $lines) {
            if ($l -match "^\s*DB_PASSWORD\s*=\s*(.+)") {
                $dbPass = $matches[1].Trim()
            }
        }
    }

    $env:PGPASSWORD = $dbPass
    $initSql = @"
DO `$do`$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'pe_portal') THEN
      CREATE ROLE pe_portal WITH LOGIN PASSWORD '$dbPass' SUPERUSER;
   ELSE
      ALTER ROLE pe_portal WITH PASSWORD '$dbPass';
   END IF;
END
`$do`$;
SELECT 'CREATE DATABASE pe_portal OWNER pe_portal' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'pe_portal')\gexec
"@
    $initSqlPath = Join-Path $RootPath "data\init_portal_db.sql"
    Set-Content -Path $initSqlPath -Value $initSql -Encoding UTF8
    
    $psqlCmd = "psql"
    if (-not (Get-Command "psql" -ErrorAction SilentlyContinue)) {
        $potentialPsql = @("C:\Program Files\PostgreSQL\16\bin\psql.exe", "C:\Program Files\PostgreSQL\15\bin\psql.exe", "C:\Program Files\PostgreSQL\14\bin\psql.exe")
        foreach ($cand in $potentialPsql) {
            if (Test-Path $cand) {
                $psqlCmd = $cand
                $psqlDir = Split-Path -Parent $cand
                if ($env:Path -notlike "*$psqlDir*") { $env:Path = "$psqlDir;" + $env:Path }
                break
            }
        }
    }
    
    & $psqlCmd -U postgres -h 127.0.0.1 -f $initSqlPath *>$null
    Remove-Item -Force $initSqlPath -ErrorAction SilentlyContinue
    Write-Host "[OK] Database dan Role 'pe_portal' siap." -ForegroundColor Green
} catch {
    Write-Host "[Note] Inisialisasi DB otomatis: $_ (melanjutkan ke kompilasi)." -ForegroundColor Yellow
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
try {
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
} catch {
    Write-Host "[Note] Shortcut auto-start dilewati." -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Instalasi Bare Metal Windows Selesai!" -ForegroundColor Green
Write-Host "  Portal akan otomatis berjalan setiap Windows booting." -ForegroundColor Green
Write-Host "  Memulai aplikasi sekarang..." -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# Jalankan portal sekarang
Start-Process (Join-Path $RootPath "start-baremetal.bat")
