#!/bin/bash
# WeBrain Integration Platform - One-Command Launcher
# Zero security, full local mode

set -e

echo "======================================"
echo "  WeBrain Integration Platform"
echo "  Main Brain (Hermes) + Sub Brain (OpenClaw) + Dokobot"
echo "======================================"
echo ""

# Create data directories
mkdir -p data/{main-brain,sub-brain,dokobot,shared}

# Check if Docker is available
if command -v docker-compose &> /dev/null; then
    echo "[+] Starting with Docker Compose..."
    docker-compose up --build -d
    echo ""
    echo "Services started:"
    echo "  Main Brain:  http://localhost:18790"
    echo "  Sub Brain:   http://localhost:9797"
    echo "  Frontend:    http://localhost:8587"
    echo "  Dokobot:     http://localhost:9222"
    echo ""
    echo "Logs: docker-compose logs -f"
    exit 0
fi

# Fallback: start services directly
echo "[+] Docker not found, starting services directly..."

# Start Main Brain (Python)
echo "[+] Starting Main Brain (Hermes) on port 18790..."
cd sub-brain/main-brain
pip install -r requirements.txt -q 2>/dev/null || true
python -m main_brain --host 127.0.0.1 --port 18790 &
MAIN_PID=$!
cd ../..

sleep 3

# Start Sub Brain (Node.js)
echo "[+] Starting Sub Brain (OpenClaw) on port 9797..."
cd sub-brain
npm install -g pnpm 2>/dev/null || true
pnpm install 2>/dev/null || true
pnpm build 2>/dev/null || true
pnpm start &
SUB_PID=$!
cd ..

sleep 3

# Start Frontend
echo "[+] Starting Frontend on port 8587..."
cd frontend
pnpm install 2>/dev/null || true
pnpm dev &
FRONT_PID=$!
cd ..

echo ""
echo "======================================"
echo "  All services started!"
echo "======================================"
echo "  Main Brain:  http://localhost:18790"
echo "  Sub Brain:   http://localhost:9797"
echo "  Frontend:    http://localhost:8587"
echo ""
echo "  Press Ctrl+C to stop all services"
echo "======================================"

# Graceful shutdown
trap 'echo ""; echo "[+] Stopping services..."; kill $MAIN_PID $SUB_PID $FRONT_PID 2>/dev/null; exit 0' INT TERM

wait
