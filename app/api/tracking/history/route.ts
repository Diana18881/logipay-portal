import { env } from "cloudflare:workers";
import { ensureDomainDatabase } from "../../../../lib/domain";
import { requirePortalUser } from "../../../../lib/auth";

export async function GET(request: Request) {
  const user = await requirePortalUser(["management", "dispatcher", "driver"]);
  await ensureDomainDatabase();
  const url = new URL(request.url);
  const licensePlate = String(url.searchParams.get("plate") || "").trim();
  const limit = Math.min(250, Math.max(1, Number(url.searchParams.get("limit") || 100)));
  if (!licensePlate)
    return Response.json({ error: "Kennzeichen fehlt" }, { status: 400 });

  if (user.role === "driver") {
    const allowed = await env.DB.prepare(
      `SELECT 1 FROM weekly_planning p LEFT JOIN staff s ON s.id=p.staff_id
       WHERE p.license_plate=? AND (s.user_id=? OR p.driver_name=?) LIMIT 1`,
    ).bind(licensePlate, user.id, user.fullName).first();
    if (!allowed) return Response.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const rows = await env.DB.prepare(
    `SELECT latitude, longitude, speed_kph, heading, ignition, odometer_km, address, source, recorded_at, received_at
     FROM truck_positions WHERE license_plate=? ORDER BY recorded_at DESC, id DESC LIMIT ?`,
  ).bind(licensePlate, limit).all();
  return Response.json({ rows: rows.results });
}
