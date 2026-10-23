@echo off
:: ============================================================================
:: SEIN PE-Portal - Standalone Bare Metal Windows Updater
:: Mode: /ponytail (1-Click Pull, Recompile, & Restart)
:: ============================================================================
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo ========================================================
echo   Updating SEIN PE-Portal Bare Metal (Windows)
echo ========================================================
echo.

:: 1. Stop running services
echo [1/5] Menghentikan service yang sedang berjalan...
call stop-baremetal.bat >nul 2>&1

:: 2. Pull latest code from GitHub
echo [2/5] Mengambil update code terbaru dari GitHub...
git pull origin main
if %errorlevel% neq 0 (
    echo [ERROR] Gagal git pull. Pastikan koneksi internet aktif atau tidak ada conflict lokal.
    pause
    exit /b 1
)

:: 3. Rebuild Go Backend Binary
echo [3/5] Mengompilasi ulang Backend Go...
cd backend
go build -ldflags="-w -s" -o "..\bin\pe-portal-backend.exe" ./cmd/server
if %errorlevel% neq 0 (
    echo [ERROR] Kompilasi backend gagal.
    cd ..
    pause
    exit /b 1
)
cd ..

:: 4. Rebuild Frontend SPA
echo [4/5] Membangun ulang Frontend UI (dist)...
cd frontend
call npm install --silent
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Build frontend gagal.
    cd ..
    pause
    exit /b 1
)
cd ..

:: 5. Restart Services
echo [5/5] Menjalankan kembali PE-Portal...
call start-baremetal.bat
