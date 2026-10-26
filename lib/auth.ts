import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { currentTenantId, env, SESSION_COOKIE } from "@logipay/env";
import { companyAccess, DEMO_TENANT, getCompany } from "./tenants";

export type PortalRole = "management" | "accountant" | "dispatcher" | "driver";

export type PortalUser = {
  id: number;
  email: string;
  fullName: string;
  role: PortalRole;
  mustChangePassword: boolean;
  twoFactorEnabled: boolean;
  companyId: string;
  companyName: string;
};

const COOKIE_NAME = SESSION_COOKIE;
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

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32ToBytes(value: string) {
  const clean = value.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const character of clean) bits += BASE32_ALPHABET.indexOf(character).toString(2).padStart(5, "0");
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  return new Uint8Array(bytes);
}

export function generateTwoFactorSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  let bits = "";
  for (const byte of bytes) bits += byte.toString(2).padStart(8, "0");
  let secret = "";
  for (let index = 0; index < bits.length; index += 5) secret += BASE32_ALPHABET[Number.parseInt(bits.slice(index, index + 5).padEnd(5, "0"), 2)];
  return secret;
}

export async function verifyTwoFactorCode(secret: string, code: string) {
  const normalized = code.replace(/\D/g, "");
  if (normalized.length !== 6) return false;
  const counter = Math.floor(Date.now() / 30_000);
  for (let offset = -1; offset <= 1; offset += 1) {
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    view.setUint32(4, counter + offset, false);
    const key = await crypto.subtle.importKey("raw", base32ToBytes(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
    const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, buffer));
    const position = digest[digest.length - 1] & 15;
    const number = (((digest[position] & 127) << 24) | (digest[position + 1] << 16) | (digest[position + 2] << 8) | digest[position + 3]) % 1_000_000;
    if (number.toString().padStart(6, "0") === normalized) return true;
  }
  return false;
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

export async function hashPassword(password: string) {
  const iterations = 210_000;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const derived = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256));
  return `pbkdf2_sha256$${iterations}$${bytesToBase64(salt)}$${bytesToBase64(derived)}`;
}

export async function createSession(userId: number) {
  const tenant = currentTenantId();
  if (!tenant) throw new Error("Keine Firma ausgewählt");
  const random = crypto.getRandomValues(new Uint8Array(32));
  const token = tenant + "." + bytesToBase64(random).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  const tokenHash = await sha256(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await env.DB.prepare(
    "INSERT INTO sessions (user_id, token_hash, expires_at, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?)",
  ).bind(userId, tokenHash, expiresAt.toISOString(), now.toISOString(), now.toISOString()).run();

  return { token, expiresAt };
}

export function sessionCookie(token: string, expiresAt: Date, secure = true) {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; ${secure ? "Secure; " : ""}SameSite=Strict; Expires=${expiresAt.toUTCString()}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export async function ensureAuthDatabase() {
  await env.DB.batch([
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        must_change_password INTEGER DEFAULT 1 NOT NULL,
        active INTEGER DEFAULT 1 NOT NULL
      )`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        user_id INTEGER NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
    ),
  ]);

  const userColumns = await env.DB.prepare("PRAGMA table_info(users)").all<{ name: string }>();
  const names = new Set(userColumns.results.map((column) => column.name));
  if (!names.has("failed_attempts")) await env.DB.prepare("ALTER TABLE users ADD COLUMN failed_attempts INTEGER NOT NULL DEFAULT 0").run();
  if (!names.has("locked_until")) await env.DB.prepare("ALTER TABLE users ADD COLUMN locked_until TEXT").run();
  if (!names.has("two_factor_secret")) await env.DB.prepare("ALTER TABLE users ADD COLUMN two_factor_secret TEXT").run();
  if (!names.has("two_factor_enabled")) await env.DB.prepare("ALTER TABLE users ADD COLUMN two_factor_enabled INTEGER NOT NULL DEFAULT 0").run();
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS login_audit (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, email TEXT NOT NULL, success INTEGER NOT NULL, ip_address TEXT, user_agent TEXT, created_at TEXT NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS password_reset_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL, resolved_at TEXT)"),
  ]);

  // Demo accounts exist only in the demo company and only when a secret password is configured.
  const demoPassword = process.env.LOGIPAY_DEMO_PASSWORD;
  if (demoPassword && currentTenantId() === DEMO_TENANT) {
    const existing = await env.DB.prepare("SELECT COUNT(*) AS count FROM users WHERE email LIKE '%@logipay.demo'").first<{ count: number }>();
    if (Number(existing?.count ?? 0) < 4) {
      const demoHash = await hashPassword(demoPassword);
      const insert = "INSERT OR IGNORE INTO users (email, full_name, role, password_hash, must_change_password, active) VALUES (?, ?, ?, ?, 0, 1)";
      await env.DB.batch([
        env.DB.prepare(insert).bind("director@logipay.demo", "Anna Becker", "management", demoHash),
        env.DB.prepare(insert).bind("accounting@logipay.demo", "Jonas Wolf", "accountant", demoHash),
        env.DB.prepare(insert).bind("dispatcher@logipay.demo", "Sofia Lehmann", "dispatcher", demoHash),
        env.DB.prepare(insert).bind("driver@logipay.demo", "Marek Nowak", "driver", demoHash),
      ]);
    }
  }
}

export async function getPortalUser(): Promise<PortalUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const companyId = currentTenantId();
  const company = companyId ? await getCompany(companyId) : null;
  if (!token || !companyId || !company) return null;
  const tokenHash = await sha256(token);
  const row = await env.DB.prepare(
    `SELECT users.id, users.email, users.full_name, users.role, users.must_change_password, users.two_factor_enabled
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
    two_factor_enabled: number;
  }>().catch(() => null);

  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    mustChangePassword: Boolean(row.must_change_password),
    twoFactorEnabled: Boolean(row.two_factor_enabled),
    companyId,
    companyName: company.name,
  };
}

export async function requirePortalUser(allowedRoles?: PortalRole[]) {
  const user = await getPortalUser();
  if (!user) redirect("/login");
  const access = companyAccess(await getCompany(user.companyId));
  if (!access.allowed) redirect(user.role === "management" ? "/abo" : "/login?gesperrt=1");
  if (allowedRoles && !allowedRoles.includes(user.role)) redirect("/");
  return user;
}

export async function destroyCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token || !currentTenantId()) return;
  await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
}
