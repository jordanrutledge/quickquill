#!/bin/bash
set -e

echo ""
echo "  ✦ QuickQuill — Mac App Builder"
echo "  ────────────────────────────────────"
echo ""

# Check for Node.js
if ! command -v node &> /dev/null; then
  echo "  ✗ Node.js not found."
  echo "  → Install from https://nodejs.org (LTS recommended)"
  exit 1
fi

NODE_VER=$(node --version)
echo "  ✓ Node.js $NODE_VER found"

# Check for npm
if ! command -v npm &> /dev/null; then
  echo "  ✗ npm not found. Please install Node.js from https://nodejs.org"
  exit 1
fi

echo "  ✓ npm found"
echo ""
echo "  Installing dependencies…"
echo ""

npm install

echo ""
echo "  Building QuickQuill.app…"
echo ""

npm run build

echo ""
echo "  ────────────────────────────────────"
echo "  ✦ Done! Your app is in:"
echo "     ./dist/mac-arm64/QuickQuill.app   (Apple Silicon)"
echo "     ./dist/mac/QuickQuill.app          (Intel)"
echo ""
echo "  Drag QuickQuill.app to your Applications folder to install."
echo "  ────────────────────────────────────"
echo ""
