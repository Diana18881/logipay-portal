import { env } from "@logipay/env";
import { sendEmail } from "./email";

// Second login step: a one-time 6-digit code sent by e-mail, and "remember this device" tokens.

const CODE_MINUTES = 10;
const MAX_ATTEMPTS = 5;
export const DEVICE_COOKIE = "logipay_device";
const DEVICE_DAYS = 30;

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function ensureLoginCodeTables() {
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS login_codes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, code_hash TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, expires_at TEXT NOT NULL, created_at TEXT NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS trusted_devices (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL)"),
  ]);
}

export function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  return `${name.slice(0, 2)}${"•".repeat(Math.max(1, name.length - 2))}@${domain}`;
}

/** Sends a new code unless one was sent less than a minute ago. */
export async function sendLoginCode(user: { id: number; email: string; full_name: string }, companyName: string) {
  const recent = await env.DB.prepare("SELECT created_at FROM login_codes WHERE user_id=? ORDER BY id DESC LIMIT 1").bind(user.id).first<{ created_at: string }>();
  if (recent && Date.now() - new Date(recent.created_at).getTime() < 60_000) return { sent: false };
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
  const now = new Date();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM login_codes WHERE user_id=?").bind(user.id),
    env.DB.prepare("INSERT INTO login_codes (user_id, code_hash, attempts, expires_at, created_at) VALUES (?, ?, 0, ?, ?)")
      .bind(user.id, await sha256(`${user.id}:${code}`), new Date(now.getTime() + CODE_MINUTES * 60_000).toISOString(), now.toISOString()),
  ]);
  const first = user.full_name.split(" ")[0] || "";
  await sendEmail({
    to: user.email,
    subject: `${code} ist Ihr LOGIPAY-Anmeldecode`,
    text: `Hallo ${first},\n\nIhr Anmeldecode für ${companyName}: ${code}\n\nDer Code ist ${CODE_MINUTES} Minuten gültig. Wenn Sie sich nicht anmelden wollten, ändern Sie bitte Ihr Passwort.\n\nLOGIPAY`,
    html: `<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:460px;margin:0 auto;padding:28px;color:#0b1a29">
      <div style="font-size:18px;font-weight:800;letter-spacing:3px;margin-bottom:24px">LOGIPAY</div>
      <p style="margin:0 0 6px">Hallo ${first.replace(/[<>&"]/g, "")},</p>
      <p style="margin:0 0 20px;color:#4f6472">Ihr Anmeldecode für ${companyName.replace(/[<>&"]/g, "")}:</p>
      <div style="font-size:36px;font-weight:800;letter-spacing:10px;padding:18px 0;text-align:center;background:#effaf8;border-radius:14px;color:#0e8577">${code}</div>
      <p style="margin:20px 0 0;color:#6c808b;font-size:13px">Der Code ist ${CODE_MINUTES} Minuten gültig. Wenn Sie sich nicht anmelden wollten, ändern Sie bitte Ihr Passwort.</p>
    </div>`,
  });
  return { sent: true };
}

export async function verifyLoginCode(userId: number, code: string) {
  const row = await env.DB.prepare("SELECT id, code_hash, attempts, expires_at FROM login_codes WHERE user_id=? ORDER BY id DESC LIMIT 1").bind(userId).first<{ id: number; code_hash: string; attempts: number; expires_at: string }>();
  if (!row) return { ok: false, reason: "missing" as const };
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, reason: "expired" as const };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "locked" as const };
  if (row.code_hash !== await sha256(`${userId}:${code.replace(/\D/g, "")}`)) {
    await env.DB.prepare("UPDATE login_codes SET attempts=attempts+1 WHERE id=?").bind(row.id).run();
    return { ok: false, reason: "wrong" as const, left: MAX_ATTEMPTS - row.attempts - 1 };
  }
  await env.DB.prepare("DELETE FROM login_codes WHERE user_id=?").bind(userId).run();
  return { ok: true as const };
}

export async function rememberDevice(userId: number, tenantId: string) {
  const token = Array.from(crypto.getRandomValues(new Uint8Array(24)), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const now = new Date();
  const expires = new Date(now.getTime() + DEVICE_DAYS * 86_400_000);
  await env.DB.prepare("INSERT INTO trusted_devices (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .bind(userId, await sha256(token), expires.toISOString(), now.toISOString()).run();
  return { value: `${tenantId}.${token}`, expires };
}

export async function isTrustedDevice(userId: number, cookieValue: string | null) {
  const token = cookieValue?.split(".")[1];
  if (!token) return false;
  const row = await env.DB.prepare("SELECT id FROM trusted_devices WHERE user_id=? AND token_hash=? AND expires_at > ?")
    .bind(userId, await sha256(token), new Date().toISOString()).first();
  return Boolean(row);
}

export function deviceCookie(value: string, expires: Date, secure: boolean) {
  return `${DEVICE_COOKIE}=${value}; Path=/; HttpOnly; ${secure ? "Secure; " : ""}SameSite=Lax; Expires=${expires.toUTCString()}`;
}
