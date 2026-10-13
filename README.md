# LOGIPAY

Portal für Personal, Disposition und Lohnabrechnung in der Logistik.

## Bereiche

- **Tagesgeschäft:** Übersicht, KW-Planung, Touren & Zustellung, Nachrichten, Live-Tracking
- **Fahrer & Fahrzeuge:** Mitarbeiter, Abwesenheiten, Fahrzeugakte, Fahrzeug & Anliegen, Tachograph
- **Geld & Berichte:** Lohn & Abrechnung, Auslagen, Berichte
- **Verwaltung:** Meldungen, Personalakte, Benutzer, Sicherheit & Änderungsprotokoll

## Entwicklung

Voraussetzung: Node.js `>=22.13.0`

```bash
npm install
npm run dev:vercel      # lokal (Vercel-Variante)
npm run build:vercel    # Produktionsbuild
```

Deployment und Umgebungsvariablen: siehe `VERCEL_DEPLOY.md`.
