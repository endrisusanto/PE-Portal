@echo off
REM ============================================================================
REM SEIN PE-Portal: Production Clean Wipe Script (Windows CMD Launcher)
REM ============================================================================
cd /d "%~dp0"
echo Memulai script pembersihan database PE-Portal...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0wipe-database.ps1"
echo.
pause
