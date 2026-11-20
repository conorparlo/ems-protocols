#!/bin/sh
# Convert extracted page renders (content/source/pages/NNN.png) into bundled WebP assets.
# Usage: sh tools/extract/build_page_images.sh content/source app/assets/pages
set -e
SRC="$1/pages"; OUT="$2"
mkdir -p "$OUT"
for f in "$SRC"/*.png; do
  n=$(basename "$f" .png)
  [ "$n" -le 7 ] && continue   # cover, credits, table of contents
  cwebp -quiet -q 70 -resize 1100 0 "$f" -o "$OUT/$n.webp"
done
