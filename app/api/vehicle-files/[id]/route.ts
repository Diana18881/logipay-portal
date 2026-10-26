import { env } from "@logipay/env";
import { requirePortalUser } from "../../../../lib/auth";
import { ensureDomainDatabase } from "../../../../lib/domain";
import { logFileAccess } from "../../../../lib/audit";
export async function GET(_: Request, c: { params: Promise<{ id: string }> }) {
  const u = await requirePortalUser(["management", "dispatcher", "driver"]);
  await ensureDomainDatabase();
  const { id } = await c.params;
  const row = await env.DB.prepare("SELECT * FROM vehicle_files WHERE id=?")
    .bind(id)
    .first<Record<string, string | number>>();
  if (!row) return new Response("Not found", { status: 404 });
  if (u.role === "driver") {
    const s = await env.DB.prepare("SELECT id FROM staff WHERE user_id=?")
      .bind(u.id)
      .first<{ id: number }>();
    if (row.staff_id !== s?.id)
      return new Response("Forbidden", { status: 403 });
  }
  const o = await env.DOCUMENTS.get(String(row.object_key));
  if (o) await logFileAccess(u.id, "vehicleFile", String(id));
  return o
    ? new Response(o.body, {
        headers: {
          "Content-Type": String(row.content_type),
          "Cache-Control": "private, no-store",
          "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(String(row.file_name))}`,
        },
      })
    : new Response("Not found", { status: 404 });
}
