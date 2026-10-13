import { env } from "@logipay/env";
import { rgb, type PDFFont } from "pdf-lib";
import { requirePortalUser } from "../../../../../lib/auth";
import { ensureDomainDatabase } from "../../../../../lib/domain";
import { createPdf } from "../../../../../lib/payslip";

type Person = { id: number; full_name: string; company: string | null; location: string | null; hired_at: string | null; terminated_at: string | null; compensation: string | null; system_type: string | null };

const de = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString("de-DE") : "—";

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) > maxWidth && line) { lines.push(line); line = word; } else line = test;
    }
    lines.push(line);
  }
  return lines;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requirePortalUser(["management"]);
  await ensureDomainDatabase();
  const { id } = await context.params;
  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "";
  const reason = (url.searchParams.get("reason") || "").slice(0, 1500);
  const person = await env.DB.prepare("SELECT id, full_name, company, location, hired_at, terminated_at, compensation, system_type FROM staff WHERE id=?").bind(id).first<Person>();
  if (!person) return new Response("Nicht gefunden", { status: 404 });
  const company = person.company || "LOGIPAY";
  const today = new Date().toLocaleDateString("de-DE");

  let title = "";
  let body = "";
  let footnote = "";
  if (type === "certificate") {
    title = "Arbeitsbescheinigung";
    body = `Hiermit bescheinigen wir, dass ${person.full_name} ${person.hired_at ? `seit dem ${de(person.hired_at)}` : "bei uns"} als Berufskraftfahrer/in bei der ${company}${person.location ? ` (Standort ${person.location})` : ""} beschäftigt ${person.terminated_at ? `war. Das Beschäftigungsverhältnis endete am ${de(person.terminated_at)}` : "ist"}.\n\nDiese Bescheinigung wird auf Wunsch des/der Beschäftigten zur Vorlage bei Behörden, Banken oder Vermietern ausgestellt.`;
  } else if (type === "warning") {
    if (reason.trim().length < 5) return new Response("Bitte den Grund der Abmahnung angeben", { status: 400 });
    title = "Abmahnung";
    body = `Sehr geehrte/r ${person.full_name},\n\nwir mahnen Sie hiermit wegen folgender Pflichtverletzung ab:\n\n${reason.trim()}\n\nDieses Verhalten stellt eine Verletzung Ihrer arbeitsvertraglichen Pflichten dar. Wir fordern Sie auf, Ihre Pflichten künftig ordnungsgemäß zu erfüllen.\n\nFür den Wiederholungsfall weisen wir darauf hin, dass wir arbeitsrechtliche Konsequenzen bis hin zur Kündigung des Arbeitsverhältnisses prüfen werden.\n\nSie haben die Möglichkeit, zu dem Vorwurf schriftlich Stellung zu nehmen. Diese Abmahnung wird zu Ihrer Personalakte genommen.`;
    footnote = "Vorlage – bitte vor Verwendung arbeitsrechtlich prüfen.";
  } else if (type === "contract") {
    title = "Arbeitsvertrag (Vorlage)";
    body = `zwischen ${company} (nachfolgend „Arbeitgeber“) und ${person.full_name} (nachfolgend „Arbeitnehmer/in“)\n\n§ 1 Beginn und Tätigkeit\nDas Arbeitsverhältnis beginnt am ${de(person.hired_at)}. Der/die Arbeitnehmer/in wird als Berufskraftfahrer/in eingesetzt${person.location ? `, Einsatzort/Standort: ${person.location}` : ""}.\n\n§ 2 Vergütung\nDie vereinbarte Vergütung beträgt: ${person.compensation || "___________"}. Spesen, Zuschläge und Erstattungen werden nach den im Betrieb geltenden Regelungen abgerechnet.\n\n§ 3 Arbeitszeit\nArbeitszeitmodell: ${person.system_type ? `System ${person.system_type}` : "___________"}. Lenk- und Ruhezeiten richten sich nach den gesetzlichen Vorschriften (EU-VO 561/2006, ArbZG).\n\n§ 4 Urlaub\nDer/die Arbeitnehmer/in hat Anspruch auf Erholungsurlaub nach dem Bundesurlaubsgesetz, mindestens 20 Arbeitstage bei einer 5-Tage-Woche.\n\n§ 5 Pflichten\nFahrzeuge, Ladung und Dokumente sind sorgfältig zu behandeln. Schäden, Verspätungen und Mängel sind unverzüglich der Disposition zu melden.\n\n§ 6 Verschwiegenheit\nÜber Betriebs- und Geschäftsgeheimnisse ist auch nach Beendigung des Arbeitsverhältnisses Stillschweigen zu bewahren.\n\n§ 7 Schlussbestimmungen\nÄnderungen und Ergänzungen bedürfen der Schriftform. Sollte eine Bestimmung unwirksam sein, bleibt der Vertrag im Übrigen wirksam.`;
    footnote = "Vorlage – bitte vor Verwendung rechtlich prüfen und an den Einzelfall anpassen.";
  } else return new Response("Unbekannte Vorlage", { status: 400 });

  const { pdf, fonts } = await createPdf(request);
  let page = pdf.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  page.drawRectangle({ x: 0, y: height - 70, width, height: 70, color: rgb(0.035, 0.105, 0.19) });
  page.drawText(company, { x: 40, y: height - 42, font: fonts.bold, size: 18, color: rgb(1, 1, 1) });
  page.drawText(`${person.location || ""}`, { x: width - 200, y: height - 42, font: fonts.regular, size: 10, color: rgb(0.68, 0.8, 0.84) });
  page.drawText(today, { x: width - 120, y: height - 110, font: fonts.regular, size: 10, color: rgb(0.3, 0.35, 0.4) });
  page.drawText(title, { x: 40, y: height - 140, font: fonts.bold, size: 20, color: rgb(0.1, 0.16, 0.21) });
  let y = height - 180;
  for (const line of wrap(body, fonts.regular, 11, width - 80)) {
    if (y < 130) { page = pdf.addPage([595.28, 841.89]); y = height - 60; }
    if (line.startsWith("§")) { y -= 6; page.drawText(line, { x: 40, y, font: fonts.bold, size: 11, color: rgb(0.1, 0.16, 0.21) }); }
    else page.drawText(line, { x: 40, y, font: fonts.regular, size: 11, color: rgb(0.2, 0.25, 0.3) });
    y -= 17;
  }
  page.drawLine({ start: { x: 40, y: 90 }, end: { x: 240, y: 90 }, thickness: 0.7, color: rgb(0.5, 0.55, 0.6) });
  page.drawText("Ort, Datum, Unterschrift Arbeitgeber", { x: 40, y: 76, font: fonts.regular, size: 8, color: rgb(0.5, 0.55, 0.6) });
  if (type !== "certificate") {
    page.drawLine({ start: { x: 320, y: 90 }, end: { x: 555, y: 90 }, thickness: 0.7, color: rgb(0.5, 0.55, 0.6) });
    page.drawText("Unterschrift Arbeitnehmer/in", { x: 320, y: 76, font: fonts.regular, size: 8, color: rgb(0.5, 0.55, 0.6) });
  }
  if (footnote) page.drawText(footnote, { x: 40, y: 40, font: fonts.regular, size: 8, color: rgb(0.7, 0.4, 0.2) });
  await env.DB.prepare("INSERT INTO audit_log (user_id, action, entity_id, details, created_at) VALUES (?, 'createStaffForm', ?, ?, ?)").bind(user.id, id, JSON.stringify({ type }), new Date().toISOString()).run();
  return new Response(await pdf.save(), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${title.replace(/[^a-zA-Z0-9]+/g, "-")}-${person.full_name.replace(/[^a-zA-Z0-9]+/g, "-")}.pdf"`, "Cache-Control": "private, no-store" } });
}
