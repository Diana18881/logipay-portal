#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="$HOME/.turso:$PATH"
DB_NAME="${LOGIPAY_TURSO_DB:-logipay}"

cd "$ROOT"

echo "==> Turso login prüfen…"
if ! turso auth whoami >/dev/null 2>&1; then
  echo "Nicht eingeloggt. Bitte zuerst ausführen:"
  echo "  export PATH=\"\$HOME/.turso:\$PATH\""
  echo "  turso auth login"
  echo "Oder im Browser: https://api.turso.tech?redirect=false"
  exit 1
fi

echo "==> Turso-Datenbank '$DB_NAME'…"
if ! turso db show "$DB_NAME" >/dev/null 2>&1; then
  echo "    Erstelle Datenbank (Standard-Region)…"
  turso db create "$DB_NAME" --wait
fi

DB_URL="$(turso db show "$DB_NAME" --url 2>/dev/null | tr -d '\r' | grep -E '^libsql://' | head -1)"
DB_TOKEN="$(turso db tokens create "$DB_NAME" 2>/dev/null | tr -d '\r' | grep -E '^eyJ' | head -1)"

if [[ -z "$DB_URL" ]]; then
  echo "Fehler: Keine gültige libsql:// URL von Turso erhalten."
  echo "Bitte prüfen: turso auth whoami && turso db show $DB_NAME --url"
  exit 1
fi
if [[ -z "$DB_TOKEN" ]]; then
  echo "Fehler: Kein gültiger Turso-Token erhalten."
  exit 1
fi

echo "    URL: ${DB_URL:0:40}…"

echo "==> Vercel-Umgebungsvariablen setzen…"
for env_name in production preview; do
  npx vercel env add TURSO_DATABASE_URL "$env_name" --value "$DB_URL" --force --yes
  npx vercel env add TURSO_AUTH_TOKEN "$env_name" --value "$DB_TOKEN" --force --yes --sensitive
done
npx vercel env add TURSO_DATABASE_URL development --value "$DB_URL" --force --yes
npx vercel env add TURSO_AUTH_TOKEN development --value "$DB_TOKEN" --force --yes

echo "==> Production-Deploy…"
npx vercel deploy --prod --yes

echo ""
echo "Fertig: https://logipay-portal.vercel.app/login"
echo "Demo-Passwort setzen: bash scripts/reset-demo-passwords.sh"
