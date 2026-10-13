import { env } from "@logipay/env";
import { requirePortalUser } from "../../../lib/auth";
import { requireChatRecipient } from "../../../lib/direct-chat";
import { ensureDomainDatabase } from "../../../lib/domain";
import { pushNewNotifications } from "../../../lib/push";
import { detectLanguage, normalizeLocale } from "../../../lib/trip-chat";

export async function POST(request: Request) {
  const user = await requirePortalUser(["management", "dispatcher", "driver"]);
  await ensureDomainDatabase();
  const form = await request.formData();
  const access = await requireChatRecipient(user, Number(form.get("recipientUserId") || 0), Number(form.get("recipientStaffId") || 0));
  if ("error" in access) return Response.json({ error: access.error }, { status: access.status });
  const { recipient } = access;

  const body = String(form.get("body") || "").trim().slice(0, 2000);
  const preferredLanguage = normalizeLocale(form.get("locale"));
  const originalLanguage = body ? detectLanguage(body, preferredLanguage) : preferredLanguage;
  const attachment = form.get("file");
  const file = attachment instanceof File && attachment.size ? attachment : null;
  if (!body && !file) return Response.json({ error: "Nachricht oder Datei fehlt" }, { status: 400 });

  const now = new Date().toISOString();
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
    objectKey = `direct-chat/${now.slice(0, 10)}/${crypto.randomUUID()}`;
    fileName = file.name || (messageType === "voice" ? "sprachnachricht" : "foto");
    contentType = file.type;
    sizeBytes = file.size;
    await env.DOCUMENTS.put(objectKey, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { originalName: fileName },
    });
  }

  const durationSeconds = messageType === "voice"
    ? Math.min(300, Math.max(0, Number(form.get("durationSeconds") || 0)))
    : 0;
  const result = await env.DB.prepare(
    `INSERT INTO direct_messages (sender_user_id, recipient_user_id, recipient_staff_id, message_type, body, original_language, file_name, object_key, content_type, size_bytes, duration_seconds, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(user.id, recipient.userId, recipient.staffId, messageType, body || null, originalLanguage, fileName, objectKey, contentType, sizeBytes, durationSeconds, now).run();
  const messageId = Number(result.meta.last_row_id);

  const preview = body || (messageType === "voice" ? "Sprachnachricht" : "Foto");
  if (recipient.userId) await env.DB.prepare(
    "INSERT INTO notifications (user_id, category, title, message, entity_type, entity_id, severity, created_at) VALUES (?, 'direct_chat', 'Neue Nachricht', ?, 'user', ?, 'info', ?)",
  ).bind(recipient.userId, `${user.fullName}: ${preview.slice(0, 160)}`, String(user.id), now).run();
  await env.DB.prepare(
    "INSERT INTO audit_log (user_id, action, entity_id, details, created_at) VALUES (?, 'sendDirectMessage', ?, ?, ?)",
  ).bind(user.id, String(messageId), JSON.stringify({ recipientUserId: recipient.userId, recipientStaffId: recipient.staffId, messageType, originalLanguage, sizeBytes }), now).run();
  await pushNewNotifications(now);
  return Response.json({ ok: true, id: messageId });
}
