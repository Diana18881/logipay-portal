import { env } from "cloudflare:workers";
import { requirePortalUser } from "../../../../../lib/auth";
import { ensureDomainDatabase } from "../../../../../lib/domain";
import { requireTripAccess } from "../../../../../lib/trip-chat";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requirePortalUser(["management", "dispatcher", "driver"]);
  await ensureDomainDatabase();
  const { id } = await context.params;
  const row = await env.DB.prepare(
    "SELECT id, trip_operation_id, file_name, object_key, content_type FROM trip_messages WHERE id=?",
  ).bind(id).first<Record<string, string | number | null>>();
  if (!row?.object_key) return new Response("Not found", { status: 404 });
  const access = await requireTripAccess(user, Number(row.trip_operation_id));
  if ("error" in access) return new Response(access.error, { status: access.status });
  const object = await env.DOCUMENTS.get(String(row.object_key));
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, {
    headers: {
      "Content-Type": String(row.content_type || "application/octet-stream"),
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(String(row.file_name || "anlage"))}`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
