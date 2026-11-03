#!/usr/bin/env bash
# Starts the freshly built app for half a minute: does it run, draw and save?
# Screenshots end up in the "smoke-macOS" artifact.
set -u

APP="src-tauri/target/universal-apple-darwin/release/bundle/macos/DeskBuddy.app"
DATA="$HOME/Library/Application Support/io.github.vr0em.deskbuddy"
mkdir -p smoke

"$APP/Contents/MacOS/deskbuddy" > smoke/macos.log 2>&1 &
PID=$!
sleep 15
screencapture -x smoke/macos-start.png || echo "screencapture failed"

# A few synthetic clicks. CI machines may drop them, which is fine.
cat > smoke/click.swift <<'SWIFT'
import CoreGraphics
import Foundation
let point = CGPoint(x: 300, y: 300)
for _ in 0..<5 {
    CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: point, mouseButton: .left)?.post(tap: .cghidEventTap)
    CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp, mouseCursorPosition: point, mouseButton: .left)?.post(tap: .cghidEventTap)
    usleep(150_000)
}
SWIFT
swift smoke/click.swift || echo "could not post clicks"

# Autosave runs every 15 seconds.
sleep 18
screencapture -x smoke/macos-after.png || true

echo "--- settings.json"
cat "$DATA/settings.json" || true
echo
echo "--- stats.json"
cat "$DATA/stats.json" 2>/dev/null || echo "(no taps saved)"
echo
echo "--- app output"
cat smoke/macos.log

if kill -0 "$PID" 2>/dev/null; then
  echo "DeskBuddy is still running"
  kill "$PID"
else
  echo "DeskBuddy stopped unexpectedly"
  exit 1
fi
