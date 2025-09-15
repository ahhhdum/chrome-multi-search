#!/bin/bash

# Build script for Chrome Multi-Search Extension

echo "Building Chrome Multi-Search Extension..."

# Create dist directory if it doesn't exist
mkdir -p dist

# Remove old zip if it exists
rm -f dist/chrome-multi-search.zip

# Create the zip file with all necessary extension files
zip -r dist/chrome-multi-search.zip \
  manifest.json \
  src/ \
  icons/ \
  -x "*.md" \
  -x "*.sh" \
  -x "dist/*" \
  -x ".git/*" \
  -x "*Zone.Identifier"

echo "✅ Build complete! Extension zip created at: dist/chrome-multi-search.zip"
echo "📦 File size: $(du -h dist/chrome-multi-search.zip | cut -f1)"
echo ""
echo "To install:"
echo "1. Open Chrome and go to chrome://extensions/"
echo "2. Enable 'Developer mode'"
echo "3. Drag and drop dist/chrome-multi-search.zip onto the page"
echo "   OR click 'Load unpacked' and select the unzipped folder"