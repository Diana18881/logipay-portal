import { env } from "cloudflare:workers";
import { hashPassword, requirePortalUser, verifyPassword } from "../../../../lib/auth";

export async function POST(request: Request) {
  const user = await requirePortalUser();
  const body = await request.json().catch(() => null) as { currentPassword?: string; newPassword?: string } | null;
  const currentPassword = String(body?.currentPassword || "");
  const newPassword = String(body?.newPassword || "");
  if (newPassword.length < 10 || !/[A-ZА-Я]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return Response.json({ error: "Новый пароль: минимум 10 символов, заглавная буква и цифра" }, { status: 400 });
  }
  const row = await env.DB.prepare("SELECT password_hash FROM users WHERE id=?").bind(user.id).first<{ password_hash: string }>();
  if (!row || !(await verifyPassword(currentPassword, row.password_hash))) return Response.json({ error: "Текущий пароль неверен" }, { status: 401 });
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET password_hash=?, must_change_password=0 WHERE id=?").bind(await hashPassword(newPassword), user.id),
    env.DB.prepare("INSERT INTO audit_log (user_id, action, entity_id, details, created_at) VALUES (?, 'changePassword', ?, ?, ?)").bind(user.id, String(user.id), JSON.stringify({ source: "self-service" }), new Date().toISOString()),
  ]);
  return Response.json({ ok: true });
}
