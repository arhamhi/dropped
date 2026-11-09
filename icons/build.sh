#!/bin/zsh
# Redraws the Dropped icon (A, painted pin) and writes every size the app uses into public/.
# Then run `node tools/render-assets.mjs` from the project root to rebuild public/og.png.
set -e
cd "${0:A:h}"
R=~/.claude/skills/arham-kengo-canvas/assets/render.js
node $R a-painted-pin.js
node $R a-on-page.js
P=../public
for s in 512 192 32; do sips -s format png -Z $s out/a-painted-pin.png --out $P/icon-$s.png >/dev/null; done
sips -s format png -Z 180 out/a-painted-pin.png --out $P/apple-touch-icon.png >/dev/null
echo "icons -> public/icon-512.png icon-192.png icon-32.png apple-touch-icon.png"
