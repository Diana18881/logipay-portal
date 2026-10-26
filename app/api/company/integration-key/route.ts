import { env } from "@logipay/env";
import { requirePortalUser } from "../../../../lib/auth";
import { ensureDomainDatabase } from "../../../../lib/domain";
import { rotateIntegrationKey } from "../../../../lib/integration-keys";

export async function POST() {
  const user = await requirePortalUser(["management"]);
  await ensureDomainDatabase();
  const key = await rotateIntegrationKey(user.companyId);
  await env.DB.prepare("INSERT INTO audit_log (user_id, action, entity_id, details, created_at) VALUES (?, 'rotateIntegrationKey', NULL, '{}', ?)").bind(user.id, new Date().toISOString()).run();
  return Response.json({ key }, { headers: { "Cache-Control": "no-store" } });
}
