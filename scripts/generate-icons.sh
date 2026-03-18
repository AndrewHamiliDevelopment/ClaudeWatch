#!/bin/bash
# Generate macOS .icns and Windows .ico from a source PNG
# Usage: ./scripts/generate-icons.sh [path-to-png]
# Requires: macOS with sips and iconutil (built-in)

set -e

SOURCE="${1:-build/icon.png}"
BUILD_DIR="build"

if [ ! -f "$SOURCE" ]; then
  echo "Error: Source PNG not found at $SOURCE"
  echo "Usage: ./scripts/generate-icons.sh [path-to-png]"
  exit 1
fi

echo "Source: $SOURCE"

# --- macOS .icns ---
ICONSET="$BUILD_DIR/icon.iconset"
mkdir -p "$ICONSET"

# Generate all required sizes for macOS
sips -z 16 16     "$SOURCE" --out "$ICONSET/icon_16x16.png"      > /dev/null
sips -z 32 32     "$SOURCE" --out "$ICONSET/icon_16x16@2x.png"   > /dev/null
sips -z 32 32     "$SOURCE" --out "$ICONSET/icon_32x32.png"      > /dev/null
sips -z 64 64     "$SOURCE" --out "$ICONSET/icon_32x32@2x.png"   > /dev/null
sips -z 128 128   "$SOURCE" --out "$ICONSET/icon_128x128.png"    > /dev/null
sips -z 256 256   "$SOURCE" --out "$ICONSET/icon_128x128@2x.png" > /dev/null
sips -z 256 256   "$SOURCE" --out "$ICONSET/icon_256x256.png"    > /dev/null
sips -z 512 512   "$SOURCE" --out "$ICONSET/icon_256x256@2x.png" > /dev/null
sips -z 512 512   "$SOURCE" --out "$ICONSET/icon_512x512.png"    > /dev/null
sips -z 1024 1024 "$SOURCE" --out "$ICONSET/icon_512x512@2x.png" > /dev/null

# Convert iconset to icns
iconutil -c icns "$ICONSET" -o "$BUILD_DIR/icon.icns"
rm -rf "$ICONSET"
echo "Created: $BUILD_DIR/icon.icns"

# --- Windows .ico ---
# Create a multi-resolution ICO using sips + Python (no external deps)
ICO_DIR=$(mktemp -d)
sips -z 16 16   "$SOURCE" --out "$ICO_DIR/16.png"  > /dev/null
sips -z 32 32   "$SOURCE" --out "$ICO_DIR/32.png"  > /dev/null
sips -z 48 48   "$SOURCE" --out "$ICO_DIR/48.png"  > /dev/null
sips -z 256 256 "$SOURCE" --out "$ICO_DIR/256.png" > /dev/null

# Use Python to combine PNGs into ICO format
python3 -c "
import struct, os

sizes = [16, 32, 48, 256]
entries = []
image_data = []

for s in sizes:
    path = '$ICO_DIR/{}.png'.format(s)
    with open(path, 'rb') as f:
        data = f.read()
    image_data.append(data)
    w = 0 if s >= 256 else s
    h = 0 if s >= 256 else s
    entries.append((w, h, 0, 0, 1, 32, len(data)))

# ICO header: reserved(2) + type(2) + count(2)
header = struct.pack('<HHH', 0, 1, len(entries))

# Calculate offsets
offset = 6 + 16 * len(entries)
ico_entries = b''
for i, (w, h, palette, reserved, planes, bpp, size) in enumerate(entries):
    ico_entries += struct.pack('<BBBBHHIH', w, h, palette, reserved, planes, bpp, size, offset)
    offset += size

with open('$BUILD_DIR/icon.ico', 'wb') as f:
    f.write(header)
    f.write(ico_entries)
    for data in image_data:
        f.write(data)
" 2>/dev/null

rm -rf "$ICO_DIR"

if [ -f "$BUILD_DIR/icon.ico" ]; then
  echo "Created: $BUILD_DIR/icon.ico"
else
  echo "Warning: icon.ico generation failed (Python required). You can convert manually."
fi

# --- Copy source PNG for Linux ---
cp "$SOURCE" "$BUILD_DIR/icon.png"
echo "Copied:  $BUILD_DIR/icon.png"

echo ""
echo "Done! Icons ready in $BUILD_DIR/"
ls -la "$BUILD_DIR"/icon.*
