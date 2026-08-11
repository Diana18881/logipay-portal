import { env } from "@logipay/env";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";
import { requirePortalUser } from "../../../../lib/auth";
import { ensureDomainDatabase } from "../../../../lib/domain";

type Row = Record<string, string | number | null>;

export async function GET(request: Request) {
  const user = await requirePortalUser(["management"]);
  await ensureDomainDatabase();
  const rawDate = new URL(request.url).searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const date = /^20\d{2}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : new Date().toISOString().slice(0, 10);
  const [completed, problems, expenses, vehicles, staff] = await Promise.all([
    env.DB.prepare("SELECT o.*, p.driver_name, p.license_plate, p.company FROM trip_operations o JOIN weekly_planning p ON p.id=o.planning_id WHERE date(o.delivered_at)=? ORDER BY o.delivered_at DESC").bind(date).all<Row>(),
    env.DB.prepare("SELECT o.*, p.driver_name, p.license_plate, p.company FROM trip_operations o JOIN weekly_planning p ON p.id=o.planning_id WHERE (o.status='Problem' OR COALESCE(o.delay_reason,'')!='') AND date(o.updated_at)=? ORDER BY o.updated_at DESC").bind(date).all<Row>(),
    env.DB.prepare("SELECT e.*, s.full_name FROM expenses e JOIN staff s ON s.id=e.staff_id WHERE e.expense_date=? ORDER BY e.gross_amount DESC").bind(date).all<Row>(),
    env.DB.prepare("SELECT license_plate, status, company, location, inspection_due FROM vehicles ORDER BY license_plate").all<Row>(),
    env.DB.prepare("SELECT full_name, status, company, location FROM staff ORDER BY full_name").all<Row>(),
  ]);
  const totalExpenses = expenses.results.reduce((sum, row) => sum + Number(row.gross_amount || 0), 0);
  const unavailable = staff.results.filter((row) => row.status !== "active").length;
  const workshop = vehicles.results.filter((row) => row.status === "workshop").length;
  const now = new Date().toISOString();
  await env.DB.prepare("INSERT INTO audit_log (user_id, action, entity_id, details, created_at) VALUES (?, 'dailyManagementReport', ?, ?, ?)")
    .bind(user.id, date, JSON.stringify({ date, completed: completed.results.length, problems: problems.results.length, expenses: totalExpenses, unavailable, workshop }), now).run();

  const pdf = await PDFDocument.create(); pdf.registerFontkit(fontkit);
  const headers = request.headers.get("cookie") ? { cookie: request.headers.get("cookie") || "" } : undefined;
  const [regularResponse, boldResponse] = await Promise.all([fetch(new URL("/DejaVuSans.ttf", request.url), { headers }), fetch(new URL("/DejaVuSans-Bold.ttf", request.url), { headers })]);
  if (!regularResponse.ok || !boldResponse.ok) return Response.json({ error: "PDF-Schrift konnte nicht geladen werden" }, { status: 500 });
  const regular = await pdf.embedFont(await regularResponse.arrayBuffer(), { subset: true }); const bold = await pdf.embedFont(await boldResponse.arrayBuffer(), { subset: true });
  const page = pdf.addPage([841.89, 595.28]); const navy = rgb(0.035, 0.105, 0.19); const mint = rgb(0.08, 0.68, 0.58); const ink = rgb(0.12, 0.18, 0.23); const muted = rgb(0.43, 0.49, 0.53); const soft = rgb(0.94, 0.98, 0.97);
  page.drawRectangle({ x: 0, y: 515, width: 842, height: 80, color: navy });
  page.drawText("LOGIPAY", { x: 34, y: 551, size: 20, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Taegliche Management-Summary", { x: 160, y: 552, size: 16, font: bold, color: rgb(1, 1, 1) });
  page.drawText(`${date} · automatisch aus dem aktuellen Datenbestand`, { x: 160, y: 535, size: 8, font: regular, color: rgb(0.72, 0.82, 0.85) });
  const metrics = [["TOUREN ERLEDIGT", completed.results.length], ["PROBLEME / VERSPAETUNGEN", problems.results.length], ["AUSGABEN", `${totalExpenses.toFixed(2)} EUR`], ["NICHT VERFUEGBAR", unavailable], ["WERKSTATT", workshop]];
  metrics.forEach(([label, value], index) => { const x = 34 + index * 155; page.drawRectangle({ x, y: 442, width: 140, height: 52, color: soft }); page.drawText(String(label), { x: x + 10, y: 476, size: 6.5, font: bold, color: muted }); page.drawText(String(value), { x: x + 10, y: 455, size: 15, font: bold, color: navy }); });
  const drawList = (x: number, y: number, width: number, title: string, rows: string[], accent = mint) => {
    page.drawText(title, { x, y, size: 11, font: bold, color: navy }); page.drawLine({ start: { x, y: y - 7 }, end: { x: x + width, y: y - 7 }, thickness: 2, color: accent });
    if (!rows.length) page.drawText("Keine Eintraege", { x, y: y - 29, size: 8, font: regular, color: muted });
    rows.slice(0, 9).forEach((line, index) => { const short = line.length > 67 ? `${line.slice(0, 66)}…` : line; page.drawText(short, { x, y: y - 28 - index * 19, size: 7.5, font: regular, color: ink }); });
  };
  drawList(34, 409, 365, "Erledigte Touren", completed.results.map((row) => `${row.driver_name || "Ohne Fahrer"} · ${row.license_plate || "—"} · ${row.company || "—"}`));
  drawList(430, 409, 378, "Probleme und Verspaetungen", problems.results.map((row) => `${row.license_plate || "—"} · ${row.driver_name || "—"}: ${row.delay_reason || row.status}`), rgb(0.88, 0.34, 0.28));
  drawList(34, 205, 365, "Ausgaben und Erstattungen", expenses.results.map((row) => `${row.full_name} · ${row.category} · ${Number(row.gross_amount || 0).toFixed(2)} EUR · ${row.status}`));
  drawList(430, 205, 378, "Zustand des Fuhrparks", vehicles.results.filter((row) => row.status !== "active" || row.inspection_due).map((row) => `${row.license_plate} · ${row.status} · Pruefung ${row.inspection_due || "offen"}`));
  page.drawText(`Erstellt fuer ${user.fullName} · ${new Date(now).toLocaleString("de-DE")}`, { x: 34, y: 24, size: 7, font: regular, color: muted });
  page.drawText("Vertraulich · Management", { x: 680, y: 24, size: 7, font: bold, color: mint });
  return new Response(await pdf.save(), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="LOGIPAY-Tagesbericht-${date}.pdf"`, "Cache-Control": "private, no-store" } });
}
