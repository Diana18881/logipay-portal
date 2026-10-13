import { env } from "@logipay/env";
import { requirePortalUser } from "../../../lib/auth";
import { ensureDomainDatabase } from "../../../lib/domain";
import { parseNumber, parsePeriod, type PayrollRecord } from "../../../lib/payroll-import";
import { aiConfigured, aiMessages, type AiContentPart } from "../../../lib/ai";

/** PDF / image payslips → structured records automatisch. */
async function extractWithAi(file: File, fallbackPeriod: string): Promise<{ records?: PayrollRecord[]; error?: string }> {
  if (!aiConfigured()) return { error: "Für PDF- und Bilddateien muss das automatische Auslesen eingerichtet sein. Alternativ Excel- oder CSV-Datei hochladen." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const data = btoa(binary);
  const isPdf = file.type === "application/pdf";
  const part: AiContentPart = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
    : { type: "image", source: { type: "base64", media_type: file.type, data } };
  const prompt = `Extrahiere aus diesem Lohn-/Gehaltsdokument alle Mitarbeiter-Abrechnungen. Antworte NUR mit einem JSON-Array. Jedes Element: {"name": string, "period": "YYYY-MM" (Standard ${fallbackPeriod}), "baseSalary": number, "tourCount": number, "expenses": number, "nightBonus": number, "sundayBonus": number, "holidayBonus": number, "reimbursements": number, "deductions": number}. Beträge als Zahl in EUR ohne Symbol; fehlende Werte = 0. Brutto/Grundgehalt in baseSalary.`;
  const response = await aiMessages({ max_tokens: 4096, messages: [{ role: "user", content: [part, { type: "text", text: prompt }] }] });
  if (!response.ok) return { error: `Automatisches Auslesen fehlgeschlagen (${response.status})` };
  const text = response.text;
  const json = text.match(/\[[\s\S]*\]/)?.[0];
  if (!json) return { error: "Keine Abrechnungsdaten erkannt" };
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>[];
    const records = parsed.filter((item) => String(item.name || "").trim()).map((item) => {
      const record: PayrollRecord = {
        name: String(item.name).trim(), period: parsePeriod(item.period) || fallbackPeriod,
        baseSalary: parseNumber(item.baseSalary), tourCount: Math.round(parseNumber(item.tourCount)), expenses: parseNumber(item.expenses),
        nightBonus: parseNumber(item.nightBonus), sundayBonus: parseNumber(item.sundayBonus), holidayBonus: parseNumber(item.holidayBonus),
        reimbursements: parseNumber(item.reimbursements), deductions: parseNumber(item.deductions), netAmount: 0,
      };
      record.netAmount = Math.round((record.baseSalary + record.nightBonus + record.sundayBonus + record.holidayBonus + record.expenses + record.reimbursements - record.deductions) * 100) / 100;
      return record;
    });
    return { records };
  } catch { return { error: "Antwort konnte nicht gelesen werden" }; }
}

export async function POST(request: Request) {
  const user = await requirePortalUser(["management", "accountant"]);
  await ensureDomainDatabase();
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Datei fehlt" }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return Response.json({ error: "Maximal 10 MB" }, { status: 400 });
    if (!(file.type === "application/pdf" || /^image\/(png|jpeg|webp|gif)$/.test(file.type))) return Response.json({ error: "Nur PDF oder Bild" }, { status: 400 });
    const fallback = /^\d{4}-\d{2}$/.test(String(form.get("period"))) ? String(form.get("period")) : new Date().toISOString().slice(0, 7);
    const extracted = await extractWithAi(file, fallback);
    if (extracted.error) return Response.json({ error: extracted.error }, { status: 422 });
    return Response.json({ records: extracted.records });
  }

  const body = await request.json().catch(() => null) as { records?: PayrollRecord[] } | null;
  const records = Array.isArray(body?.records) ? body!.records.slice(0, 1000) : [];
  if (!records.length) return Response.json({ error: "Keine Datensätze" }, { status: 400 });
  const now = new Date().toISOString();
  const staff = (await env.DB.prepare("SELECT id, full_name FROM staff").all<{ id: number; full_name: string }>()).results;
  const byName = new Map(staff.map((row: { id: number; full_name: string }) => [row.full_name.trim().toLowerCase().replace(/\s+/g, " "), row.id]));
  const closed = new Set((await env.DB.prepare("SELECT period FROM payroll_periods WHERE status='closed'").all<{ period: string }>()).results.map((row: { period: string }) => row.period));
  let imported = 0;
  const problems: string[] = [];
  for (const record of records) {
    const staffId = byName.get(String(record.name).trim().toLowerCase().replace(/\s+/g, " "));
    if (!staffId) { problems.push(`${record.name}: Mitarbeiter nicht gefunden`); continue; }
    if (!/^\d{4}-\d{2}$/.test(record.period)) { problems.push(`${record.name}: ungültiger Monat`); continue; }
    if (closed.has(record.period)) { problems.push(`${record.name}: Monat ${record.period} ist geschlossen`); continue; }
    const locked = await env.DB.prepare("SELECT locked_at FROM payroll_calculations WHERE staff_id=? AND period=?").bind(staffId, record.period).first<{ locked_at: string | null }>();
    if (locked?.locked_at) { problems.push(`${record.name}: Abrechnung gesperrt`); continue; }
    const n = (value: unknown) => Math.round(parseNumber(value) * 100) / 100;
    const base = n(record.baseSalary), night = n(record.nightBonus), sunday = n(record.sundayBonus), holiday = n(record.holidayBonus);
    const expenses = n(record.expenses), reimb = n(record.reimbursements), deductions = n(record.deductions);
    const bonuses = Math.round((night + sunday + holiday) * 100) / 100;
    const net = Math.round((base + bonuses + expenses + reimb - deductions) * 100) / 100;
    const details = JSON.stringify({ source: "file-import" });
    await env.DB.prepare(`INSERT INTO payroll_calculations (staff_id, period, base_salary, tour_count, bonuses, expenses, night_bonus, sunday_bonus, holiday_bonus, reimbursements, deductions, net_amount, payment_status, calculation_details, calculated_at, calculated_by, locked_at, locked_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, NULL, NULL, ?, ?)
      ON CONFLICT(staff_id, period) DO UPDATE SET base_salary=excluded.base_salary, tour_count=excluded.tour_count, bonuses=excluded.bonuses, expenses=excluded.expenses, night_bonus=excluded.night_bonus, sunday_bonus=excluded.sunday_bonus, holiday_bonus=excluded.holiday_bonus, reimbursements=excluded.reimbursements, deductions=excluded.deductions, net_amount=excluded.net_amount, calculation_details=excluded.calculation_details, calculated_at=excluded.calculated_at, calculated_by=excluded.calculated_by, updated_at=excluded.updated_at`)
      .bind(staffId, record.period, base, Math.max(0, Math.round(parseNumber(record.tourCount))), bonuses, expenses, night, sunday, holiday, reimb, deductions, net, details, now, user.id, now, now).run();
    await env.DB.prepare("INSERT INTO payroll_periods (period, status, updated_at) VALUES (?, 'open', ?) ON CONFLICT(period) DO NOTHING").bind(record.period, now).run();
    imported += 1;
  }
  await env.DB.prepare("INSERT INTO audit_log (user_id, action, entity_id, details, created_at) VALUES (?, 'payrollFileImport', 'payroll', ?, ?)").bind(user.id, JSON.stringify({ imported, problems: problems.length }), now).run();
  return Response.json({ imported, problems: problems.slice(0, 30) });
}
