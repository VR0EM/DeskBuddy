#!/usr/bin/env bash
# Starts the freshly built app for half a minute: does it run, show the
# buddy, count clicks, and save? The results are printed here; screenshots
# end up in the "smoke-macOS" artifact. (Keys can't be tested on CI: they
# need the Input Monitoring permission.)
set -u

APP="src-tauri/target/universal-apple-darwin/release/bundle/macos/DeskBuddy.app"
DATA="$HOME/Library/Application Support/io.github.vr0em.deskbuddy"
mkdir -p smoke

"$APP/Contents/MacOS/deskbuddy" > smoke/macos.log 2>&1 &
PID=$!
sleep 15
screencapture -x smoke/macos-start.png || echo "screencapture failed"

cat > smoke/check.swift <<'SWIFT'
import CoreGraphics
import Foundation
import ImageIO

if CommandLine.arguments.count > 1 {
    // Looks for Pip's orange fur, and checks the pixel next to the head: if
    // the window is transparent it shows the desktop there, not white.
    for path in CommandLine.arguments.dropFirst() {
        guard let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil),
              let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
            print("\(path): no screenshot")
            continue
        }
        let w = image.width, h = image.height
        var px = [UInt8](repeating: 0, count: w * h * 4)
        let ctx = CGContext(data: &px, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                            space: CGColorSpaceCreateDeviceRGB(),
                            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
        ctx.draw(image, in: CGRect(x: 0, y: 0, width: w, height: h))
        var count = 0, minX = Int.max, minY = Int.max, maxX = -1, maxY = -1
        for y in stride(from: 0, to: h, by: 3) {
            for x in stride(from: 0, to: w, by: 3) {
                let i = (y * w + x) * 4
                if abs(Int(px[i]) - 247) < 25 && abs(Int(px[i + 1]) - 180) < 25 && abs(Int(px[i + 2]) - 110) < 25 {
                    count += 1
                    minX = min(minX, x); maxX = max(maxX, x); minY = min(minY, y); maxY = max(maxY, y)
                }
            }
        }
        var line = "\(path): \(w)x\(h), orange pixels: \(count), box: \(minX),\(minY) - \(maxX),\(maxY)"
        if count > 0 {
            let cx = min(w - 1, maxX + 30), cy = minY + 10
            let i = (cy * w + cx) * 4
            line += "; pixel right of the head at \(cx),\(cy): \(px[i]),\(px[i + 1]),\(px[i + 2])"
        }
        print(line)
    }
} else {
    // A few synthetic clicks at the left edge of the screen.
    let point = CGPoint(x: 5, y: 300)
    for _ in 0..<5 {
        CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: point, mouseButton: .left)?.post(tap: .cghidEventTap)
        CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp, mouseCursorPosition: point, mouseButton: .left)?.post(tap: .cghidEventTap)
        usleep(150_000)
    }
}
SWIFT
swiftc -O smoke/check.swift -o smoke/check || echo "could not build the checker"
smoke/check || echo "could not post clicks"

# Autosave runs every 15 seconds.
sleep 18
screencapture -x smoke/macos-after.png || true

echo "--- what the screenshots show"
smoke/check smoke/macos-start.png smoke/macos-after.png || true
echo "--- settings.json"
cat "$DATA/settings.json" || true
echo
echo "--- stats.json"
cat "$DATA/stats.json" 2>/dev/null || echo "(no taps saved)"
echo
echo "--- app output"
cat smoke/macos.log
rm -f smoke/check

if kill -0 "$PID" 2>/dev/null; then
  echo "DeskBuddy was still running"
  kill "$PID"
else
  echo "DeskBuddy stopped unexpectedly"
  exit 1
fi
