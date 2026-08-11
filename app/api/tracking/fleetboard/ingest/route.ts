import { env } from "@logipay/env";
import { ensureDomainDatabase } from "../../../../../lib/domain";

type FleetboardEnvironment = typeof env & { TRACKER_INGEST_TOKEN?: string };
type FleetboardPayload = Record<string, unknown>;
type FleetboardTracker = { id: number; license_plate: string; device_id: string };

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1)
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

function firstValue(payload: FleetboardPayload, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function booleanValue(value: unknown) {
  return value === true || value === 1 || ["true", "on", "1", "running"].includes(String(value || "").toLowerCase());
}

function normalizePosition(payload: FleetboardPayload) {
  const deviceId = String(firstValue(payload, ["deviceId", "vehicleId", "fleetboardVehicleId", "vin", "externalId"]) || "").trim();
  const latitude = Number(firstValue(payload, ["latitude", "lat"]));
  const longitude = Number(firstValue(payload, ["longitude", "lng", "lon"]));
  const speedKph = Number(firstValue(payload, ["speedKph", "speed", "velocity"]) || 0);
  const headingValue = firstValue(payload, ["heading", "course", "direction"]);
  const odometerValue = firstValue(payload, ["odometerKm", "mileageKm", "odometer"]);
  const recordedValue = firstValue(payload, ["recordedAt", "positionTime", "timestamp", "eventTime"]);
  const recordedAt = recordedValue ? new Date(String(recordedValue)) : new Date();
  const heading = headingValue === null ? null : Number(headingValue);
  const odometerKm = odometerValue === null ? null : Number(odometerValue);
  const error = !deviceId
    ? "Fleetboard Fahrzeug-ID / VIN fehlt"
    : !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180
      ? "GPS-Koordinaten ungültig"
      : !Number.isFinite(speedKph) || speedKph < 0 || speedKph > 250
        ? "Geschwindigkeit ungültig"
        : heading !== null && (!Number.isFinite(heading) || heading < 0 || heading >= 360)
          ? "Fahrtrichtung ungültig"
          : odometerKm !== null && (!Number.isFinite(odometerKm) || odometerKm < 0)
            ? "Kilometerstand ungültig"
            : Number.isNaN(recordedAt.getTime())
              ? "Zeitstempel ungültig"
              : null;
  return {
    error,
    deviceId,
    latitude,
    longitude,
    speedKph,
    heading,
    odometerKm,
    ignition: booleanValue(firstValue(payload, ["ignition", "engineOn", "engineState"])),
    address: String(firstValue(payload, ["address", "locationDescription", "place"]) || "").slice(0, 300),
    recordedAt: recordedAt.toISOString(),
  };
}

export async function POST(request: Request) {
  const token = (env as FleetboardEnvironment).TRACKER_INGEST_TOKEN;
  if (!token)
    return Response.json({ error: "Fleetboard-Bridge ist noch nicht freigeschaltet" }, { status: 503 });
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ") || !safeEqual(authorization.slice(7), token))
    return Response.json({ error: "Ungültiger Fleetboard-Schlüssel" }, { status: 401 });
  if (Number(request.headers.get("content-length") || 0) > 131_072)
    return Response.json({ error: "Payload zu groß" }, { status: 413 });

  let body: FleetboardPayload | FleetboardPayload[];
  try {
    body = (await request.json()) as FleetboardPayload | FleetboardPayload[];
  } catch {
    return Response.json({ error: "Ungültiges JSON" }, { status: 400 });
  }
  const positions = Array.isArray(body)
    ? body
    : Array.isArray(body.positions)
      ? body.positions.filter((item): item is FleetboardPayload => Boolean(item) && typeof item === "object")
      : [body];
  if (!positions.length || positions.length > 100)
    return Response.json({ error: "Pro Übertragung sind 1 bis 100 Positionen erlaubt" }, { status: 400 });

  await ensureDomainDatabase();
  const trackerRows = await env.DB.prepare(
    "SELECT id, license_plate, device_id FROM truck_trackers WHERE enabled=1 AND lower(provider)='fleetboard'",
  ).all<FleetboardTracker>();
  const trackers = new Map(trackerRows.results.map((tracker) => [tracker.device_id, tracker]));
  const receivedAt = new Date().toISOString();
  const statements: D1PreparedStatement[] = [];
  const errors: { index: number; error: string }[] = [];
  let accepted = 0;

  positions.forEach((payload, index) => {
    const normalized = normalizePosition(payload);
    const tracker = trackers.get(normalized.deviceId);
    if (normalized.error) {
      errors.push({ index, error: normalized.error });
      return;
    }
    if (!tracker) {
      errors.push({ index, error: `Fleetboard-ID ${normalized.deviceId} ist keinem aktiven Fahrzeug zugeordnet` });
      return;
    }
    statements.push(
      env.DB.prepare(
        "INSERT INTO truck_positions (tracker_id, license_plate, latitude, longitude, speed_kph, heading, ignition, odometer_km, address, source, recorded_at, received_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'fleetboard', ?, ?)",
      ).bind(tracker.id, tracker.license_plate, normalized.latitude, normalized.longitude, normalized.speedKph, normalized.heading, normalized.ignition ? 1 : 0, normalized.odometerKm, normalized.address, normalized.recordedAt, receivedAt),
      env.DB.prepare("UPDATE truck_trackers SET last_connected_at=?, updated_at=? WHERE id=?")
        .bind(receivedAt, receivedAt, tracker.id),
    );
    accepted += 1;
  });
  if (statements.length) await env.DB.batch(statements);

  return Response.json(
    { accepted, rejected: errors.length, receivedAt, errors: errors.slice(0, 20) },
    { status: accepted ? 202 : 422 },
  );
}
