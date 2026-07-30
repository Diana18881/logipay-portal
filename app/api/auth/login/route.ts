import { env } from "cloudflare:workers";
import { createSession, ensureAuthDatabase, sessionCookie, verifyPassword, type PortalRole } from "../../../../lib/auth";

export async function POST(request: Request) {
  try {
    await ensureAuthDatabase();
    const payload = await request.json().catch(() => null) as { email?: string; password?: string } | null;
    const email = payload?.email?.trim().toLowerCase() ?? "";
    const password = payload?.password ?? "";
    if (!email || !password) {
      return Response.json({ error: "Введите email и пароль" }, { status: 400 });
    }

    const user = await env.DB.prepare(
      "SELECT id, email, full_name, role, password_hash, active FROM users WHERE email = ? LIMIT 1",
    ).bind(email).first<{
      id: number;
      email: string;
      full_name: string;
      role: PortalRole;
      password_hash: string;
      active: number;
    }>();

    const valid = user?.active === 1 && await verifyPassword(password, user.password_hash);
    if (!valid || !user) {
      return Response.json({ error: "Неверный email или пароль" }, { status: 401 });
    }

    const session = await createSession(user.id);
    const isSecure = new URL(request.url).protocol === "https:";
    return Response.json(
      { user: { email: user.email, fullName: user.full_name, role: user.role } },
      { headers: { "Set-Cookie": sessionCookie(session.token, session.expiresAt, isSecure) } },
    );
  } catch (error) {
    console.error("Login failed", error);
    return Response.json(
      { error: "База данных входа ещё не готова. Перезапустите сервер и попробуйте снова." },
      { status: 500 },
    );
  }
}
