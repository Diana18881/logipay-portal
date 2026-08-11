import { env } from "cloudflare:workers";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { requirePortalUser } from "../../../../lib/auth";
import { ensureDomainDatabase } from "../../../../lib/domain";

type Row = Record<string, string | number | null>;

const money = (value: unknown) => Number(value || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const validDate = (value: string | null) => /^20\d{2}-\d{2}-\d{2}$/.test(value || "") ? value! : null;

export async function GET(request: Request) {
  const user = await requirePortalUser(["management", "accountant"]);
  await ensureDomainDatabase();
  const url = new URL(request.url);
  const today = new Date().toISOString().slice(0, 10);
  const from = validDate(url.searchParams.get("from")) || `${today.slice(0, 4)}-01-01`;
  const to = validDate(url.searchParams.get("to")) || today;
  const audience = url.searchParams.get("audience") === "amazon" ? "amazon" : "finanzamt";
  const format = url.searchParams.get("format") === "csv" ? "csv" : "pdf";
  if (from > to) return Response.json({ error: "Der Zeitraum ist ungültig" }, { status: 400 });
  const result = await env.DB.prepare(`SELECT e.*, s.full_name, s.company AS staff_company, s.location AS staff_location
    FROM expenses e JOIN staff s ON s.id=e.staff_id
    WHERE e.expense_date BETWEEN ? AND ?
    ORDER BY e.expense_date, s.full_name, e.id`).bind(from, to).all<Row>();
  const rows = result.results;
  const now = new Date().toISOString();
  await env.DB.prepare("INSERT INTO audit_log (user_id, action, entity_id, details, created_at) VALUES (?, 'exportExpenseReport', '', ?, ?)")
    .bind(user.id, JSON.stringify({ audience, format, from, to, count: rows.length }), now).run();

  if (format === "csv") {
    const headers = audience === "amazon"
      ? ["Datum", "Amazon Standort", "Block ID", "Tourreferenz", "Fahrer", "Firma", "Kennzeichen", "Kategorie", "Anbieter", "Brutto EUR", "MwSt. EUR", "Kostenstelle", "Status", "Belegnummer", "Belegdatei"]
      : ["Datum", "Belegnummer", "Fahrer", "Firma", "Kennzeichen", "Kategorie", "Anbieter", "Netto EUR", "MwSt. EUR", "Brutto EUR", "Zahlungsart", "Erstattung EUR", "Zahlungsreferenz", "Zahlungsdatum", "Kostenstelle", "Status", "Belegdatei"];
    const data = rows.map((row) => audience === "amazon"
      ? [row.expense_date, row.amazon_site, row.block_id, row.tour_reference, row.full_name, row.staff_company, row.license_plate, row.category, row.merchant, money(row.gross_amount), money(row.vat_amount), row.cost_center, row.status, row.receipt_number, row.receipt_file_name]
      : [row.expense_date, row.receipt_number, row.full_name, row.staff_company, row.license_plate, row.category, row.merchant, money(Number(row.gross_amount || 0) - Number(row.vat_amount || 0)), money(row.vat_amount), money(row.gross_amount), row.payment_method, money(row.reimbursement_amount), row.payment_reference, row.paid_at, row.cost_center, row.status, row.receipt_file_name]);
    const csv = `\uFEFF${[headers, ...data].map((line) => line.map(csvCell).join(";")).join("\r\n")}`;
    return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="LOGIPAY-${audience}-${from}-${to}.csv"`, "Cache-Control": "private, no-store" } });
  }

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fontHeaders = request.headers.get("cookie") ? { cookie: request.headers.get("cookie") || "" } : undefined;
  const [regularResponse, boldResponse] = await Promise.all([
    fetch(new URL("/DejaVuSans.ttf", request.url), { headers: fontHeaders }),
    fetch(new URL("/DejaVuSans-Bold.ttf", request.url), { headers: fontHeaders }),
  ]);
  if (!regularResponse.ok || !boldResponse.ok) return Response.json({ error: "PDF-Schrift konnte nicht geladen werden" }, { status: 500 });
  const regular = await pdf.embedFont(await regularResponse.arrayBuffer(), { subset: true });
  const bold = await pdf.embedFont(await boldResponse.arrayBuffer(), { subset: true });
  const pageSize: [number, number] = [841.89, 595.28];
  const navy = rgb(0.035, 0.105, 0.19); const mint = rgb(0.08, 0.63, 0.55); const ink = rgb(0.12, 0.18, 0.23); const muted = rgb(0.42, 0.48, 0.52); const line = rgb(0.88, 0.91, 0.92);
  const fit = (font: PDFFont, value: unknown, width: number, size = 7) => {
    const text = String(value ?? "—").replace(/\s+/g, " ");
    if (font.widthOfTextAtSize(text, size) <= width) return text;
    let short = text;
    while (short.length > 1 && font.widthOfTextAtSize(`${short}…`, size) > width) short = short.slice(0, -1);
    return `${short}…`;
  };
  const title = audience === "amazon" ? "Amazon Ausgabenbericht" : "Finanzamt Belegjournal";
  const totalGross = rows.reduce((sum, row) => sum + Number(row.gross_amount || 0), 0);
  const totalVat = rows.reduce((sum, row) => sum + Number(row.vat_amount || 0), 0);
  const totalReimbursement = rows.reduce((sum, row) => sum + Number(row.reimbursement_amount || 0), 0);
  const createPage = (continuation = false) => {
    const page = pdf.addPage(pageSize); const { width, height } = page.getSize();
    page.drawRectangle({ x: 0, y: height - 68, width, height: 68, color: navy });
    page.drawText("LOGIPAY", { x: 32, y: height - 39, size: 18, font: bold, color: rgb(1, 1, 1) });
    page.drawText(continuation ? `${title} · Fortsetzung` : title, { x: 145, y: height - 35, size: 15, font: bold, color: rgb(1, 1, 1) });
    page.drawText(`${from} bis ${to} · ${rows.length} Belege`, { x: 145, y: height - 51, size: 8, font: regular, color: rgb(0.7, 0.8, 0.84) });
    return page;
  };
  let page = createPage();
  const drawMetric = (x: number, label: string, value: string) => { page.drawRectangle({ x, y: 454, width: 170, height: 54, color: rgb(0.94, 0.98, 0.97), borderColor: rgb(0.83, 0.91, 0.9), borderWidth: 0.6 }); page.drawText(label, { x: x + 12, y: 486, size: 7, font: bold, color: muted }); page.drawText(value, { x: x + 12, y: 466, size: 14, font: bold, color: navy }); };
  drawMetric(32, "BRUTTO GESAMT", `${money(totalGross)} EUR`); drawMetric(214, "MWST. GESAMT", `${money(totalVat)} EUR`); drawMetric(396, "ERSTATTUNGEN", `${money(totalReimbursement)} EUR`); drawMetric(578, "BELEGE", String(rows.length));
  const headers = audience === "amazon" ? ["Datum", "Site / Block", "Fahrer", "Kennzeichen", "Kategorie", "Brutto", "Tour", "Status"] : ["Datum", "Beleg-Nr.", "Fahrer", "Anbieter", "Netto", "MwSt.", "Brutto", "Status"];
  const widths = audience === "amazon" ? [66, 115, 125, 82, 105, 76, 105, 92] : [66, 92, 125, 120, 75, 70, 75, 105];
  let y = 425;
  const drawHeader = (target: PDFPage) => { let x = 32; target.drawRectangle({ x: 32, y: y - 17, width: widths.reduce((sum, width) => sum + width, 0), height: 21, color: rgb(0.92, 0.96, 0.97) }); headers.forEach((label, index) => { target.drawText(label, { x: x + 5, y: y - 10, size: 7, font: bold, color: muted }); x += widths[index]; }); y -= 22; };
  drawHeader(page);
  for (const row of rows) {
    if (y < 52) { page = createPage(true); y = 492; drawHeader(page); }
    const values = audience === "amazon"
      ? [row.expense_date, [row.amazon_site, row.block_id].filter(Boolean).join(" / "), row.full_name, row.license_plate, row.category, `${money(row.gross_amount)} €`, row.tour_reference, row.status]
      : [row.expense_date, row.receipt_number, row.full_name, row.merchant, `${money(Number(row.gross_amount || 0) - Number(row.vat_amount || 0))} €`, `${money(row.vat_amount)} €`, `${money(row.gross_amount)} €`, row.status];
    let x = 32; page.drawLine({ start: { x: 32, y: y + 5 }, end: { x: 32 + widths.reduce((sum, width) => sum + width, 0), y: y + 5 }, thickness: 0.5, color: line });
    values.forEach((value, index) => { page.drawText(fit(regular, value, widths[index] - 10), { x: x + 5, y: y - 9, size: 7, font: regular, color: ink }); x += widths[index]; }); y -= 22;
  }
  if (!rows.length) page.drawText("Im gewählten Zeitraum wurden keine Ausgaben gefunden.", { x: 32, y: 390, size: 11, font: regular, color: muted });
  const pages = pdf.getPages(); pages.forEach((item, index) => { item.drawText(`Seite ${index + 1} / ${pages.length}`, { x: 740, y: 24, size: 7, font: regular, color: muted }); item.drawText("Belege sind geschützt im LOGIPAY-Archiv gespeichert.", { x: 32, y: 24, size: 7, font: regular, color: mint }); });
  const bytes = await pdf.save();
  return new Response(bytes, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="LOGIPAY-${audience}-${from}-${to}.pdf"`, "Cache-Control": "private, no-store" } });
}
