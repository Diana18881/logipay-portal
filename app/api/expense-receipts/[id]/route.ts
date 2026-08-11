import { env } from "@logipay/env";
import { requirePortalUser } from "../../../../lib/auth";
import { ensureDomainDatabase } from "../../../../lib/domain";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requirePortalUser(["management", "accountant", "driver"]);
  await ensureDomainDatabase();
  const { id } = await context.params;
  const row = await env.DB.prepare("SELECT * FROM expenses WHERE id=?").bind(id).first<Record<string, string | number | null>>();
  if (!row?.receipt_object_key) return new Response("Not found", { status: 404 });
  if (user.role === "driver") {
    const own = await env.DB.prepare("SELECT id FROM staff WHERE user_id=?").bind(user.id).first<{ id: number }>();
    if (Number(row.staff_id) !== own?.id) return new Response("Forbidden", { status: 403 });
  }
  const object = await env.DOCUMENTS.get(String(row.receipt_object_key));
  return object ? new Response(object.body, { headers: { "Content-Type": String(row.receipt_content_type || "application/octet-stream"), "Cache-Control": "private, no-store", "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(String(row.receipt_file_name || "Beleg"))}` } }) : new Response("Not found", { status: 404 });
}
