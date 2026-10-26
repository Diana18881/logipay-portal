import { env, runAsTenant } from "@logipay/env";
import { ensureAuthDatabase } from "../../../../lib/auth";
import { companyForEmail } from "../../../../lib/tenants";

const message = "Anfrage registriert. Ein Manager erstellt ein neues temporäres Passwort.";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: string } | null;
  const email = String(body?.email || "").trim().toLowerCase();
  if (!email) return Response.json({ error: "E-Mail ist erforderlich" }, { status: 400 });
  const company = await companyForEmail(email);
  // Unknown addresses get the same answer, so the form does not reveal who is registered.
  if (!company) return Response.json({ message });
  await runAsTenant(company.id, async () => {
    await ensureAuthDatabase();
    const existing = await env.DB.prepare("SELECT id FROM password_reset_requests WHERE email=? AND status='open'").bind(email).first();
    if (!existing) await env.DB.prepare("INSERT INTO password_reset_requests (email, status, created_at) VALUES (?, 'open', ?)").bind(email, new Date().toISOString()).run();
  });
  return Response.json({ message });
}
