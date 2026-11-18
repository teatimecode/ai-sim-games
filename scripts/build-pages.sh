#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$ROOT/dist"

rm -rf "$DIST"
mkdir -p "$DIST/games/fifths-ring" "$DIST/games/aircraft-manufacturer"

cp "$ROOT/site/index.html" "$ROOT/site/site.css" "$DIST/"
cp -R "$ROOT/games/fifths-ring/app/." "$DIST/games/fifths-ring/"
cp "$ROOT/games/aircraft-manufacturer/index.html" \
   "$ROOT/games/aircraft-manufacturer/game.css" \
   "$ROOT/games/aircraft-manufacturer/engine.js" \
   "$ROOT/games/aircraft-manufacturer/codex.js" \
   "$ROOT/games/aircraft-manufacturer/ui.js" \
   "$DIST/games/aircraft-manufacturer/"

touch "$DIST/.nojekyll"

# GitHub Pages serves this file for unknown routes. Returning to the collection
# is more useful than exposing a bare platform 404.
cp "$ROOT/site/404.html" "$DIST/404.html"

echo "GitHub Pages site built at $DIST"
find "$DIST" -type f | sort
