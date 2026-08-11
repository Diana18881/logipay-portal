import { env } from "@logipay/env";
import { requirePortalUser } from "../../../lib/auth";
import { ensureDomainDatabase } from "../../../lib/domain";
import { buildTranslations, detectLanguage, normalizeLocale, requireTripAccess } from "../../../lib/trip-chat";

export async function POST(request: Request) {
  const user = await requirePortalUser(["management", "dispatcher", "driver"]);
  await ensureDomainDatabase();
  const form = await request.formData();
  const tripOperationId = Number(form.get("tripOperationId") || 0);
  if (!tripOperationId) return Response.json({ error: "Tour fehlt" }, { status: 400 });
  const access = await requireTripAccess(user, tripOperationId);
  if ("error" in access) return Response.json({ error: access.error }, { status: access.status });

  const body = String(form.get("body") || "").trim().slice(0, 2000);
  const preferredLanguage = normalizeLocale(form.get("locale"));
  const originalLanguage = body ? detectLanguage(body, preferredLanguage) : preferredLanguage;
  const translations = body ? buildTranslations(body, originalLanguage) : {};
  const attachment = form.get("file");
  const file = attachment instanceof File && attachment.size ? attachment : null;
  if (!body && !file) return Response.json({ error: "Nachricht oder Datei fehlt" }, { status: 400 });

  let messageType = "text";
  let objectKey: string | null = null;
  let fileName: string | null = null;
  let contentType: string | null = null;
  let sizeBytes: number | null = null;
  if (file) {
    if (!file.type.startsWith("audio/") && !file.type.startsWith("image/"))
      return Response.json({ error: "Nur Foto oder Sprachnachricht erlaubt" }, { status: 400 });
    const limit = file.type.startsWith("audio/") ? 15 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > limit) return Response.json({ error: "Datei ist zu groß" }, { status: 400 });
    messageType = file.type.startsWith("audio/") ? "voice" : "photo";
    const now = new Date().toISOString();
    objectKey = `tour-chat/${tripOperationId}/${now.slice(0, 10)}/${crypto.randomUUID()}`;
    fileName = file.name || (messageType === "voice" ? "sprachnachricht" : "foto");
    contentType = file.type;
    sizeBytes = file.size;
    await env.DOCUMENTS.put(objectKey, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { originalName: fileName },
    });
  }

  const now = new Date().toISOString();
  const durationSeconds = messageType === "voice"
    ? Math.min(300, Math.max(0, Number(form.get("durationSeconds") || 0)))
    : 0;
  const result = await env.DB.prepare(
    `INSERT INTO trip_messages (trip_operation_id, sender_user_id, sender_role, message_type, body, original_language, translations_json, file_name, object_key, content_type, size_bytes, duration_seconds, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(tripOperationId, user.id, user.role, messageType, body || null, originalLanguage, JSON.stringify(translations), fileName, objectKey, contentType, sizeBytes, durationSeconds, now).run();
  const messageId = Number(result.meta.last_row_id);
  await env.DB.prepare(
    "INSERT OR IGNORE INTO trip_message_reads (message_id, user_id, read_at) VALUES (?, ?, ?)",
  ).bind(messageId, user.id, now).run();

  const preview = body || (messageType === "voice" ? "Sprachnachricht" : "Foto");
  const tripLabel = `${access.trip.license_plate || "ohne Kennzeichen"}${access.trip.block_id ? ` · ${access.trip.block_id}` : ""}`;
  if (user.role === "driver") {
    await env.DB.prepare(
      "INSERT INTO notifications (role_scope, category, title, message, entity_type, entity_id, severity, created_at) VALUES ('dispatcher', 'trip_chat', 'Neue Nachricht in einer Tour', ?, 'trip_operation', ?, 'info', ?)",
    ).bind(`${access.trip.driver_name || user.fullName} · ${tripLabel}: ${preview.slice(0, 160)}`, String(tripOperationId), now).run();
  } else if (access.trip.staff_user_id) {
    await env.DB.prepare(
      "INSERT INTO notifications (user_id, category, title, message, entity_type, entity_id, severity, created_at) VALUES (?, 'trip_chat', 'Neue Nachricht zur Tour', ?, 'trip_operation', ?, 'info', ?)",
    ).bind(access.trip.staff_user_id, `${tripLabel}: ${preview.slice(0, 160)}`, String(tripOperationId), now).run();
  }
  await env.DB.prepare(
    "INSERT INTO audit_log (user_id, action, entity_id, details, created_at) VALUES (?, 'sendTripMessage', ?, ?, ?)",
  ).bind(user.id, String(messageId), JSON.stringify({ tripOperationId, messageType, originalLanguage, sizeBytes, licensePlate: access.trip.license_plate, blockId: access.trip.block_id }), now).run();
  return Response.json({ ok: true, id: messageId });
}
