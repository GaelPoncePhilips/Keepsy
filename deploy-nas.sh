#!/usr/bin/env bash
# Despliega Keepsy completo en el NAS → https://keepsy.gaelcloud.org
#   - frontend compilado contra el backend real (modo "real": frontend/.env.real, VITE_API_URL=/api)
#   - backend FastAPI como servicio systemd de usuario (keepsy-api, 127.0.0.1:8096)
#   - serve.mjs sirve el build y reenvía /api y /media al backend (mismo origen, sin CORS)
#   - aplica las migraciones de backend/src/db/migrations que falten en la base
#
#   ./deploy-nas.sh                                          # desde una máquina con el alias ssh "nas"
#   KEEPSY_SSH="ssh gaelp@10.5.51.246 ssh nas" ./deploy-nas.sh   # desde Windows, saltando por la laptop
#
# Se compila acá (con el node_modules de esta máquina) y se sube un tar por ssh: no hace falta
# bun ni rsync del otro lado. En el NAS: deploy/nas/remote.sh (los respaldos quedan en dist.bak y api/src.bak).
# La primera vez el NAS necesita ~/SmallHosting/keepsy/api/.env (ver backend/.env.example).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SSH="${KEEPSY_SSH:-ssh nas}"
MODE="${KEEPSY_MODE:-real}"
URL="${KEEPSY_URL:-https://keepsy.gaelcloud.org}"

export PATH="$HOME/.bun/bin:$PATH"
command -v bun >/dev/null || { echo "✗ Falta Bun"; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
PKG="$TMP/pkg"
mkdir -p "$PKG/api"

cd "$ROOT/frontend"
[ -d node_modules ] || bun install --frozen-lockfile
echo "→ Typecheck"
bunx tsc --noEmit -p tsconfig.app.json
echo "→ Build (modo $MODE)"
bunx vite build --mode "$MODE" --outDir "$PKG/dist" --emptyOutDir >/dev/null

echo "→ Empaquetando backend"
cp "$ROOT/backend/requirements.txt" "$PKG/api/"
tar -C "$ROOT/backend" --exclude '__pycache__' --exclude '*.pyc' -cf - src | tar -C "$PKG/api" -xf -
cp "$ROOT/deploy/nas/serve.mjs" "$ROOT/deploy/nas/keepsy-api.service" "$ROOT/deploy/nas/remote.sh" "$PKG/"

echo "→ Subiendo"
# Cada comando remoto es simple (sin && ni ~): con el salto por la laptop pasa por dos shells (fish incluido).
# Las rutas son relativas al home, donde arranca ssh.
mv "$PKG" "$TMP/.staging"
$SSH rm -rf SmallHosting/keepsy/.staging
tar -C "$TMP" -czf - .staging | $SSH tar -xzf - -C SmallHosting/keepsy
$SSH bash SmallHosting/keepsy/.staging/remote.sh

echo "→ Verificando $URL"
JS="$(ls "$TMP/.staging/dist/assets" | grep -m1 '^index-.*\.js$')"
curl -fsS "$URL/" | grep -q "$JS" || { echo "✗ El sitio no está sirviendo $JS"; exit 1; }
code="$(curl -s -o /dev/null -w '%{http_code}' "$URL/api/auth/me")"
[ "$code" = 401 ] || { echo "✗ $URL/api/auth/me devolvió $code (esperaba 401 del backend)"; exit 1; }
echo "✓ Publicado en $URL ($JS) con backend real"
