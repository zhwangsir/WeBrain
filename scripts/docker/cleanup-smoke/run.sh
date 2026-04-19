#!/usr/bin/env bash
set -euo pipefail

cd /repo

export WINERYCLAW_STATE_DIR="/tmp/openclaw-test"
export WINERYCLAW_CONFIG_PATH="${WINERYCLAW_STATE_DIR}/openclaw.json"

echo "==> Build"
if ! pnpm build >/tmp/openclaw-cleanup-build.log 2>&1; then
  cat /tmp/openclaw-cleanup-build.log
  exit 1
fi

echo "==> Seed state"
mkdir -p "${WINERYCLAW_STATE_DIR}/credentials"
mkdir -p "${WINERYCLAW_STATE_DIR}/agents/main/sessions"
echo '{}' >"${WINERYCLAW_CONFIG_PATH}"
echo 'creds' >"${WINERYCLAW_STATE_DIR}/credentials/marker.txt"
echo 'session' >"${WINERYCLAW_STATE_DIR}/agents/main/sessions/sessions.json"

echo "==> Reset (config+creds+sessions)"
if ! pnpm openclaw reset --scope config+creds+sessions --yes --non-interactive >/tmp/openclaw-cleanup-reset.log 2>&1; then
  cat /tmp/openclaw-cleanup-reset.log
  exit 1
fi

test ! -f "${WINERYCLAW_CONFIG_PATH}"
test ! -d "${WINERYCLAW_STATE_DIR}/credentials"
test ! -d "${WINERYCLAW_STATE_DIR}/agents/main/sessions"

echo "==> Recreate minimal config"
mkdir -p "${WINERYCLAW_STATE_DIR}/credentials"
echo '{}' >"${WINERYCLAW_CONFIG_PATH}"

echo "==> Uninstall (state only)"
if ! pnpm openclaw uninstall --state --yes --non-interactive >/tmp/openclaw-cleanup-uninstall.log 2>&1; then
  cat /tmp/openclaw-cleanup-uninstall.log
  exit 1
fi

test ! -d "${WINERYCLAW_STATE_DIR}"

echo "OK"
