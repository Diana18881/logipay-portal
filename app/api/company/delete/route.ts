import { clearSessionCookie, getPortalUser } from "../../../../lib/auth";
import { cancelSubscription } from "../../../../lib/billing";
import { CompanyError, deleteCompany, getCompany } from "../../../../lib/tenants";

// Deletes the company with all data and files for good (DSGVO Art. 17).
export async function POST(request: Request) {
  const user = await getPortalUser();
  if (!user || user.role !== "management") return Response.json({ error: "Nur die Geschäftsleitung kann die Firma löschen" }, { status: 403 });
  const body = await request.json().catch(() => null) as { confirmName?: string } | null;
  const company = await getCompany(user.companyId, true);
  if (!company) return Response.json({ error: "Firma nicht gefunden" }, { status: 404 });
  if (String(body?.confirmName || "").trim() !== company.name)
    return Response.json({ error: "Bitte den Firmennamen genau so eintippen, wie er angezeigt wird" }, { status: 400 });
  try {
    if (company.stripe_subscription_id) await cancelSubscription(company.stripe_subscription_id);
    await deleteCompany(company.id);
  } catch (error) {
    if (error instanceof CompanyError) return Response.json({ error: error.message }, { status: error.status });
    console.error("Company deletion failed", error);
    return Response.json({ error: "Löschen fehlgeschlagen. Bitte erneut versuchen oder den Support kontaktieren." }, { status: 500 });
  }
  return Response.json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie() } });
}
