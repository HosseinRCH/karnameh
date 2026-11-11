#!/usr/bin/env bash
# Builds the web version of Karnameh into ./_site from the desktop renderer.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf _site
mkdir -p _site
cp -r desktop/renderer/. _site/
cp web/manifest.webmanifest web/sw.js web/web-boot.js _site/
python3 - <<'PY'
p = '_site/index.html'
s = open(p, encoding='utf-8').read()
s = s.replace('کارنامه — نسخهٔ آفلاین ویندوز', 'کارنامه — نسخهٔ وب')
s = s.replace('<link rel="stylesheet" href="styles.css" />',
              '<link rel="stylesheet" href="styles.css" />\n    <link rel="manifest" href="manifest.webmanifest" />\n    <meta name="theme-color" content="#0f766e" />\n    <link rel="icon" href="icon.png" />')
s = s.replace('</body>', '  <script src="web-boot.js"></script>\n  </body>')
open(p, 'w', encoding='utf-8').write(s)
PY
touch _site/.nojekyll
echo "built _site"
