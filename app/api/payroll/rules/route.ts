import { requirePortalUser } from "../../../../lib/auth";
import { ensureDomainDatabase } from "../../../../lib/domain";
import { defaultRules, loadRules } from "../../../../lib/payroll";

export async function GET() {
  await requirePortalUser(["management", "accountant"]);
  await ensureDomainDatabase();
  return Response.json({ rules: await loadRules(), defaults: defaultRules });
}
