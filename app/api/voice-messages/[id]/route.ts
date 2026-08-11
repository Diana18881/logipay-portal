import { env } from "@logipay/env";
import { requirePortalUser } from "../../../../lib/auth";
import { ensureDomainDatabase } from "../../../../lib/domain";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requirePortalUser(["management", "dispatcher", "driver"]);
  await ensureDomainDatabase();
  const { id } = await context.params;
  const row = await env.DB.prepare(
    "SELECT vm.*, s.user_id AS staff_user_id FROM voice_messages vm JOIN staff s ON s.id=vm.staff_id WHERE vm.id=?",
  ).bind(id).first<Record<string, string | number | null>>();
  if (!row) return new Response("Not found", { status: 404 });
  if (user.role === "driver" && Number(row.staff_user_id) !== user.id)
    return new Response("Forbidden", { status: 403 });
  const object = await env.DOCUMENTS.get(String(row.object_key));
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, {
    headers: {
      "Content-Type": String(row.content_type || "audio/webm"),
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(String(row.file_name || "sprachnachricht"))}`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
