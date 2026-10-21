@echo off
:: ============================================================================
:: SEIN PE-Portal - Standalone Bare Metal Windows Runner
:: Mode: /ponytail (Minimalist, Native Process Launcher)
:: ============================================================================
chcp 65001 >nul
echo.
echo ========================================================
echo   Starting SEIN PE-Portal Services (Bare Metal)
echo ========================================================
echo.

if not exist "bin\pe-portal-backend.exe" (
    echo Compiling backend binary...
    cd backend
    call go build -o "..\bin\pe-portal-backend.exe" cmd\server\main.go
    cd ..
)

echo Starting Backend on port 8085...
start "PE-Portal Backend (Port 8085)" /min "bin\pe-portal-backend.exe"

echo Starting Frontend Preview on port 3025...
cd frontend
start "PE-Portal Frontend (Port 3025)" /min cmd /c "npm run preview -- --port 3025 --host"
cd ..

timeout /t 3 >nul
echo.
echo ========================================================
echo   PE-Portal is now running natively:
echo   - Web App UI:  http://localhost:3025
echo   - API Backend: http://localhost:8085
echo   - Default Login: admin / admin123
echo ========================================================
echo Opening browser...
start http://localhost:3025
