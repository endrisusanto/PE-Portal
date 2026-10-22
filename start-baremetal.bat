@echo off
:: ============================================================================
:: SEIN PE-Portal - Standalone Bare Metal Windows Runner
:: Mode: /ponytail (Minimalist, Native Process Launcher)
:: ============================================================================
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo ========================================================
echo   Starting SEIN PE-Portal Services (Bare Metal)
echo ========================================================
echo.

:: Add PostgreSQL to PATH if present
if exist "C:\Program Files\PostgreSQL\16\bin" set "PATH=C:\Program Files\PostgreSQL\16\bin;%PATH%"

:: Check & ensure PostgreSQL and Redis services are running if registered
sc query postgresql-x64-16 >nul 2>&1
if %errorlevel% equ 0 net start postgresql-x64-16 >nul 2>&1

sc query memurai >nul 2>&1
if %errorlevel% equ 0 net start memurai >nul 2>&1

sc query redis >nul 2>&1
if %errorlevel% equ 0 net start redis >nul 2>&1

if not exist "bin\pe-portal-backend.exe" (
    echo Compiling backend binary...
    cd backend
    call go build -ldflags="-w -s" -o "..\bin\pe-portal-backend.exe" ./cmd/server
    cd ..
)

echo Starting Backend on port 8085...
start "PE-Portal Backend (Port 8085)" /min "bin\pe-portal-backend.exe"

echo Starting Frontend Preview on port 3025...
cd frontend
start "PE-Portal Frontend (Port 3025)" /min cmd /c "npm.cmd run preview -- --port 3025 --host 0.0.0.0"
cd ..

ping 127.0.0.1 -n 4 >nul
echo.
echo ========================================================
echo   PE-Portal is now running natively:
echo   - Web App UI:  http://localhost:3025
echo   - API Backend: http://localhost:8085
echo   - Default Login: admin / admin123
echo ========================================================
echo Opening browser...
start http://localhost:3025
