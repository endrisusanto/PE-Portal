@echo off
:: ============================================================================
:: SEIN PE-Portal - Standalone Bare Metal Windows Stopper
:: Mode: /ponytail (Minimalist, clean shutdown)
:: ============================================================================
chcp 65001 >nul
echo.
echo ========================================================
echo   Stopping SEIN PE-Portal Bare Metal Services...
echo ========================================================
echo.

taskkill /F /IM "pe-portal-backend.exe" 2>nul
taskkill /F /IM "pe-portal-manager.exe" 2>nul
taskkill /F /FI "WINDOWTITLE eq PE-Portal*" 2>nul

echo All PE-Portal bare metal services stopped.
timeout /t 2 >nul
