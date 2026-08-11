# LOGIPAY auf Vercel deployen

## 1. Turso-Datenbank (SQLite)

```bash
curl -sSfL https://get.tur.so/install.sh | bash
turso auth login
turso db create logipay --region fra
turso db show logipay --url
turso db tokens create logipay
```

Notieren Sie **URL** und **Token**.

## 2. Vercel-Projekt

1. [vercel.com/new](https://vercel.com/new) → Repository **Salary Portal** importieren  
   Oder lokal:

```bash
cd "/Users/dianacimbaluk/Desktop/Salary Portal"
npm install
npx vercel login
npx vercel link
```

## 3. Umgebungsvariablen in Vercel

| Variable | Wert |
|----------|------|
| `TURSO_DATABASE_URL` | `libsql://…` von Turso |
| `TURSO_AUTH_TOKEN` | Token von Turso |
| `BLOB_READ_WRITE_TOKEN` | Storage → Blob Store → Token anlegen |

Optional: `TRACKER_INGEST_TOKEN`, Fleetboard-Variablen aus `.env.example`.

## 4. Deploy

```bash
npx vercel --prod
```

Nach dem Deploy erhalten Sie eine URL wie `https://logipay-….vercel.app` — von jedem Gerät erreichbar.

## 5. Erster Start

Beim ersten Aufruf legt die App Tabellen und Demo-Benutzer automatisch an (`ensureAuthDatabase`, `ensureDomainDatabase`).

Demo-Logins: `dispatcher@logipay.demo`, `director@logipay.demo`, `driver@logipay.demo` (Passwort wie bei lokaler Installation).

## Lokal mit Vercel-Stack testen

```bash
cp .env.example .env.local
# TURSO_* und BLOB_* eintragen
npm run dev:vercel
```

## Cloudflare (weiterhin möglich)

```bash
npm run dev
npm run build
npx vinext deploy
```
