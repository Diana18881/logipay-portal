import { env, runAsTenant, tenantFromSessionToken } from "@logipay/env";
import { createSession, ensureAuthDatabase, hashPassword, sessionCookie } from "../../../../lib/auth";
import { findInvitation, invitationUsable } from "../../../../lib/invitations";
import { getCompany } from "../../../../lib/tenants";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { token?: string; password?: string };
  const token = String(body.token || "");
  const password = String(body.password || "");
  const tenant = tenantFromSessionToken(token);
  if (!tenant || !(await getCompany(tenant))) return Response.json({ error: "Einladung ungültig" }, { status: 404 });
  if (password.length < 10 || !/[A-ZÄÖÜА-ЯІЇЄҐ]/.test(password) || !/[0-9]/.test(password))
    return Response.json({ error: "Passwort: mindestens 10 Zeichen, ein Großbuchstabe und eine Zahl" }, { status: 400 });
  return runAsTenant(tenant, async () => {
    await ensureAuthDatabase();
    const invite = await findInvitation(token);
    if (!invitationUsable(invite)) return Response.json({ error: "Diese Einladung ist abgelaufen oder wurde schon benutzt. Bitte neue Einladung anfordern." }, { status: 410 });
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET password_hash=?, must_change_password=0, active=1, failed_attempts=0, locked_until=NULL WHERE id=?").bind(await hashPassword(password), invite!.user_id),
      env.DB.prepare("UPDATE invitations SET used_at=? WHERE id=?").bind(now, invite!.id),
      env.DB.prepare("INSERT INTO audit_log (user_id, action, entity_id, details, created_at) VALUES (?, 'acceptInvitation', ?, '{}', ?)").bind(invite!.user_id, String(invite!.user_id), now),
    ]);
    const session = await createSession(invite!.user_id);
    return Response.json({ ok: true, email: invite!.email }, { headers: { "Set-Cookie": sessionCookie(session.token, session.expiresAt, new URL(request.url).protocol === "https:") } });
  });
}
