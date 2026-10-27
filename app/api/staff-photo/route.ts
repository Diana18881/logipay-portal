import { env } from "@logipay/env";
import { requirePortalUser } from "../../../lib/auth";
import { ensureDomainDatabase } from "../../../lib/domain";

// Profile photo of a driver: office roles for anyone, drivers only for themselves. Sent already resized by the browser.
export async function POST(request: Request) {
  const user = await requirePortalUser(["management", "dispatcher", "driver"]);
  await ensureDomainDatabase();
  const form = await request.formData();
  const staffId = Number(form.get("staffId") || 0);
  const file = form.get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/")) return Response.json({ error: "Bitte ein Foto wählen" }, { status: 400 });
  if (file.size > 3 * 1024 * 1024) return Response.json({ error: "Foto ist zu groß" }, { status: 400 });
  const staff = await env.DB.prepare("SELECT id, user_id, photo_key FROM staff WHERE id=?").bind(staffId).first<{ id: number; user_id: number | null; photo_key: string | null }>();
  if (!staff) return Response.json({ error: "Mitarbeiter nicht gefunden" }, { status: 404 });
  if (user.role === "driver" && staff.user_id !== user.id) return Response.json({ error: "Nur das eigene Foto" }, { status: 403 });
  const key = `fotos/${staff.id}/${crypto.randomUUID()}.jpg`;
  await env.DOCUMENTS.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
  if (staff.photo_key) await env.DOCUMENTS.delete(staff.photo_key).catch(() => undefined);
  await env.DB.batch([
    env.DB.prepare("UPDATE staff SET photo_key=?, updated_at=? WHERE id=?").bind(key, new Date().toISOString(), staff.id),
    env.DB.prepare("INSERT INTO audit_log (user_id, action, entity_id, details, created_at) VALUES (?, 'uploadStaffPhoto', ?, '{}', ?)").bind(user.id, String(staff.id), new Date().toISOString()),
  ]);
  return Response.json({ ok: true, photoKey: key });
}
