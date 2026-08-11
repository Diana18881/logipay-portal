import { env } from "cloudflare:workers";
import { requirePortalUser } from "../../../lib/auth";
import { ensureDomainDatabase } from "../../../lib/domain";

export async function POST(request: Request) {
  const user = await requirePortalUser(["driver"]);
  await ensureDomainDatabase();
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.type.startsWith("audio/"))
    return Response.json({ error: "Audioaufnahme fehlt" }, { status: 400 });
  if (file.size < 100 || file.size > 15 * 1024 * 1024)
    return Response.json({ error: "Audio muss zwischen 100 Byte und 15 MB groß sein" }, { status: 400 });

  const staff = await env.DB.prepare(
    "SELECT id, full_name FROM staff WHERE user_id=? AND status='active'",
  ).bind(user.id).first<{ id: number; full_name: string }>();
  if (!staff)
    return Response.json({ error: "Fahrerprofil ist nicht verknüpft" }, { status: 409 });

  let licensePlate = String(form.get("licensePlate") || "").trim();
  if (licensePlate) {
    const assigned = await env.DB.prepare(
      "SELECT 1 FROM weekly_planning WHERE staff_id=? AND license_plate=? LIMIT 1",
    ).bind(staff.id, licensePlate).first();
    if (!assigned)
      return Response.json({ error: "Fahrzeug ist Ihnen nicht zugeteilt" }, { status: 403 });
  } else {
    const latest = await env.DB.prepare(
      "SELECT license_plate FROM weekly_planning WHERE staff_id=? AND license_plate IS NOT NULL AND license_plate!='' ORDER BY planning_year DESC, calendar_week DESC, id DESC LIMIT 1",
    ).bind(staff.id).first<{ license_plate: string }>();
    licensePlate = latest?.license_plate || "";
  }

  const durationSeconds = Math.min(180, Math.max(0, Number(form.get("durationSeconds") || 0)));
  const note = String(form.get("note") || "").trim().slice(0, 500);
  const now = new Date().toISOString();
  const key = `sprachnachrichten/${staff.id}/${now.slice(0, 10)}/${crypto.randomUUID()}`;
  await env.DOCUMENTS.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
    customMetadata: { originalName: file.name },
  });
  const result = await env.DB.prepare(
    "INSERT INTO voice_messages (staff_id, user_id, license_plate, duration_seconds, file_name, object_key, content_type, size_bytes, note, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Neu', ?)",
  ).bind(staff.id, user.id, licensePlate, durationSeconds, file.name || "sprachnachricht", key, file.type, file.size, note, now).run();
  const messageId = String(result.meta.last_row_id);
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO notifications (role_scope, category, title, message, entity_type, entity_id, severity, created_at) VALUES ('dispatcher', 'voice', 'Neue Sprachnachricht', ?, 'voice_message', ?, 'urgent', ?)",
    ).bind(`${staff.full_name}${licensePlate ? ` · ${licensePlate}` : ""}${note ? ` · ${note}` : ""}`, messageId, now),
    env.DB.prepare(
      "INSERT INTO audit_log (user_id, action, entity_id, details, created_at) VALUES (?, 'sendVoiceMessage', ?, ?, ?)",
    ).bind(user.id, messageId, JSON.stringify({ staffId: staff.id, licensePlate, durationSeconds, sizeBytes: file.size, note }), now),
  ]);
  return Response.json({ ok: true, id: result.meta.last_row_id });
}
