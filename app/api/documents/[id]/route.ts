import { env } from "@logipay/env";
import { ensureDomainDatabase } from "../../../../lib/domain";
import { requirePortalUser } from "../../../../lib/auth";
import { logFileAccess } from "../../../../lib/audit";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requirePortalUser(["management", "accountant", "driver"]);
  await ensureDomainDatabase();
  const { id } = await context.params;
  const row = await env.DB.prepare("SELECT d.*, s.user_id, s.full_name FROM salary_documents d JOIN staff s ON s.id=d.staff_id WHERE d.id=?").bind(Number(id)).first<Record<string, string | number>>();
  if (!row || (user.role === "driver" && row.user_id !== user.id && row.full_name !== user.fullName)) return new Response("Nicht gefunden", { status: 404 });
  const object = await env.DOCUMENTS.get(String(row.object_key));
  if (object) await logFileAccess(user.id, "salaryDocument", String(id));
  if (!object) return new Response("Nicht gefunden", { status: 404 });
  return new Response(object.body, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${encodeURIComponent(String(row.file_name))}"`, "Cache-Control": "private, no-store" } });
}
