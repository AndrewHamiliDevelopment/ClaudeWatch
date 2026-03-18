#!/bin/bash
# Build the ClaudeWatch WidgetKit extension for macOS.
# Produces a .appex bundle at build/widget/ClaudeWatchWidgetExtension.appex
# that electron-builder copies into Contents/PlugIns/.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
WIDGET_DIR="$PROJECT_DIR/widget"
BUILD_DIR="$PROJECT_DIR/widget-build"
OUTPUT_DIR="$PROJECT_DIR/build/widget"

# Parse optional arguments
SIGN=${SIGN:-false}
TEAM_ID=${TEAM_ID:-"7QZW432V8B"}

echo "==> Building ClaudeWatch Widget Extension..."

# Clean previous build
rm -rf "$BUILD_DIR"
rm -rf "$OUTPUT_DIR"

# Build arguments
BUILD_ARGS=(
  -project "$WIDGET_DIR/ClaudeWatchWidget.xcodeproj"
  -scheme "ClaudeWatchWidgetExtension"
  -configuration Release
  -derivedDataPath "$BUILD_DIR"
  -destination "platform=macOS"
)

# Always build unsigned — electron-builder handles signing for the final bundle.
# The .appex gets re-signed with its own entitlements via afterPack hook.
echo "    Building unsigned (electron-builder will sign the final bundle)"
BUILD_ARGS+=(
  "CODE_SIGNING_REQUIRED=NO"
  "CODE_SIGNING_ALLOWED=NO"
  "CODE_SIGN_IDENTITY=-"
)

# Always build universal binary — electron-builder creates a universal app
# and needs both arm64 + x86_64 slices for the lipo merge step
echo "    Building universal binary (arm64 + x86_64)"
BUILD_ARGS+=("ONLY_ACTIVE_ARCH=NO")

xcodebuild "${BUILD_ARGS[@]}" 2>&1 | tail -5

# Find the .appex in build output
APPEX_PATH=$(find "$BUILD_DIR" -name "ClaudeWatchWidgetExtension.appex" -type d | head -1)

if [ -z "$APPEX_PATH" ]; then
  echo "ERROR: Widget .appex not found in build output"
  exit 1
fi

# Copy to known location for electron-builder
mkdir -p "$OUTPUT_DIR"
cp -R "$APPEX_PATH" "$OUTPUT_DIR/"

echo "==> Widget built successfully!"
echo "    Output: $OUTPUT_DIR/ClaudeWatchWidgetExtension.appex"
echo "    Size: $(du -sh "$OUTPUT_DIR/ClaudeWatchWidgetExtension.appex" | cut -f1)"
