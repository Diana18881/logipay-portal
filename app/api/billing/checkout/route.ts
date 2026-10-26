import { getPortalUser } from "../../../../lib/auth";
import { createCheckout } from "../../../../lib/billing";
import { getCompany } from "../../../../lib/tenants";

export async function POST(request: Request) {
  const user = await getPortalUser();
  if (!user || user.role !== "management") return Response.json({ error: "Nur die Geschäftsleitung kann das Abonnement verwalten" }, { status: 403 });
  const company = await getCompany(user.companyId, true);
  if (!company || company.is_demo) return Response.json({ error: "Für die Demo-Firma gibt es kein Abonnement" }, { status: 400 });
  try {
    return Response.json({ url: await createCheckout(company, user.email, new URL(request.url).origin) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Bezahlseite konnte nicht geöffnet werden" }, { status: 502 });
  }
}
