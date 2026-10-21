# ============================================================================
# SEIN PE-Portal Windows Auto-Deploy PowerShell Script
# Mode: Ponytail (Fast, Clean, 1-Click Launch)
# ============================================================================
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  SEIN PRODUCTION ENGINEER PORTAL - WINDOWS AUTO DEPLOY" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# 1. Check Docker
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Docker is not installed or not in PATH." -ForegroundColor Red
    Write-Host "Please install Docker Desktop: https://www.docker.com/products/docker-desktop/"
    pause
    exit 1
}

# 2. Check Docker Daemon
docker info >$null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Docker daemon is not running. Please start Docker Desktop." -ForegroundColor Red
    pause
    exit 1
}

Write-Host "[1/4] Docker environment ready." -ForegroundColor Green

# 3. Check .env
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Write-Host "[2/4] Copying default .env from .env.example..." -ForegroundColor Yellow
        Copy-Item ".env.example" ".env"
    }
} else {
    Write-Host "[2/4] Config file .env found." -ForegroundColor Green
}

# 4. Build and Launch
Write-Host "[3/4] Building and launching containers..." -ForegroundColor Yellow
docker compose up -d --build

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Docker Compose failed to launch services." -ForegroundColor Red
    pause
    exit 1
}

# 5. Open Web App
Write-Host "[4/4] Deployment successful!" -ForegroundColor Green
Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  PE-Portal is running at:" -ForegroundColor White
Write-Host "  - Frontend: http://localhost:3025" -ForegroundColor Yellow
Write-Host "  - Backend:  http://localhost:8085" -ForegroundColor Yellow
Write-Host "  - Default:  admin / admin123" -ForegroundColor White
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

Start-Process "http://localhost:3025"
