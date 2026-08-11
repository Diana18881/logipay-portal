import { env } from "@logipay/env";
import { ensureDomainDatabase } from "../../../../lib/domain";

type TrackerEnvironment = typeof env & { TRACKER_INGEST_TOKEN?: string };

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1)
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export async function POST(request: Request) {
  const token = (env as TrackerEnvironment).TRACKER_INGEST_TOKEN;
  if (!token)
    return Response.json(
      { error: "Tracker-Schnittstelle ist noch nicht freigeschaltet" },
      { status: 503 },
    );
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ") || !safeEqual(authorization.slice(7), token))
    return Response.json({ error: "Ungültiger Tracker-Schlüssel" }, { status: 401 });
  if (Number(request.headers.get("content-length") || 0) > 32_768)
    return Response.json({ error: "Payload zu groß" }, { status: 413 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Ungültiges JSON" }, { status: 400 });
  }
  const deviceId = String(body.deviceId || "").trim();
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  const speedKph = Number(body.speedKph || 0);
  const heading = body.heading == null ? null : Number(body.heading);
  const odometerKm = body.odometerKm == null ? null : Number(body.odometerKm);
  if (!deviceId || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180)
    return Response.json({ error: "Geräte-ID oder GPS-Koordinaten ungültig" }, { status: 400 });
  if (!Number.isFinite(speedKph) || speedKph < 0 || speedKph > 250)
    return Response.json({ error: "Geschwindigkeit ungültig" }, { status: 400 });
  if (heading !== null && (!Number.isFinite(heading) || heading < 0 || heading >= 360))
    return Response.json({ error: "Fahrtrichtung ungültig" }, { status: 400 });
  if (odometerKm !== null && (!Number.isFinite(odometerKm) || odometerKm < 0))
    return Response.json({ error: "Kilometerstand ungültig" }, { status: 400 });

  await ensureDomainDatabase();
  const tracker = await env.DB.prepare(
    "SELECT id, license_plate, provider FROM truck_trackers WHERE device_id=? AND enabled=1",
  ).bind(deviceId).first<{ id: number; license_plate: string; provider: string }>();
  if (!tracker)
    return Response.json({ error: "Unbekannter oder deaktivierter Tracker" }, { status: 404 });

  const receivedAt = new Date().toISOString();
  const recordedAtCandidate = body.recordedAt ? new Date(String(body.recordedAt)) : new Date(receivedAt);
  if (Number.isNaN(recordedAtCandidate.getTime()))
    return Response.json({ error: "Zeitstempel ungültig" }, { status: 400 });
  const recordedAt = recordedAtCandidate.toISOString();
  const ignition = body.ignition === true || body.ignition === 1 || String(body.ignition).toLowerCase() === "true";
  const source = tracker.provider.toLowerCase() === "fleetboard" ? "fleetboard" : "tracker";
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO truck_positions (tracker_id, license_plate, latitude, longitude, speed_kph, heading, ignition, odometer_km, address, source, recorded_at, received_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(tracker.id, tracker.license_plate, latitude, longitude, speedKph, heading, ignition ? 1 : 0, odometerKm, String(body.address || "").slice(0, 300), source, recordedAt, receivedAt),
    env.DB.prepare("UPDATE truck_trackers SET last_connected_at=?, updated_at=? WHERE id=?")
      .bind(receivedAt, receivedAt, tracker.id),
  ]);
  return Response.json({ accepted: true, licensePlate: tracker.license_plate, recordedAt }, { status: 202 });
}
