#!/usr/bin/env bash
# ==============================================================================
# SEIN PE-Portal - Standalone Bare Metal Updater (Linux)
# Mode: /ponytail (1-Click Pull, Recompile, & Restart)
# ==============================================================================
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "========================================================"
echo "  Updating SEIN PE-Portal Bare Metal Services"
echo "========================================================"

echo "[1/5] Stopping current services..."
"$DIR/stop-baremetal.sh" >/dev/null 2>&1 || true

echo "[2/5] Pulling latest code from GitHub..."
git pull origin main

echo "[3/5] Recompiling Go Backend..."
mkdir -p "$DIR/bin"
(cd "$DIR/backend" && go build -ldflags="-w -s" -o "$DIR/bin/pe-portal-backend" ./cmd/server)

echo "[4/5] Building Frontend SPA..."
(cd "$DIR/frontend" && npm install --silent && npm run build)

echo "[5/5] Restarting services..."
"$DIR/start-baremetal.sh"

echo "========================================================"
echo "  Update complete! New features are now live."
echo "========================================================"
