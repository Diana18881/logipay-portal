import { env } from "cloudflare:workers";
import { requirePortalUser } from "../../../lib/auth";
import { ensureDomainDatabase } from "../../../lib/domain";

const categories = new Set(["Arbeitsvertrag", "Führerschein", "Fahrerkarte", "Aufenthaltstitel", "Krankmeldung", "Lohnabrechnung", "Sonstiges"]);

export async function POST(request: Request) {
  const user = await requirePortalUser(["management", "accountant", "driver"]);
  await ensureDomainDatabase();
  const form = await request.formData();
  const file = form.get("file");
  let staffId = Number(form.get("staffId"));
  const category = String(form.get("category") || "");
  const expiresAt = String(form.get("expiresAt") || "") || null;
  if (user.role === "driver") {
    const own = await env.DB.prepare("SELECT id FROM staff WHERE user_id=? OR full_name=? LIMIT 1").bind(user.id, user.fullName).first<{ id: number }>();
    staffId = own?.id || 0;
    if (!["Führerschein", "Fahrerkarte", "Aufenthaltstitel", "Krankmeldung"].includes(category)) return Response.json({ error: "Diese Dokumentart darf nur das Büro hochladen" }, { status: 403 });
  }
  if (!(file instanceof File) || !staffId || !categories.has(category)) return Response.json({ error: "Pflichtfelder fehlen" }, { status: 400 });
  if (file.type !== "application/pdf" && !file.type.startsWith("image/")) return Response.json({ error: "Nur PDF oder Bild" }, { status: 400 });
  if (file.size > 15 * 1024 * 1024) return Response.json({ error: "Maximal 15 MB" }, { status: 400 });
  const key = `personalakte/${staffId}/${category}/${crypto.randomUUID()}`;
  await env.DOCUMENTS.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type }, customMetadata: { originalName: file.name } });
  const result = await env.DB.prepare("INSERT INTO employee_documents (staff_id, category, file_name, object_key, content_type, size_bytes, expires_at, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(staffId, category, file.name, key, file.type, file.size, expiresAt, user.id, new Date().toISOString()).run();
  await env.DB.prepare("INSERT INTO audit_log (user_id, action, entity_id, details, created_at) VALUES (?, 'uploadEmployeeDocument', ?, ?, ?)").bind(user.id, String(result.meta.last_row_id), JSON.stringify({ staffId, category, fileName: file.name, expiresAt }), new Date().toISOString()).run();
  return Response.json({ ok: true });
}
