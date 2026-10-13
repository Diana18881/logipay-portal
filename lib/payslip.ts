import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";

export type PayslipRow = Record<string, string | number | null>;
export type PdfFonts = { regular: PDFFont; bold: PDFFont };

/** Creates a PDF document with the embedded DejaVu fonts served from /public. */
export async function createPdf(request: Request): Promise<{ pdf: PDFDocument; fonts: PdfFonts }> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const cookie = request.headers.get("cookie");
  const headers = cookie ? { cookie } : undefined;
  const [regularResponse, boldResponse] = await Promise.all([fetch(new URL("/DejaVuSans.ttf", request.url), { headers }), fetch(new URL("/DejaVuSans-Bold.ttf", request.url), { headers })]);
  const regular = await pdf.embedFont(await regularResponse.arrayBuffer(), { subset: true });
  const bold = await pdf.embedFont(await boldResponse.arrayBuffer(), { subset: true });
  return { pdf, fonts: { regular, bold } };
}

export function drawPayslip(pdf: PDFDocument, { regular, bold }: PdfFonts, row: PayslipRow) {
  const page = pdf.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  page.drawRectangle({ x: 0, y: height - 92, width, height: 92, color: rgb(0.035, 0.105, 0.19) });
  page.drawText("LOGIPAY", { x: 38, y: height - 47, font: bold, size: 21, color: rgb(1, 1, 1) });
  page.drawText("Lohnabrechnung", { x: width - 220, y: height - 46, font: bold, size: 18, color: rgb(1, 1, 1) });
  page.drawText(`Abrechnungsmonat ${row.period}`, { x: width - 220, y: height - 66, font: regular, size: 9, color: rgb(0.68, 0.8, 0.84) });
  page.drawText(String(row.full_name), { x: 38, y: height - 145, font: bold, size: 17, color: rgb(0.1, 0.16, 0.21) });
  page.drawText(`${row.company || "—"} · ${row.location || "—"}`, { x: 38, y: height - 165, font: regular, size: 9, color: rgb(0.42, 0.48, 0.52) });
  const money = (value: unknown) => `${Number(value || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;
  const items: [string, string][] = [
    ["Grundgehalt", money(row.base_salary)],
    ["Arbeitstage", String(row.tour_count)],
    ["Spesen", money(row.expenses)],
    ["Nachtzuschläge", money(row.night_bonus)],
    ["Sonntagszuschläge", money(row.sunday_bonus)],
    ["Feiertagszuschläge", money(row.holiday_bonus)],
    ["Erstattung privater Auslagen", money(row.reimbursements)],
    ["Abzüge", `- ${money(row.deductions)}`],
  ];
  let y = height - 225;
  for (const [label, value] of items) {
    page.drawText(label, { x: 48, y, font: regular, size: 11, color: rgb(0.25, 0.31, 0.36) });
    page.drawText(value, { x: width - 190, y, font: bold, size: 11, color: rgb(0.12, 0.18, 0.23) });
    page.drawLine({ start: { x: 42, y: y - 12 }, end: { x: width - 42, y: y - 12 }, thickness: 0.6, color: rgb(0.88, 0.91, 0.92) });
    y -= 48;
  }
  page.drawRectangle({ x: 38, y: y - 24, width: width - 76, height: 70, color: rgb(0.9, 0.98, 0.96) });
  page.drawText("AUSZAHLUNG", { x: 55, y: y + 3, font: bold, size: 12, color: rgb(0.08, 0.49, 0.43) });
  page.drawText(money(row.net_amount), { x: width - 210, y: y - 2, font: bold, size: 20, color: rgb(0.035, 0.105, 0.19) });
  page.drawText(`Zahlungsstatus: ${row.payment_status}${row.locked_at ? " · Monat geschlossen" : ""}`, { x: 42, y: 80, font: regular, size: 9, color: rgb(0.42, 0.48, 0.52) });
  page.drawText(`Erstellt am ${new Date().toLocaleDateString("de-DE")}`, { x: width - 170, y: 80, font: regular, size: 9, color: rgb(0.42, 0.48, 0.52) });
}
