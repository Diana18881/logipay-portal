import { env } from "cloudflare:workers";
import { ensureDomainDatabase } from "../../../lib/domain";
import { requirePortalUser } from "../../../lib/auth";

export async function POST(request: Request) {
  const user = await requirePortalUser(["management", "accountant"]);
  await ensureDomainDatabase();
  const form = await request.formData();
  const file = form.get("file");
  const staffId = Number(form.get("staffId"));
  const period = String(form.get("period") || "");
  if (!(file instanceof File) || !staffId || !/^\d{4}-\d{2}$/.test(period)) return Response.json({ error: "Ungültige Eingabe" }, { status: 400 });
  if (file.type !== "application/pdf" || file.size > 10 * 1024 * 1024) return Response.json({ error: "Nur PDF bis 10 MB" }, { status: 400 });
  const key = `lohnabrechnungen/${staffId}/${period}/${crypto.randomUUID()}.pdf`;
  await env.DOCUMENTS.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: "application/pdf" }, customMetadata: { originalName: file.name } });
  await env.DB.prepare("INSERT INTO salary_documents (staff_id, period, file_name, object_key, content_type, size_bytes, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(staffId, period, file.name, key, file.type, file.size, user.id, new Date().toISOString()).run();
  return Response.json({ ok: true });
}
