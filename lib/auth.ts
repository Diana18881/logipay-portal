import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "cloudflare:workers";

export type PortalRole = "management" | "accountant" | "dispatcher" | "driver";

export type PortalUser = {
  id: number;
  email: string;
  fullName: string;
  role: PortalRole;
  mustChangePassword: boolean;
};

const COOKIE_NAME = "logipay_session";
const SESSION_DAYS = 7;

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", data)));
}

export async function verifyPassword(password: string, encodedHash: string) {
  const [algorithm, iterationsText, saltText, expectedText] = encodedHash.split("$");
  if (algorithm !== "pbkdf2_sha256") return false;
  const iterations = Number(iterationsText);
  if (!Number.isSafeInteger(iterations) || iterations < 100_000) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derived = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: base64ToBytes(saltText), iterations },
    key,
    256,
  ));
  const expected = base64ToBytes(expectedText);
  if (derived.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < derived.length; index += 1) difference |= derived[index] ^ expected[index];
  return difference === 0;
}

export async function createSession(userId: number) {
  const random = crypto.getRandomValues(new Uint8Array(32));
  const token = bytesToBase64(random).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  const tokenHash = await sha256(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await env.DB.prepare(
    "INSERT INTO sessions (user_id, token_hash, expires_at, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?)",
  ).bind(userId, tokenHash, expiresAt.toISOString(), now.toISOString(), now.toISOString()).run();

  return { token, expiresAt };
}

export function sessionCookie(token: string, expiresAt: Date) {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Expires=${expiresAt.toUTCString()}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export async function getPortalUser(): Promise<PortalUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const tokenHash = await sha256(token);
  const row = await env.DB.prepare(
    `SELECT users.id, users.email, users.full_name, users.role, users.must_change_password
     FROM sessions
     INNER JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = ? AND sessions.expires_at > ? AND users.active = 1
     LIMIT 1`,
  ).bind(tokenHash, new Date().toISOString()).first<{
    id: number;
    email: string;
    full_name: string;
    role: PortalRole;
    must_change_password: number;
  }>();

  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    mustChangePassword: Boolean(row.must_change_password),
  };
}

export async function requirePortalUser(allowedRoles?: PortalRole[]) {
  const user = await getPortalUser();
  if (!user) redirect("/login");
  if (allowedRoles && !allowedRoles.includes(user.role)) redirect("/");
  return user;
}

export async function destroyCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return;
  await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
}
