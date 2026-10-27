import { currentTenantId, env, runAsTenant } from "@logipay/env";
import { companyAccess, companyForEmail, DEMO_TENANT } from "../../../../lib/tenants";
import { createSession, ensureAuthDatabase, sessionCookie, verifyPassword, type PortalRole } from "../../../../lib/auth";
import { DEVICE_COOKIE, deviceCookie, ensureLoginCodeTables, isTrustedDevice, maskEmail, rememberDevice, sendLoginCode, verifyLoginCode } from "../../../../lib/login-codes";

type LoginPayload = { email?: string; password?: string; code?: string; rememberDevice?: boolean; resend?: boolean };

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => null) as LoginPayload | null;
    const email = payload?.email?.trim().toLowerCase() ?? "";
    const password = payload?.password?.trim() ?? "";
    if (!email || !password) {
      return Response.json({ error: "Bitte E-Mail und Passwort eingeben" }, { status: 400 });
    }
    const company = await companyForEmail(email);
    if (!company) {
      // Same answer as a wrong password, so nobody can probe which e-mails are registered.
      await verifyPassword(password, "pbkdf2_sha256$210000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");
      return Response.json({ error: "E-Mail oder Passwort ist falsch" }, { status: 401 });
    }
    const allowed = companyAccess(company).allowed;
    return await runAsTenant(company.id, () => login(request, payload!, email, password, allowed, company.name));
  } catch (error) {
    console.error("Login failed", error);
    return Response.json(
      { error: "Anmeldung gerade nicht möglich. Bitte in einer Minute erneut versuchen." },
      { status: 500 },
    );
  }
}

async function login(request: Request, payload: LoginPayload, email: string, password: string, companyAllowed: boolean, companyName: string) {
  await ensureAuthDatabase();
  await ensureLoginCodeTables();

  const user = await env.DB.prepare(
    "SELECT id, email, full_name, role, password_hash, active, failed_attempts, locked_until, two_factor_enabled FROM users WHERE email = ? LIMIT 1",
  ).bind(email).first<{
    id: number;
    email: string;
    full_name: string;
    role: PortalRole;
    password_hash: string;
    active: number;
    failed_attempts: number;
    locked_until: string | null;
    two_factor_enabled: number;
  }>();

  const now = new Date();
  const ipAddress = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "";
  const userAgent = request.headers.get("user-agent") || "";
  const isDemoAccount = currentTenantId() === DEMO_TENANT;

  if (user?.locked_until && new Date(user.locked_until) > now) {
    return Response.json({ error: "Konto vorübergehend gesperrt. Bitte später erneut versuchen." }, { status: 423 });
  }
  const valid = user?.active === 1 && await verifyPassword(password, user.password_hash);
  if (!valid || !user) {
    if (user) {
      const attempts = Number(user.failed_attempts || 0) + 1;
      const lockedUntil = attempts >= 5 ? new Date(now.getTime() + 15 * 60_000).toISOString() : null;
      await env.DB.prepare("UPDATE users SET failed_attempts=?, locked_until=? WHERE id=?").bind(attempts >= 5 ? 0 : attempts, lockedUntil, user.id).run();
    }
    await env.DB.prepare("INSERT INTO login_audit (user_id, email, success, ip_address, user_agent, created_at) VALUES (?, ?, 0, ?, ?, ?)").bind(user?.id || null, email, ipAddress, userAgent, now.toISOString()).run();
    return Response.json({ error: "E-Mail oder Passwort ist falsch" }, { status: 401 });
  }

  // Without an active subscription only the management may sign in, to renew it.
  if (!companyAllowed && user.role !== "management") {
    return Response.json({ error: "Der Zugang Ihrer Firma ist pausiert. Bitte wenden Sie sich an Ihre Geschäftsleitung." }, { status: 402 });
  }

  // Second step for office roles: a one-time code by e-mail, unless this device was remembered.
  const isSecure = new URL(request.url).protocol === "https:";
  let rememberCookie = "";
  const deviceToken = request.headers.get("cookie")?.match(new RegExp(`${DEVICE_COOKIE}=([^;]+)`))?.[1] ?? null;
  if (!isDemoAccount && ["management", "accountant"].includes(user.role) && !(await isTrustedDevice(user.id, deviceToken))) {
    const masked = maskEmail(user.email);
    if (!payload.code || payload.resend) {
      try {
        const { sent } = await sendLoginCode(user, companyName);
        return Response.json({ requiresCode: true, email: masked, sent }, { status: 202 });
      } catch (error) {
        console.error("Login code e-mail failed", error);
        return Response.json({ error: "Der Anmeldecode konnte nicht per E-Mail gesendet werden. Bitte später erneut versuchen." }, { status: 503 });
      }
    }
    const result = await verifyLoginCode(user.id, payload.code);
    if (!result.ok) {
      await env.DB.prepare("INSERT INTO login_audit (user_id, email, success, ip_address, user_agent, created_at) VALUES (?, ?, 0, ?, ?, ?)").bind(user.id, email, ipAddress, userAgent, now.toISOString()).run();
      const error = result.reason === "wrong" ? `Falscher Code. Noch ${result.left} ${result.left === 1 ? "Versuch" : "Versuche"}.`
        : result.reason === "expired" ? "Der Code ist abgelaufen. Bitte einen neuen Code anfordern."
        : result.reason === "locked" ? "Zu viele falsche Versuche. Bitte einen neuen Code anfordern."
        : "Bitte zuerst einen Code anfordern.";
      return Response.json({ error, requiresCode: true, email: masked }, { status: 401 });
    }
    if (!user.two_factor_enabled) await env.DB.prepare("UPDATE users SET two_factor_enabled=1 WHERE id=?").bind(user.id).run();
    if (payload.rememberDevice) {
      const device = await rememberDevice(user.id, currentTenantId() || "");
      rememberCookie = deviceCookie(device.value, device.expires, isSecure);
    }
  }

  const session = await createSession(user.id);
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET failed_attempts=0, locked_until=NULL WHERE id=?").bind(user.id),
    env.DB.prepare("INSERT INTO login_audit (user_id, email, success, ip_address, user_agent, created_at) VALUES (?, ?, 1, ?, ?, ?)").bind(user.id, email, ipAddress, userAgent, now.toISOString()),
  ]);
  const headers = new Headers({ "Set-Cookie": sessionCookie(session.token, session.expiresAt, isSecure) });
  if (rememberCookie) headers.append("Set-Cookie", rememberCookie);
  return Response.json({ user: { email: user.email, fullName: user.full_name, role: user.role } }, { headers });
}
