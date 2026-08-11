import { env } from "cloudflare:workers";
import { requirePortalUser } from "../../../../lib/auth";
import { ensureDomainDatabase } from "../../../../lib/domain";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requirePortalUser(["management", "dispatcher", "driver"]);
  await ensureDomainDatabase();
  const { id } = await context.params;
  const row = await env.DB.prepare("SELECT d.*, p.staff_id, p.driver_name, s.user_id FROM trip_documents d JOIN trip_operations o ON o.id=d.trip_operation_id JOIN weekly_planning p ON p.id=o.planning_id LEFT JOIN staff s ON s.id=p.staff_id WHERE d.id=?").bind(id).first<Record<string, string | number | null>>();
  if (!row) return new Response("Not found", { status: 404 });
  if (user.role === "driver" && Number(row.user_id) !== user.id && String(row.driver_name) !== user.fullName)
    return new Response("Forbidden", { status: 403 });
  const object = await env.DOCUMENTS.get(String(row.object_key));
  return object ? new Response(object.body, { headers: { "Content-Type": String(row.content_type), "Cache-Control": "private, no-store", "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(String(row.file_name))}` } }) : new Response("Not found", { status: 404 });
}
