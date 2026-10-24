@echo off
:: ============================================================================
:: SEIN PE-Portal - Build Desktop Tray Manager (Windows)
:: ============================================================================
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo ========================================================
echo   Building SEIN PE-Portal Desktop Tray Manager
echo ========================================================
echo.

:: 1. Compile Backend Go binary
echo [1/3] Compiling Go Backend...
cd backend
go build -ldflags="-w -s" -o "..\bin\pe-portal-backend.exe" ./cmd/server
if %errorlevel% neq 0 (
    echo [ERROR] Backend compilation failed.
    cd ..
    pause
    exit /b 1
)
cd ..

:: 2. Compile Frontend UI
echo [2/3] Building Desktop Manager UI...
cd desktop
call npm install --silent
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Desktop UI build failed.
    cd ..
    pause
    exit /b 1
)

:: 3. Compile Tauri Desktop App
echo [3/3] Compiling Tauri Desktop Executable...
call npx tauri build
if %errorlevel% neq 0 (
    echo [ERROR] Tauri build failed.
    cd ..
    pause
    exit /b 1
)
cd ..

echo.
echo ========================================================
echo   PE-Portal Manager successfully built!
echo   Installer & Executable located in:
echo   desktop\src-tauri\target\release\bundle\
echo ========================================================
pause
