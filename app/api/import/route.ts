import { env } from "cloudflare:workers";
import { requirePortalUser } from "../../../lib/auth";
import { ensureDomainDatabase } from "../../../lib/domain";

type ImportRow = Record<string, unknown>;
const value = (row: ImportRow, names: string[]) => {
  const entries = Object.entries(row);
  for (const name of names) {
    const hit = entries.find(([key]) => key.trim().toLowerCase().replace(/[^a-z0-9äöüß]/g, "") === name.toLowerCase().replace(/[^a-z0-9äöüß]/g, ""));
    if (hit && String(hit[1] ?? "").trim()) return String(hit[1]).trim();
  }
  return "";
};

export async function POST(request: Request) {
  const user = await requirePortalUser(["management", "dispatcher"]);
  await ensureDomainDatabase();
  const body = await request.json().catch(() => null) as { type?: string; rows?: ImportRow[]; year?: number; kw?: number } | null;
  const type = String(body?.type || "");
  const rows = Array.isArray(body?.rows) ? body!.rows.slice(0, 2000) : [];
  if (!rows.length || !["staff", "vehicles", "planning"].includes(type)) return Response.json({ error: "Keine gültigen Importdaten" }, { status: 400 });
  const now = new Date().toISOString();
  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];
  for (const [index, row] of rows.entries()) {
    try {
      if (type === "staff") {
        const fullName = value(row, ["NAME", "Fahrer", "Driver", "Full Name"]);
        if (!fullName) { skipped += 1; continue; }
        const duplicate = await env.DB.prepare("SELECT id FROM staff WHERE lower(full_name)=lower(?)").bind(fullName).first();
        if (duplicate) { skipped += 1; continue; }
        await env.DB.prepare("INSERT INTO staff (full_name, system_type, compensation, location, company, vacation, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, '', 'active', ?, ?)").bind(fullName, value(row, ["SYSTEM ART", "Systemart", "System Type"]), value(row, ["VERGÜTUNG", "Vergütung", "Salary"]), value(row, ["STANDORT", "Standort", "Location", "Base"]), value(row, ["FIRMA", "Firma", "Company"]), now, now).run();
      } else if (type === "vehicles") {
        const plate = value(row, ["Kennzeichen", "Licence Plate", "License Plate", "LKW", "Truck Number", "Plate"]);
        if (!plate) { skipped += 1; continue; }
        const duplicate = await env.DB.prepare("SELECT id FROM vehicles WHERE upper(license_plate)=upper(?)").bind(plate).first();
        if (duplicate) { skipped += 1; continue; }
        await env.DB.prepare("INSERT INTO vehicles (license_plate, company, location, status, inspection_due, notes, created_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?, ?, ?)").bind(plate, value(row, ["Firma", "Company"]), value(row, ["Standort", "Location", "Base"]), value(row, ["TÜV", "HU", "Inspection Due"] ) || null, value(row, ["Notiz", "Notes", "Kommentar"]), now, now).run();
      } else {
        const driverName = value(row, ["Fahrer", "Driver", "NAME", "Name"]);
        const plate = value(row, ["Kennzeichen", "Licence Plate", "License Plate", "LKW", "Truck Number"]);
        if (!driverName && !plate) { skipped += 1; continue; }
        const staff = driverName ? await env.DB.prepare("SELECT id FROM staff WHERE lower(full_name)=lower(?) AND status='active'").bind(driverName).first<{ id: number }>() : null;
        const duplicate = await env.DB.prepare("SELECT id FROM weekly_planning WHERE planning_year=? AND calendar_week=? AND lower(driver_name)=lower(?) AND license_plate=?").bind(Number(body?.year || new Date().getFullYear()), Number(body?.kw || 1), driverName, plate).first();
        if (duplicate) { skipped += 1; continue; }
        await env.DB.prepare("INSERT INTO weekly_planning (planning_year, calendar_week, company, staff_id, driver_name, location, license_plate, work_days, start_time, block_id, status, comments, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, '1,2,3,4,5,6,7', ?, ?, 'planned', ?, ?, ?)").bind(Number(body?.year || new Date().getFullYear()), Number(body?.kw || 1), value(row, ["Firma", "Company"]), staff?.id || null, driverName, value(row, ["Standort", "Location", "Base"]), plate, value(row, ["Start", "Start Time", "Zeit"] ) || "06:00", value(row, ["Block ID", "Block", "Tour"]), value(row, ["Kommentar", "Comments", "Notiz"]), now, now).run();
      }
      inserted += 1;
    } catch (error) {
      errors.push(`Zeile ${index + 2}: ${error instanceof Error ? error.message : "Fehler"}`);
    }
  }
  await env.DB.prepare("INSERT INTO audit_log (user_id, action, entity_id, details, created_at) VALUES (?, 'excelImport', ?, ?, ?)").bind(user.id, type, JSON.stringify({ type, inserted, skipped, errors: errors.length, year: body?.year, kw: body?.kw }), now).run();
  return Response.json({ inserted, skipped, errors: errors.slice(0, 20) });
}
