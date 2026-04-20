# WineryClaw Deployment Guide

This guide explains how to deploy WineryClaw on a new computer with minimal setup.

## Prerequisites

- Node.js 22+ (recommended: Node.js 24)
- pnpm, npm, or bun
- macOS, Linux, or Windows (WSL2)

## Quick Start

### 1. Clone the Repository

```bash
git clone <your-fork-url>.git
cd WineryClaw
```

### 2. Install Dependencies

```bash
pnpm install
# or: npm install
# or: bun install
```

### 3. Build the Project

```bash
pnpm build
```

### 4. Start the Gateway

**Option A: Using the App (macOS)**
```bash
# Double-click "WineryClaw Gateway.app" in Finder
# Or run:
open "WineryClaw Gateway.app"
```

**Option B: Using the Script**
```bash
./start.sh
```

**Option C: Manual Start**
```bash
pnpm gateway:dev
```

### 5. Access the WebUI

Open your browser and go to: http://127.0.0.1:19001

---

## Configuration

Edit `.env.local` to customize settings:

```bash
cp .env.example .env.local
nano .env.local
```

### Available Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `WINERYCLAW_PORT` | `19001` | Gateway port |
| `WINERYCLAW_PM` | `pnpm` | Package manager (pnpm/npm/bun) |
| `WINERYCLAW_LAUNCH_MODE` | `background` | Launch mode (background/terminal) |
| `WINERYCLAW_AUTO_OPEN_BROWSER` | `true` | Auto-open browser on start |

---

## macOS App Installation

### For Development

The `WineryClaw Gateway.app` is already configured in the project.

1. Open Finder and navigate to the project directory
2. Drag `WineryClaw Gateway.app` to your Desktop or Applications folder
3. On first run, you may need to allow the app in System Settings > Privacy & Security

### Fixing "App Damaged" Error (macOS)

If macOS says the app is damaged:
```bash
xattr -cr "/path/to/WineryClaw Gateway.app"
```

---

## Data Portability

Your data is stored in:
- `~/.wineryclaw/` - Gateway configuration and credentials
- `~/.wineryclaw/sessions/` - Chat sessions
- `~/.wineryclaw/agents/` - Agent data

### Moving to a New Computer

1. Copy the entire project directory
2. Copy `~/.wineryclaw/` directory to the new computer
3. Run `pnpm install` again on the new computer
4. Start the gateway with `./start.sh`

---

## Troubleshooting

### Port Already in Use

If port 19001 is occupied, change it in `.env.local`:
```
WINERYCLAW_PORT=19002
```

### Permission Denied

Make scripts executable:
```bash
chmod +x start.sh
chmod +x "WineryClaw Gateway.app/Contents/MacOS/Application"
```

### pnpm Not Found

Install pnpm:
```bash
npm install -g pnpm
# or
curl -fsSL https://get.pnpm.io | sh
```

---

## Uninstall

### Stop the Service (macOS)

```bash
launchctl unload ~/Library/LaunchAgents/com.wineryclaw.gateway.plist
rm ~/Library/LaunchAgents/com.wineryclaw.gateway.plist
```

### Remove the App

```bash
rm -rf "/path/to/WineryClaw Gateway.app"
```

### Clean Up Data

```bash
rm -rf ~/.wineryclaw
```
