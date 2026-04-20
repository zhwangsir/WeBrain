#!/bin/bash
# WineryClaw Gateway Launcher
# Cross-platform startup script - works on macOS, Linux, and Windows (WSL)

set -e

# Get script directory (works across platforms)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load configuration from .env.local if exists
if [ -f "$SCRIPT_DIR/.env.local" ]; then
    export $(grep -v '^#' "$SCRIPT_DIR/.env.local" | xargs)
fi

# Default values
WINERYCLAW_PORT="${WINERYCLAW_PORT:-19001}"
WINERYCLAW_PM="${WINERYCLAW_PM:-pnpm}"
WINERYCLAW_AUTO_OPEN_BROWSER="${WINERYCLAW_AUTO_OPEN_BROWSER:-true}"
LAUNCH_MODE="${WINERYCLAW_LAUNCH_MODE:-terminal}"

# Detect OS
detect_os() {
    case "$(uname -s)" in
        Darwin*)  echo "macos" ;;
        Linux*)   echo "linux" ;;
        CYGWIN*|MINGW*|MSYS*) echo "windows" ;;
        *)        echo "unknown" ;;
    esac
}

# Find Node.js package manager
find_pm() {
    local pm="$1"
    case "$pm" in
        pnpm)
            if command -v pnpm &> /dev/null; then
                echo "pnpm"
            elif [ -f "$HOME/.nvm/versions/node/v24.14.1/bin/pnpm" ]; then
                echo "$HOME/.nvm/versions/node/v24.14.1/bin/pnpm"
            else
                echo "pnpm"
            fi
            ;;
        npm)
            echo "npm"
            ;;
        bun)
            echo "bun"
            ;;
        *)
            echo "pnpm"
            ;;
    esac
}

# Run gateway in background (no terminal window)
run_background() {
    local pm_cmd=$(find_pm "$WINERYCLAW_PM")
    cd "$SCRIPT_DIR"

    if [ "$(detect_os)" = "macos" ]; then
        # Use LaunchAgent for macOS background
        PLIST_PATH="$HOME/Library/LaunchAgents/com.wineryclaw.gateway.plist"
        mkdir -p "$HOME/Library/LaunchAgents"

        cat > "$PLIST_PATH" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.wineryclaw.gateway</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>-c</string>
        <string>cd $SCRIPT_DIR && $pm_cmd gateway:dev</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/wineryclaw-gateway.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/wineryclaw-gateway.error.log</string>
    <key>ProcessType</key>
    <string>Background</string>
</dict>
</plist>
EOF
        chmod 644 "$PLIST_PATH"
        launchctl unload "$PLIST_PATH" 2>/dev/null || true
        launchctl load "$PLIST_PATH"

        if [ "$WINERYCLAW_AUTO_OPEN_BROWSER" = "true" ]; then
            sleep 3
            open "http://127.0.0.1:$WINERYCLAW_PORT"
        fi

        echo "WineryClaw Gateway started in background (macOS LaunchAgent)"
    else
        # Use nohup for Linux
        nohup $pm_cmd gateway:dev > /tmp/wineryclaw-gateway.log 2>&1 &
        echo "WineryClaw Gateway started in background (nohup)"

        if [ "$WINERYCLAW_AUTO_OPEN_BROWSER" = "true" ]; then
            sleep 3
            if command -v xdg-open &> /dev/null; then
                xdg-open "http://127.0.0.1:$WINERYCLAW_PORT"
            fi
        fi
    fi
}

# Run gateway in terminal
run_terminal() {
    local pm_cmd=$(find_pm "$WINERYCLAW_PM")
    cd "$SCRIPT_DIR"
    $pm_cmd gateway:dev
}

# Main
main() {
    echo "Starting WineryClaw Gateway..."
    echo "  Port: $WINERYCLAW_PORT"
    echo "  Package Manager: $WINERYCLAW_PM"
    echo "  Launch Mode: $LAUNCH_MODE"
    echo ""

    if [ "$LAUNCH_MODE" = "background" ]; then
        run_background
    else
        run_terminal
    fi
}

main "$@"
