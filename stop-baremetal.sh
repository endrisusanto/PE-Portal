#!/usr/bin/env bash
# ==============================================================================
# SEIN PE-Portal - Standalone Bare Metal Service Stopper
# Mode: /ponytail (Minimalist, clean shutdown)
# ==============================================================================

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Stopping PE-Portal bare metal services..."
if [ -f "$DIR/logs/backend.pid" ]; then
    kill "$(cat "$DIR/logs/backend.pid")" 2>/dev/null || true
    rm -f "$DIR/logs/backend.pid"
fi
if [ -f "$DIR/logs/frontend.pid" ]; then
    kill "$(cat "$DIR/logs/frontend.pid")" 2>/dev/null || true
    rm -f "$DIR/logs/frontend.pid"
fi

# Clean up any lingering node or backend processes on our ports
pkill -f "pe-portal-backend" 2>/dev/null || true
pkill -f "vite preview --port 3025" 2>/dev/null || true

echo "PE-Portal bare metal services stopped."
