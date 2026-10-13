n# LOGIPAY auf Vercel deployen

## Repository

- **GitHub:** https://github.com/Diana18881/logipay-portal
- **Live-URL:** https://logipay-portal.vercel.app

## GitHub mit Vercel verbinden (Auto-Deploy)

1. Öffnen Sie https://vercel.com/dianas-projects-47f8bde8/logipay-portal/settings/git
2. **Connect Git Repository** → `Diana18881/logipay-portal` auswählen
3. Branch **main** → jeder Push deployt automatisch

## 1. Turso-Datenbank (SQLite)

```bash
curl -sSfL https://get.tur.so/install.sh | bash
turso auth login
turso db create logipay
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

Demo-Logins: `dispatcher@logipay.demo`, `director@logipay.demo`, `driver@logipay.demo`, `accounting@logipay.demo`. Das Passwort wird nie im Repository gespeichert: `bash scripts/reset-demo-passwords.sh` erzeugt ein zufälliges Passwort in der Turso-Datenbank. Für eine neue, leere Datenbank optional `LOGIPAY_DEMO_PASSWORD` in Vercel setzen.

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

## Assistent und Push (Environment Variables in Vercel)

| Variable | Zweck |
| --- | --- |
| `AI_GATEWAY_API_KEY` | Assistent (Chat-Icon unten rechts) und Auslesen von PDF/Foto-Lohnzetteln über Vercel AI Gateway. Schlüssel anlegen unter Vercel → AI Gateway → API Keys. |
| `AI_MODEL` | Modell-ID aus der Liste https://ai-gateway.vercel.sh/v1/models. Ohne diese Variable ist der Assistent ausgeschaltet. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Push-Benachrichtigungen. Schlüssel erzeugen mit `npx web-push generate-vapid-keys`; `VAPID_SUBJECT` z. B. `mailto:admin@firma.de`. |

Nach dem Eintragen neu deployen (Deployments → Redeploy).
