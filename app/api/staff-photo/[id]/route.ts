import { env } from "@logipay/env";
import { requirePortalUser } from "../../../../lib/auth";
import { ensureDomainDatabase } from "../../../../lib/domain";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  await requirePortalUser();
  await ensureDomainDatabase();
  const { id } = await context.params;
  const row = await env.DB.prepare("SELECT photo_key FROM staff WHERE id=?").bind(Number(id)).first<{ photo_key: string | null }>();
  const object = row?.photo_key ? await env.DOCUMENTS.get(row.photo_key) : null;
  if (!object) return new Response("Nicht gefunden", { status: 404 });
  return new Response(object.body, { headers: { "Content-Type": object.httpMetadata?.contentType || "image/jpeg", "Cache-Control": "private, max-age=86400" } });
}
