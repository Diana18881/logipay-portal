import { env } from "cloudflare:workers";
import { requirePortalUser } from "../../../../lib/auth";
import { ensureDomainDatabase } from "../../../../lib/domain";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requirePortalUser(["management", "accountant", "driver"]);
  await ensureDomainDatabase();
  const { id } = await context.params;
  const row = await env.DB.prepare("SELECT d.*, s.user_id, s.full_name FROM employee_documents d JOIN staff s ON s.id=d.staff_id WHERE d.id=?").bind(Number(id)).first<Record<string, string | number | null>>();
  if (!row || (user.role === "driver" && row.user_id !== user.id && row.full_name !== user.fullName)) return new Response("Nicht gefunden", { status: 404 });
  const object = await env.DOCUMENTS.get(String(row.object_key));
  if (!object) return new Response("Nicht gefunden", { status: 404 });
  await env.DB.prepare("INSERT INTO audit_log (user_id, action, entity_id, details, created_at) VALUES (?, 'viewEmployeeDocument', ?, ?, ?)").bind(user.id, id, JSON.stringify({ staffId: row.staff_id, category: row.category }), new Date().toISOString()).run();
  return new Response(object.body, { headers: { "Content-Type": String(row.content_type), "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(String(row.file_name))}`, "Cache-Control": "private, no-store" } });
}
