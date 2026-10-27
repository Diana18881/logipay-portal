import { env } from "@logipay/env";

// Invitation links let drivers set their own password: "<tenant>.<secret>", single use, 14 days.

const INVITE_DAYS = 14;

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function ensureInvitationTable() {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS invitations (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, created_by INTEGER NOT NULL, created_at TEXT NOT NULL, used_at TEXT)").run();
}

export async function createInvitation(userId: number, createdBy: number, tenantId: string) {
  await ensureInvitationTable();
  const secret = Array.from(crypto.getRandomValues(new Uint8Array(24)), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const now = new Date();
  await env.DB.batch([
    env.DB.prepare("UPDATE invitations SET used_at=? WHERE user_id=? AND used_at IS NULL").bind(now.toISOString(), userId),
    env.DB.prepare("INSERT INTO invitations (user_id, token_hash, expires_at, created_by, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(userId, await sha256(secret), new Date(now.getTime() + INVITE_DAYS * 86_400_000).toISOString(), createdBy, now.toISOString()),
  ]);
  return `${tenantId}.${secret}`;
}

export async function findInvitation(token: string) {
  await ensureInvitationTable();
  const secret = token.split(".")[1] || "";
  return env.DB.prepare(
    `SELECT i.id, i.user_id, i.expires_at, i.used_at, u.email, u.full_name FROM invitations i JOIN users u ON u.id=i.user_id
     WHERE i.token_hash=? LIMIT 1`,
  ).bind(await sha256(secret)).first<{ id: number; user_id: number; expires_at: string; used_at: string | null; email: string; full_name: string }>();
}

export function invitationUsable(invite: { expires_at: string; used_at: string | null } | null) {
  return Boolean(invite && !invite.used_at && new Date(invite.expires_at).getTime() > Date.now());
}
