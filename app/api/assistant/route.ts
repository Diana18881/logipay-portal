import { requirePortalUser } from "../../../lib/auth";
import { aiConfigured, aiMessages } from "../../../lib/ai";

const roleNames: Record<string, string> = { management: "Management", accountant: "Buchhaltung", dispatcher: "Disposition", driver: "Fahrer" };

const portalGuide = `Menü des Portals (Gruppen):
- Tagesgeschäft: Übersicht (Kennzahlen, wichtigste Aufgaben), Aufgabenzentrale, KW-Planung (Wochenplan, Live-Disposition per Drag & Drop, Wochenkalender), Touren & Zustellung (Status, CMR-Dokumente; Button „Tour-Chat“ öffnet den Chat), Nachrichten (Chat je Tour, wie WhatsApp), Live-Tracking.
- Fahrer & Fahrzeuge: Mitarbeiter, Fahrzeugakte, Fahrzeug & Anliegen (Fahrzeug-Check und Fahreranliegen als Tabs), Tachograph.
- Geld & Berichte: Lohn & Abrechnung, Auslagen & Erstattungen, Berichte (Wochenplan-PDF, Tagesbericht, Mitarbeiter-/Fahrzeugliste CSV, Ausgabenbericht, Lohnübersicht).
- Verwaltung: Personalakte, Benachrichtigungen, Benutzerverwaltung, Sicherheit & Audit.
Lohnabrechnung in 3 Schritten: (1) Arbeitszeit erfassen (Kalender je Mitarbeiter; Klick auf Tag = Arbeit → Urlaub → Krank; oder „Aus KW-Planung übernehmen“), (2) Abrechnung berechnen (Spesen, Zuschläge; Grundgehalt aus „Vergütung“ im Mitarbeiterstamm, z. B. „1750 € Netto“, „14 €/h“, „90 €/Tag“), (3) Ergebnis prüfen, PDF, Monat schließen. Abzüge (Vorschuss, Bußgeld) werden je Monat manuell eingetragen. Lohn aus Datei: Excel/CSV/PDF hochladen.
Fahrer können im Chat per Schnellbuttons eine Lieferung anfordern (📦); Disposition und Management bekommen sofort eine Benachrichtigung.`;

type ChatTurn = { role: "user" | "assistant"; content: string };

export async function GET() {
  await requirePortalUser(["management", "accountant", "dispatcher", "driver"]);
  return Response.json({ configured: aiConfigured() });
}

export async function POST(request: Request) {
  const user = await requirePortalUser(["management", "accountant", "dispatcher", "driver"]);
  if (!aiConfigured()) return Response.json({ error: "Der Assistent ist nicht eingerichtet (Zugangsschlüssel fehlt in den Umgebungsvariablen)." }, { status: 503 });

  const body = await request.json().catch(() => null) as { messages?: ChatTurn[]; context?: unknown; locale?: string; section?: string } | null;
  const messages = (Array.isArray(body?.messages) ? body!.messages : [])
    .filter((item) => (item.role === "user" || item.role === "assistant") && typeof item.content === "string" && item.content.trim())
    .slice(-20)
    .map((item) => ({ role: item.role, content: item.content.slice(0, 4000) }));
  if (!messages.length || messages[messages.length - 1].role !== "user") return Response.json({ error: "Nachricht fehlt" }, { status: 400 });

  const context = JSON.stringify(body?.context ?? {}).slice(0, 60000);
  const system = [
    `Du bist der automatische Assistent des Logistik-Portals LOGIPAY. Der Nutzer ist ${user.fullName} (Rolle: ${roleNames[user.role]}).`,
    "Antworte kurz, konkret und in der Sprache des Nutzers (Deutsch, Russisch, Ukrainisch oder Polnisch).",
    "Nutze ausschließlich die Portal-Daten unten für Fakten (Fahrer, Fahrzeuge, Touren, Abrechnungen, Aufgaben). Erfinde keine Zahlen; wenn Daten fehlen, sag das offen.",
    "Du kannst nur lesen und erklären, keine Änderungen ausführen. Sage dem Nutzer Schritt für Schritt, in welchem Menüpunkt er etwas erledigen kann. Halte Antworten unter 120 Wörtern, nutze kurze Listen. Bei Berechnungen (z. B. Lohn) zeige die Rechnung.",
    body?.section ? `Der Nutzer befindet sich gerade im Bereich: ${String(body.section).slice(0, 40)}.` : "",
    portalGuide,
    user.role === "driver" ? "Der Nutzer ist Fahrer: gib keine Informationen über andere Mitarbeiter preis." : "",
    `Portal-Daten (JSON, Stand jetzt):\n${context}`,
  ].filter(Boolean).join("\n\n");

  const response = await aiMessages({ max_tokens: 1024, system, messages });
  if (!response.ok) return Response.json({ error: `Assistent antwortet nicht (${response.status})` }, { status: 502 });
  const reply = response.text;
  return Response.json({ reply: reply || "Keine Antwort erhalten." }, { headers: { "Cache-Control": "private, no-store" } });
}
