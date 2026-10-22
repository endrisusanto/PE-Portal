#!/usr/bin/env bash
# ==============================================================================
# SEIN PE-Portal - Standalone Bare Metal Service Runner
# Mode: /ponytail (Minimalist, lightweight background runner)
# ==============================================================================

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

mkdir -p "$DIR/logs" "$DIR/data/files"

# Ensure postgres & redis services are running if systemctl is available
if command -v systemctl >/dev/null 2>&1; then
    sudo systemctl start postgresql 2>/dev/null || true
    sudo systemctl start redis-server 2>/dev/null || sudo systemctl start redis 2>/dev/null || true
fi

# Stop existing running processes if any
"$DIR/stop-baremetal.sh" >/dev/null 2>&1 || true

# Check if backend binary exists; if not, compile it
if [ ! -f "$DIR/bin/pe-portal-backend" ]; then
    echo "Compiling backend binary..."
    mkdir -p "$DIR/bin"
    (cd "$DIR/backend" && go build -o "$DIR/bin/pe-portal-backend" cmd/server/main.go)
fi

echo "Starting PE-Portal Backend (Port 8085)..."
"$DIR/bin/pe-portal-backend" > "$DIR/logs/backend.log" 2>&1 &
echo $! > "$DIR/logs/backend.pid"

echo "Starting PE-Portal Frontend (Port 3025)..."
(cd "$DIR/frontend" && npm run preview -- --port 3025 --host) > "$DIR/logs/frontend.log" 2>&1 &
echo $! > "$DIR/logs/frontend.pid"

sleep 2

if ps -p $(cat "$DIR/logs/backend.pid") > /dev/null 2>&1 && ps -p $(cat "$DIR/logs/frontend.pid") > /dev/null 2>&1; then
    echo -e "\033[0;32m✓ SEIN PE-Portal is running successfully!\033[0m"
    echo -e "  - Frontend UI:  \033[1;33mhttp://localhost:3025\033[0m"
    echo -e "  - Backend API:  \033[1;33mhttp://localhost:8085\033[0m"
    echo -e "  - Logs:         $DIR/logs/"
    echo -e "  - Stop Command: ./stop-baremetal.sh"
else
    echo -e "\033[0;31m[!] Check logs in $DIR/logs/ for troubleshooting.\033[0m"
fi
