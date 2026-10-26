import { runAsTenant } from "@logipay/env";
import { createSession, hashPassword, sessionCookie } from "../../../../lib/auth";
import { CompanyError, createCompany, recordSignupAttempt } from "../../../../lib/tenants";

type RegisterPayload = { companyName?: string; fullName?: string; email?: string; password?: string; acceptTerms?: boolean; website?: string };

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as RegisterPayload | null;
  const companyName = String(body?.companyName || "").trim();
  const fullName = String(body?.fullName || "").trim();
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");
  // Hidden field: bots fill it, people do not.
  if (body?.website) return Response.json({ error: "Registrierung fehlgeschlagen" }, { status: 400 });
  if (companyName.length < 2 || companyName.length > 120 || fullName.length < 2 || fullName.length > 120)
    return Response.json({ error: "Bitte Firmennamen und Ihren Namen eintragen" }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.endsWith("@logipay.demo"))
    return Response.json({ error: "Bitte eine gültige E-Mail-Adresse eintragen" }, { status: 400 });
  if (password.length < 10 || !/[A-ZÄÖÜА-Я]/.test(password) || !/[0-9]/.test(password))
    return Response.json({ error: "Passwort: mindestens 10 Zeichen, ein Großbuchstabe und eine Zahl" }, { status: 400 });
  if (!body?.acceptTerms)
    return Response.json({ error: "Bitte AGB, AVV und Datenschutzhinweise akzeptieren" }, { status: 400 });
  const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!(await recordSignupAttempt(ipAddress)))
    return Response.json({ error: "Zu viele Registrierungen. Bitte in einer Stunde erneut versuchen." }, { status: 429 });
  try {
    const company = await createCompany({ name: companyName, ownerName: fullName, email, passwordHash: await hashPassword(password) });
    const session = await runAsTenant(company.id, () => createSession(company.userId));
    const secure = new URL(request.url).protocol === "https:";
    return Response.json({ ok: true }, { status: 201, headers: { "Set-Cookie": sessionCookie(session.token, session.expiresAt, secure) } });
  } catch (error) {
    if (error instanceof CompanyError) return Response.json({ error: error.message }, { status: error.status });
    console.error("Registration failed", error);
    return Response.json({ error: "Registrierung gerade nicht möglich. Bitte später erneut versuchen." }, { status: 500 });
  }
}
