#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="$HOME/.turso:$PATH"
DB_NAME="${LOGIPAY_TURSO_DB:-logipay}"

cd "$ROOT"

if ! turso auth whoami >/dev/null 2>&1; then
  echo "Turso: bitte zuerst turso auth login"
  exit 1
fi

# Ohne Vorgabe wird ein zufälliges, starkes Passwort erzeugt (nie im Repository speichern).
DEMO_PASSWORD="${LOGIPAY_DEMO_PASSWORD:-$(node -e 'process.stdout.write("Lp-" + require("crypto").randomBytes(15).toString("base64url"))')}"
if [[ ${#DEMO_PASSWORD} -lt 16 ]]; then
  echo "Fehler: LOGIPAY_DEMO_PASSWORD muss mindestens 16 Zeichen haben."
  exit 1
fi

HASH="$(DEMO_PASSWORD="$DEMO_PASSWORD" node --input-type=module -e '
const crypto = globalThis.crypto;
const iterations = 210000;
const salt = crypto.getRandomValues(new Uint8Array(16));
const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(process.env.DEMO_PASSWORD), "PBKDF2", false, ["deriveBits"]);
const derived = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256));
process.stdout.write(`pbkdf2_sha256$${iterations}$${Buffer.from(salt).toString("base64")}$${Buffer.from(derived).toString("base64")}`);
')"

echo "==> Demo-Passwörter zurücksetzen…"
turso db shell "$DB_NAME" <<SQL
UPDATE users
SET password_hash = '${HASH}', must_change_password = 0, failed_attempts = 0, locked_until = NULL
WHERE email LIKE '%@logipay.demo';
DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@logipay.demo');
SQL

echo ""
echo "Fertig. Demo-Logins:"
echo "  dispatcher@logipay.demo"
echo "  director@logipay.demo"
echo "  driver@logipay.demo"
echo "  accounting@logipay.demo"
echo "Neues Passwort (sicher aufbewahren, nicht ins Repository): ${DEMO_PASSWORD}"
