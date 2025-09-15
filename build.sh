#!/bin/bash

# Build script for Chrome Multi-Search Extension

echo "Building Chrome Multi-Search Extension..."

# Create dist directory if it doesn't exist
mkdir -p dist

# Remove old builds
rm -f dist/chrome-multi-search.zip
rm -rf dist/unpacked

# Create unpacked directory for development
echo "📁 Creating unpacked extension for development..."
mkdir -p dist/unpacked

# Copy all necessary files to unpacked directory
cp -r manifest.json dist/unpacked/
cp -r src/ dist/unpacked/
cp -r icons/ dist/unpacked/

# Clean up unwanted files from unpacked version
find dist/unpacked -name "*Zone.Identifier" -delete 2>/dev/null
find dist/unpacked -name "*.md" -delete 2>/dev/null
find dist/unpacked -name "*.sh" -delete 2>/dev/null
find dist/unpacked -name ".DS_Store" -delete 2>/dev/null

# Create the zip file for distribution
echo "📦 Creating zip file for distribution..."
cd dist/unpacked
zip -r ../chrome-multi-search.zip . -x "*.git/*"
cd ../..

echo ""
echo "✅ Build complete!"
echo ""
echo "📁 Unpacked extension (for development): dist/unpacked/"
echo "   • Use 'Load unpacked' in Chrome and select this folder"
echo "   • Changes to source files require rebuilding"
echo ""
echo "📦 Zip file (for distribution): dist/chrome-multi-search.zip"
echo "   • Size: $(du -h dist/chrome-multi-search.zip | cut -f1)"
echo "   • Can be dragged onto chrome://extensions/"
echo ""
echo "To install for development:"
echo "1. Open Chrome and go to chrome://extensions/"
echo "2. Enable 'Developer mode'"
echo "3. Click 'Load unpacked' and select: $(pwd)/dist/unpacked"