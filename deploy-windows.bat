@echo off
:: ============================================================================
:: SEIN PE-Portal Windows Auto-Deploy & Start Script
:: Mode: Ponytail (Minimalist, 1-Click Launch, Zero Unnecessary Boilerplate)
:: ============================================================================
chcp 65001 >nul
echo.
echo ========================================================
echo   SEIN PRODUCTION ENGINEER PORTAL - WINDOWS AUTO DEPLOY
echo ========================================================
echo.

:: 1. Check Docker Installation
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not installed or not in PATH!
    echo Please install Docker Desktop for Windows: https://www.docker.com/products/docker-desktop/
    echo Make sure Docker Desktop is started and WSL 2 is enabled.
    pause
    exit /b 1
)

:: 2. Check Docker Daemon is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker daemon is not running!
    echo Please launch Docker Desktop and wait until the whale icon is steady.
    pause
    exit /b 1
)

echo [1/4] Docker environment detected and running.

:: 3. Prepare Environment Config (.env)
if not exist ".env" (
    if exist ".env.example" (
        echo [2/4] .env not found. Copying defaults from .env.example...
        copy ".env.example" ".env" >nul
    ) else (
        echo [2/4] Creating default .env configuration...
        (
            echo FRONTEND_PORT=3025
            echo BACKEND_PORT=8085
            echo DB_PORT=5432
            echo REDIS_PORT=6379
            echo POSTGRES_DB=pe_portal
            echo POSTGRES_USER=pe_portal
            echo DB_PASSWORD=sein_pe_portal_secret_2026
            echo JWT_SECRET=pe_portal_jwt_secret_super_secure_key_2026_sein_pe_group_random_64
            echo GBA_API_URL=http://localhost:8089/api_kanban.php
        ) > .env
    )
) else (
    echo [2/4] Using existing .env configuration.
)

:: 4. Build and Start Services via Docker Compose
echo [3/4] Building and launching containers (PostgreSQL, Redis, Backend, Frontend)...
docker compose up -d --build

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Docker compose failed to build or start containers.
    echo Please review the error messages above.
    pause
    exit /b 1
)

:: 5. Open Web App in Browser
echo [4/4] Deployment successful!
echo.
echo ========================================================
echo   PE-Portal is now running:
echo   - Web App UI:  http://localhost:3025
echo   - API Backend: http://localhost:8085
echo   - Default Login: admin / admin123
echo ========================================================
echo.
echo Opening PE-Portal in your default browser...
start http://localhost:3025

echo.
echo Press any key to close this terminal (containers will keep running in background).
echo To stop containers later, run: docker compose down
pause >nul
