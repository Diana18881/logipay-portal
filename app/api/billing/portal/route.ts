import { getPortalUser } from "../../../../lib/auth";
import { createPortalSession } from "../../../../lib/billing";
import { getCompany } from "../../../../lib/tenants";

export async function POST(request: Request) {
  const user = await getPortalUser();
  if (!user || user.role !== "management") return Response.json({ error: "Nur die Geschäftsleitung kann das Abonnement verwalten" }, { status: 403 });
  const company = await getCompany(user.companyId, true);
  if (!company) return Response.json({ error: "Firma nicht gefunden" }, { status: 404 });
  try {
    return Response.json({ url: await createPortalSession(company, new URL(request.url).origin) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Kundenportal konnte nicht geöffnet werden" }, { status: 502 });
  }
}
