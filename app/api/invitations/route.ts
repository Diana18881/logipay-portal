import { env } from "@logipay/env";
import { hashPassword, requirePortalUser } from "../../../lib/auth";
import { ensureDomainDatabase } from "../../../lib/domain";
import { createInvitation } from "../../../lib/invitations";
import { emailTakenElsewhere, syncDirectory } from "../../../lib/tenants";

// Creates (or renews) an invitation link for a driver; creates the login if the driver has none yet.
export async function POST(request: Request) {
  const user = await requirePortalUser(["management", "dispatcher"]);
  await ensureDomainDatabase();
  const body = await request.json().catch(() => ({})) as { staffId?: number; email?: string };
  const staff = await env.DB.prepare("SELECT s.id, s.full_name, s.user_id, u.email FROM staff s LEFT JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.status='active'")
    .bind(Number(body.staffId || 0)).first<{ id: number; full_name: string; user_id: number | null; email: string | null }>();
  if (!staff) return Response.json({ error: "Fahrer nicht gefunden" }, { status: 404 });
  let userId = staff.user_id;
  if (!userId) {
    const email = String(body.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return Response.json({ error: "Bitte die E-Mail-Adresse des Fahrers eintragen" }, { status: 400 });
    if (await emailTakenElsewhere(email, user.companyId) || await env.DB.prepare("SELECT id FROM users WHERE email=?").bind(email).first())
      return Response.json({ error: "Diese E-Mail ist bereits registriert" }, { status: 409 });
    // Random password nobody knows; the driver sets the real one through the link.
    const placeholder = await hashPassword(crypto.randomUUID() + crypto.randomUUID());
    const created = await env.DB.prepare("INSERT INTO users (email, full_name, role, password_hash, must_change_password, active) VALUES (?, ?, 'driver', ?, 0, 1)")
      .bind(email, staff.full_name, placeholder).run();
    userId = Number(created.meta.last_row_id);
    await env.DB.prepare("UPDATE staff SET user_id=?, updated_at=? WHERE id=?").bind(userId, new Date().toISOString(), staff.id).run();
    await syncDirectory(user.companyId);
  }
  const token = await createInvitation(userId, user.id, user.companyId);
  await env.DB.prepare("INSERT INTO audit_log (user_id, action, entity_id, details, created_at) VALUES (?, 'inviteDriver', ?, '{}', ?)").bind(user.id, String(staff.id), new Date().toISOString()).run();
  // A dash instead of the dot keeps the link free of "file extensions".
  const link = `${new URL(request.url).origin}/einladung/${token.replace(".", "-")}`;
  return Response.json({ link, name: staff.full_name, company: user.companyName });
}
