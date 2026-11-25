#!/usr/bin/env bash
# Corre EN EL NAS (lo invoca deploy-nas.sh después de subir el paquete a ~/SmallHosting/keepsy/.staging).
# Orden: backend → migraciones → reinicio y chequeo de la API → recién ahí cambia el frontend.
# Si la API no arranca, vuelve al backend anterior y no toca el sitio.
set -euo pipefail

K="$HOME/SmallHosting/keepsy"
S="$K/.staging"
UV="$HOME/.local/bin/uv"
UNITS="$HOME/.config/systemd/user"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"

cd "$K"
[ -f api/.env ] || { echo "✗ Falta $K/api/.env (DATABASE_URL, JWT_SECRET, MEDIA_DIR=$K/media, MEDIA_URL=/media)"; exit 1; }
mkdir -p media "$UNITS"

# ---------- Backend: código y dependencias
echo "→ Backend"
rm -rf api/src.bak
[ -d api/src ] && mv api/src api/src.bak
cp -a "$S/api/src" api/src
if [ ! -x api/venv/bin/uvicorn ]; then
  "$UV" venv -q --python 3.11 api/venv
  rm -f api/requirements.txt
fi
if ! cmp -s "$S/api/requirements.txt" api/requirements.txt; then
  echo "  dependencias cambiaron: uv pip install"
  VIRTUAL_ENV="$K/api/venv" "$UV" pip install -q -r "$S/api/requirements.txt"
  cp "$S/api/requirements.txt" api/requirements.txt
fi

# ---------- Migraciones pendientes (las tablas son del rol app; corren como app)
echo "→ Migraciones"
# psql_db lee stdin (docker exec -i): las consultas con -c van con </dev/null para no consumir el de este script.
psql_db() { docker exec -i instragram-postgres psql -U admin -d instragram -v ON_ERROR_STOP=1 -qAt "$@"; }
psql_db -c "SET ROLE app" -c "CREATE TABLE IF NOT EXISTS keepsy_migraciones (
  nombre VARCHAR PRIMARY KEY, aplicada_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)" >/dev/null </dev/null
for f in api/src/db/migrations/*.sql; do
  n="$(basename "$f")"
  if [ -n "$(psql_db -c "SELECT 1 FROM keepsy_migraciones WHERE nombre = '$n'" </dev/null)" ]; then continue; fi
  echo "  aplicando $n"
  { echo "SET ROLE app;"; cat "$f"; echo; echo "INSERT INTO keepsy_migraciones (nombre) VALUES ('$n');"; } | psql_db -f - >/dev/null
done

# ---------- Servicios
cp "$S/keepsy-api.service" "$UNITS/keepsy-api.service"
cp "$S/serve.mjs" serve.mjs
systemctl --user daemon-reload
systemctl --user enable -q keepsy-api.service
systemctl --user restart keepsy-api.service

echo "→ Esperando a la API"
ok=""
for _ in $(seq 1 30); do
  # /health no toca la base; un login inválido sí (tiene que dar 401, no 500).
  if curl -fsS -o /dev/null http://127.0.0.1:8096/health; then
    code="$(curl -s -o /dev/null -w '%{http_code}' -H 'content-type: application/json' \
      -d '{"email":"nadie@keepsy.invalid","password":"x"}' http://127.0.0.1:8096/api/auth/login)"
    if [ "$code" = 401 ] || [ "$code" = 422 ]; then ok=1; break; fi
    echo "  login de prueba devolvió $code"
  fi
  sleep 1
done
if [ -z "$ok" ]; then
  echo "✗ La API no responde bien. Vuelvo al backend anterior; el sitio no se tocó."
  journalctl --user -u keepsy-api.service -n 30 --no-pager || true
  if [ -d api/src.bak ]; then rm -rf api/src && mv api/src.bak api/src && systemctl --user restart keepsy-api.service; fi
  exit 1
fi
echo "  API ok"

# ---------- Frontend
echo "→ Frontend (el anterior queda en dist.bak)"
rm -rf dist.bak
[ -d dist ] && mv dist dist.bak
mv "$S/dist" dist
systemctl --user restart keepsy-static.service
sleep 1
curl -fsS -o /dev/null http://127.0.0.1:8095/ || { echo "✗ keepsy-static no responde"; exit 1; }
rm -rf "$S"
echo "✓ Desplegado en el NAS"
