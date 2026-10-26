import { env } from "@logipay/env";
import { requirePortalUser } from "../../../../../lib/auth";
import { getDirectMessageForUser } from "../../../../../lib/direct-chat";
import { ensureDomainDatabase } from "../../../../../lib/domain";
import { logFileAccess } from "../../../../../lib/audit";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requirePortalUser(["management", "dispatcher", "driver"]);
  await ensureDomainDatabase();
  const { id } = await context.params;
  const row = await getDirectMessageForUser(user, Number(id));
  if (!row?.object_key) return new Response("Not found", { status: 404 });
  const object = await env.DOCUMENTS.get(String(row.object_key));
  if (object) await logFileAccess(user.id, "directChatAttachment", String(id));
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
