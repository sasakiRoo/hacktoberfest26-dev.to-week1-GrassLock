#!/usr/bin/env bash
# GrassLock Desktop One-Click Linux Launcher
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Ensure executable permissions
chmod +x "$SCRIPT_DIR/dist/linux-unpacked/grasslock-desktop" 2>/dev/null || true

# Always sync live source files to unpacked app resources
if [ -d "$SCRIPT_DIR/dist/linux-unpacked/resources/app" ]; then
  cp -f "$SCRIPT_DIR/server.js" "$SCRIPT_DIR/dist/linux-unpacked/resources/app/" 2>/dev/null || true
  cp -f "$SCRIPT_DIR/main.js" "$SCRIPT_DIR/dist/linux-unpacked/resources/app/" 2>/dev/null || true
  cp -f "$SCRIPT_DIR/tracker.js" "$SCRIPT_DIR/dist/linux-unpacked/resources/app/" 2>/dev/null || true
  cp -f "$SCRIPT_DIR/preload.js" "$SCRIPT_DIR/dist/linux-unpacked/resources/app/" 2>/dev/null || true
  cp -rf "$SCRIPT_DIR/public" "$SCRIPT_DIR/dist/linux-unpacked/resources/app/" 2>/dev/null || true
fi

echo "🌿 Launching GrassLock Desktop Sentinel..."
exec "$SCRIPT_DIR/dist/linux-unpacked/grasslock-desktop" --no-sandbox --disable-gpu "$@"
