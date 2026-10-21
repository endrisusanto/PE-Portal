@echo off
:: ============================================================================
:: SEIN PE-Portal - Bare Metal Automated Installer (Windows Batch)
:: Mode: /ponytail (Minimalist, 1-Click Launch, Native Runtimes)
:: ============================================================================
chcp 65001 >nul
echo.
echo ========================================================
echo   SEIN PRODUCTION ENGINEER PORTAL - BARE METAL INSTALL
echo ========================================================
echo.

:: 1. Check Git
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Git is not installed or not in PATH!
    echo Please install Git for Windows: https://git-scm.com/download/win
    pause
    exit /b 1
)

:: 2. Check Repo Directory
if not exist "backend\cmd\server\main.go" (
    if not exist "PE-Portal\backend\cmd\server\main.go" (
        echo [1/5] Cloning repository...
        git clone https://github.com/endrisusanto/PE-Portal.git
        cd PE-Portal
    ) else (
        cd PE-Portal
    )
)
echo [1/5] Repository ready: %cd%

:: 3. Check Go runtime
where go >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Go (1.22+) is not installed or not in PATH!
    echo Please install Go from: https://go.dev/dl/
    pause
    exit /b 1
)
echo [2/5] Go runtime detected.

:: 4. Check Node.js & npm
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js (20+ LTS) is not installed or not in PATH!
    echo Please install Node.js from: https://nodejs.org/
    pause
    exit /b 1
)
echo [3/5] Node.js runtime detected.

:: 5. Prepare .env
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
    )
)
if not exist "data\files" mkdir "data\files"
if not exist "bin" mkdir "bin"
if not exist "logs" mkdir "logs"
echo [4/5] Environment directories initialized.

:: 6. Build Backend and Frontend
echo [5/5] Building backend and frontend...
cd backend
call go mod download
call go build -o "..\bin\pe-portal-backend.exe" cmd\server\main.go
cd ..\frontend
call npm install
call npm run build
cd ..

echo.
echo ========================================================
echo   Bare Metal Installation Completed!
echo ========================================================
echo   To start services natively:
echo   Run: start-baremetal.bat
echo ========================================================
echo.
pause
