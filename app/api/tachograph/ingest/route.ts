import { env } from "cloudflare:workers";
import { ensureDomainDatabase } from "../../../../lib/domain";

type TachographEnvironment = typeof env & { TACHOGRAPH_INGEST_TOKEN?: string };

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export async function POST(request: Request) {
  const token = (env as TachographEnvironment).TACHOGRAPH_INGEST_TOKEN;
  if (!token) return Response.json({ error: "Tachograph-Schnittstelle ist noch nicht freigeschaltet" }, { status: 503 });
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ") || !safeEqual(authorization.slice(7), token))
    return Response.json({ error: "Ungültiger Schnittstellenschlüssel" }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Ungültiges JSON" }, { status: 400 });
  const staffId = Number(body.staffId);
  const licensePlate = String(body.licensePlate || "").trim();
  const recordDate = String(body.recordDate || "");
  const drivingMinutes = Number(body.drivingMinutes || 0);
  const restMinutes = Number(body.restMinutes || 0);
  const remainingMinutes = Number(body.remainingMinutes || 0);
  if (!staffId || !licensePlate || !/^20\d{2}-\d{2}-\d{2}$/.test(recordDate) || [drivingMinutes, restMinutes, remainingMinutes].some((value) => !Number.isFinite(value) || value < 0 || value > 1440))
    return Response.json({ error: "Fahrer, Fahrzeug, Datum oder Zeitwerte ungültig" }, { status: 400 });
  await ensureDomainDatabase();
  const staff = await env.DB.prepare("SELECT id FROM staff WHERE id=? AND status='active'").bind(staffId).first();
  if (!staff) return Response.json({ error: "Fahrer nicht gefunden" }, { status: 404 });
  const now = new Date().toISOString();
  const result = await env.DB.prepare("INSERT INTO tachograph_records (staff_id, license_plate, record_date, driving_minutes, rest_minutes, remaining_minutes, infringement, source, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'telematics', ?, ?, ?)")
    .bind(staffId, licensePlate, recordDate, drivingMinutes, restMinutes, remainingMinutes, String(body.infringement || "").slice(0, 300), String(body.notes || "").slice(0, 500), now, now).run();
  if (remainingMinutes <= 90 || body.infringement)
    await env.DB.prepare("INSERT INTO notifications (role_scope, category, title, message, entity_type, entity_id, severity, created_at) VALUES ('dispatcher', 'tachograph', 'Tachograph-Warnung', ?, 'tachograph', ?, 'warning', ?)")
      .bind(`${licensePlate}: ${body.infringement || `nur noch ${remainingMinutes} Minuten Fahrzeit`}`, String(result.meta.last_row_id), now).run();
  return Response.json({ accepted: true, id: result.meta.last_row_id }, { status: 202 });
}
