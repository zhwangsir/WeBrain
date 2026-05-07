#!/bin/bash
# WeBrain macOS App Packager v1.0.0
# Creates a double-clickable .app bundle for macOS

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PROJECT_DIR/build"
APP_NAME="WeBrain"
APP_BUNDLE="$BUILD_DIR/$APP_NAME.app"
VERSION="1.0.0"

echo "=== WeBrain macOS Packager v$VERSION ==="
echo "Project: $PROJECT_DIR"

# Clean and create structure
rm -rf "$BUILD_DIR"
mkdir -p "$APP_BUNDLE/Contents/"{MacOS,Resources}

# ========== 1. Build frontend ==========
echo "[1/6] Building frontend..."
cd "$PROJECT_DIR/frontend"
if ! pnpm build >/dev/null 2>&1; then
  echo "ERROR: Frontend build failed."
  exit 1
fi

# ========== 2. Copy frontend dist ==========
echo "[2/6] Copying frontend dist..."
mkdir -p "$APP_BUNDLE/Contents/Resources/frontend"
cp -R "$PROJECT_DIR/frontend/dist" "$APP_BUNDLE/Contents/Resources/frontend/dist"

# ========== 3. Copy main-brain (Python) ==========
echo "[3/6] Copying main-brain..."
mkdir -p "$APP_BUNDLE/Contents/Resources/sub-brain/main-brain"
rsync -a --exclude='__pycache__' --exclude='*.pyc' --exclude='.pytest_cache' --exclude='htmlcov' \
  "$PROJECT_DIR/sub-brain/main-brain/" "$APP_BUNDLE/Contents/Resources/sub-brain/main-brain/"

# ========== 4. Copy sub-brain (Node.js) ==========
echo "[4/6] Copying sub-brain source..."
mkdir -p "$APP_BUNDLE/Contents/Resources/sub-brain/src"
cp -R "$PROJECT_DIR/sub-brain/src" "$APP_BUNDLE/Contents/Resources/sub-brain/"
cp "$PROJECT_DIR/sub-brain/package.json" "$APP_BUNDLE/Contents/Resources/sub-brain/"

# ========== 5. Install production node_modules in the bundle ==========
echo "[5/6] Installing production node_modules in bundle..."
cd "$APP_BUNDLE/Contents/Resources/sub-brain"
cp "$PROJECT_DIR/sub-brain/pnpm-lock.yaml" . 2>/dev/null || true
pnpm install --prod --no-frozen-lockfile 2>&1 | tail -5

# Ensure tsx is available
if [ ! -d "node_modules/tsx" ]; then
  echo "       Installing tsx (required for runtime)..."
  pnpm add tsx 2>&1 | tail -3
fi

# ========== 6. Create Info.plist ==========
echo "[6/6] Creating app bundle metadata..."
cat > "$APP_BUNDLE/Contents/Info.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleExecutable</key>
  <string>webrain-launcher</string>
  <key>CFBundleIdentifier</key>
  <string>com.webrain.app</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>WeBrain</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSMinimumSystemVersion</key>
  <string>12.0</string>
  <key>LSUIElement</key>
  <false/>
  <key>NSHumanReadableCopyright</key>
  <string>Copyright 2026 WeBrain</string>
</dict>
</plist>
PLIST

# ========== 7. Create launcher script ==========
cat > "$APP_BUNDLE/Contents/MacOS/webrain-launcher" << 'LAUNCHER'
#!/bin/bash
# WeBrain Launcher

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RESOURCES="$APP_DIR/Contents/Resources"
PID_FILE="/tmp/webrain-$(id -u).pid"
LOG_DIR="$HOME/Library/Logs/WeBrain"
mkdir -p "$LOG_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[WeBrain]${NC} $1" | tee -a "$LOG_DIR/launcher.log"; }
log_warn() { echo -e "${YELLOW}[WeBrain]${NC} $1" | tee -a "$LOG_DIR/launcher.log"; }
log_error() { echo -e "${RED}[WeBrain]${NC} $1" | tee -a "$LOG_DIR/launcher.log"; }

cleanup() {
  log_info "Shutting down..."
  if [ -f "$PID_FILE" ]; then
    while read -r pid; do
      kill "$pid" 2>/dev/null || true
    done < "$PID_FILE"
    rm -f "$PID_FILE"
  fi
  exit 0
}

trap cleanup SIGINT SIGTERM

check_deps() {
  local missing=()
  if ! command -v node >/dev/null 2>&1; then missing+=("Node.js (brew install node)"); fi
  if ! command -v python3 >/dev/null 2>&1; then missing+=("Python 3"); fi
  if ! python3 -c "import uvicorn" 2>/dev/null; then missing+=("uvicorn (pip3 install uvicorn)"); fi
  if ! python3 -c "import httpx" 2>/dev/null; then missing+=("httpx (pip3 install httpx)"); fi
  if ! python3 -c "import fastapi" 2>/dev/null; then missing+=("fastapi (pip3 install fastapi)"); fi
  if [ ${#missing[@]} -gt 0 ]; then
    log_error "Missing dependencies:"
    for dep in "${missing[@]}"; do echo "  - $dep"; done
    osascript -e 'display dialog "WeBrain requires Node.js and Python 3 with uvicorn/fastapi/httpx.\n\nInstall with:\n  brew install node\n  pip3 install uvicorn fastapi httpx croniter\n\nThen try again." buttons {"OK"} default button "OK" with icon stop with title "WeBrain"' 2>/dev/null || true
    exit 1
  fi
}

start_services() {
  log_info "Starting WeBrain v1.0.0..."
  > "$PID_FILE"
  
  cd "$RESOURCES/sub-brain"
  
  WEBRAIN_EMBEDDED=1 \
  WEBRAIN_SUB_BRAIN_PORT=9797 \
  WEBRAIN_PYTHON=python3 \
    node --import tsx src/main.ts \
    >> "$LOG_DIR/sub-brain.log" 2>&1 &
  
  SUB_PID=$!
  echo $SUB_PID >> "$PID_FILE"
  log_info "Services starting (PID: $SUB_PID)..."
  
  local retries=0
  while [ $retries -lt 60 ]; do
    if curl -s http://127.0.0.1:9797/health >/dev/null 2>&1; then
      log_info "Ready! Opening browser..."
      open "http://localhost:9797"
      break
    fi
    sleep 1
    retries=$((retries + 1))
    printf "."
  done
  echo
  
  if [ $retries -eq 60 ]; then
    log_error "Services failed to start. Check ~/Library/Logs/WeBrain/"
    osascript -e 'display dialog "WeBrain failed to start. Check logs in ~/Library/Logs/WeBrain/" buttons {"OK"} default button "OK" with icon stop with title "WeBrain"' 2>/dev/null || true
    exit 1
  fi
  
  wait $SUB_PID
}

check_deps
start_services
LAUNCHER

chmod +x "$APP_BUNDLE/Contents/MacOS/webrain-launcher"

# Create placeholder icon
touch "$APP_BUNDLE/Contents/Resources/.icon-placeholder"

# ========== 8. Summary ==========
echo ""
echo "========================================"
echo "  ✅ WeBrain.app built successfully!"
echo "========================================"
echo "  Location: $APP_BUNDLE"
echo "  Size:     $(du -sh "$APP_BUNDLE" | cut -f1)"
echo ""
echo "  To run:"
echo "    open '$APP_BUNDLE'"
echo ""
echo "  Requirements:"
echo "    - Node.js v20+  (brew install node)"
echo "    - Python 3.9+   (preinstalled on macOS)"
echo "    - pip3 install uvicorn fastapi httpx sqlite3 croniter"
echo ""
