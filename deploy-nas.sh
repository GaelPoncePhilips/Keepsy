#!/usr/bin/env bash
# Compila el frontend (mock) y lo sube al NAS → https://keepsy.gaelcloud.org
#
#   ./deploy-nas.sh
#
# Compila en una copia aparte (~/.cache/keepsy-build) con dependencias de Linux, porque el
# node_modules del repo puede ser de Windows. El build anterior queda en dist.bak en el NAS.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST="${KEEPSY_NAS:-nas}"                      # alias de ~/.ssh/config
DEST="${KEEPSY_DEST:-SmallHosting/keepsy}"     # relativo al home del NAS
URL="${KEEPSY_URL:-https://keepsy.gaelcloud.org/}"
BUILD="${KEEPSY_BUILD_DIR:-$HOME/.cache/keepsy-build}"

export PATH="$HOME/.bun/bin:$PATH"
command -v bun >/dev/null || { echo "✗ Falta Bun"; exit 1; }

echo "→ Copiando frontend a $BUILD"
mkdir -p "$BUILD"
rsync -a --delete --exclude node_modules --exclude dist "$ROOT/frontend/" "$BUILD/"

cd "$BUILD"
echo "→ bun install"
bun install >/dev/null
echo "→ Typecheck"
bunx tsc --noEmit -p tsconfig.app.json
echo "→ Build"
bunx vite build >/dev/null

echo "→ Respaldando el build actual en el NAS (dist.bak)"
ssh "$HOST" "cd $DEST && rm -rf dist.bak && { [ -d dist ] && cp -a dist dist.bak || true; }"
echo "→ Subiendo"
rsync -az --delete "$BUILD/dist/" "$HOST:$DEST/dist/"

JS="$(ls "$BUILD/dist/assets" | grep -m1 '^index-.*\.js$')"
if curl -fsS "$URL" | grep -q "$JS"; then
  echo "✓ Publicado en $URL ($JS)"
else
  echo "✗ El sitio no está sirviendo $JS — revisá serve.mjs en el NAS"
  exit 1
fi
