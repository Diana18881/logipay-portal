import { env, forgetTenantDatabase, isTenantId, runAsTenant, tenantDatabase, tenantDatabaseName } from "@logipay/env";

export const DEMO_TENANT = "demo";
export const TRIAL_DAYS = 30;

export type CompanyStatus = "trialing" | "active" | "past_due" | "canceled" | "deleted";

export type Company = {
  id: string;
  name: string;
  status: CompanyStatus;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  seats: number;
  is_demo: number;
  created_at: string;
};

let controlReady: Promise<void> | null = null;

export function ensureControlDatabase() {
  controlReady ??= (async () => {
    const db = env.CONTROL;
    await db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS companies (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'trialing', trial_ends_at TEXT,
        stripe_customer_id TEXT, stripe_subscription_id TEXT, seats INTEGER NOT NULL DEFAULT 0, is_demo INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT)`),
      db.prepare("CREATE TABLE IF NOT EXISTS directory (email TEXT PRIMARY KEY, company_id TEXT NOT NULL, created_at TEXT NOT NULL)"),
      db.prepare("CREATE INDEX IF NOT EXISTS idx_directory_company ON directory(company_id)"),
      db.prepare("CREATE TABLE IF NOT EXISTS signup_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, ip_address TEXT NOT NULL, created_at TEXT NOT NULL)"),
      db.prepare("CREATE TABLE IF NOT EXISTS billing_events (id TEXT PRIMARY KEY, type TEXT NOT NULL, company_id TEXT, created_at TEXT NOT NULL)"),
    ]);
    if (process.env.LOGIPAY_DEMO_PASSWORD) await ensureDemoCompany();
  })().catch((error) => {
    controlReady = null;
    throw error;
  });
  return controlReady;
}

async function ensureDemoCompany() {
  const now = new Date().toISOString();
  await env.CONTROL.prepare(
    "INSERT OR IGNORE INTO companies (id, name, status, trial_ends_at, is_demo, created_at, updated_at) VALUES (?, 'Muster Transporte (Demo)', 'active', NULL, 1, ?, ?)",
  ).bind(DEMO_TENANT, now, now).run();
  await env.CONTROL.batch(
    ["director", "accounting", "dispatcher", "driver"].map((name) =>
      env.CONTROL.prepare("INSERT OR IGNORE INTO directory (email, company_id, created_at) VALUES (?, ?, ?)").bind(`${name}@logipay.demo`, DEMO_TENANT, now),
    ),
  );
}

export async function companyForEmail(email: string) {
  await ensureControlDatabase();
  return env.CONTROL.prepare(
    "SELECT c.* FROM directory d JOIN companies c ON c.id = d.company_id WHERE d.email = ? AND c.deleted_at IS NULL LIMIT 1",
  ).bind(email.trim().toLowerCase()).first<Company>();
}

const companyCache = new Map<string, { company: Company | null; at: number }>();

export async function getCompany(id: string, fresh = false) {
  const cached = companyCache.get(id);
  if (!fresh && cached && Date.now() - cached.at < 30_000) return cached.company;
  await ensureControlDatabase();
  const company = await env.CONTROL.prepare("SELECT * FROM companies WHERE id = ? AND deleted_at IS NULL").bind(id).first<Company>();
  companyCache.set(id, { company, at: Date.now() });
  return company;
}

export function forgetCompany(id: string) {
  companyCache.delete(id);
}

/** Whether the company may use the portal: demo, paid, or still inside the trial. */
export function companyAccess(company: Company | null) {
  if (!company) return { allowed: false, reason: "missing" as const, daysLeft: 0 };
  if (company.is_demo || company.status === "active") return { allowed: true, reason: "active" as const, daysLeft: 0 };
  if (company.status === "past_due") return { allowed: true, reason: "past_due" as const, daysLeft: 0 };
  if (company.status === "trialing" && company.trial_ends_at) {
    const daysLeft = Math.ceil((new Date(company.trial_ends_at).getTime() - Date.now()) / 86_400_000);
    if (daysLeft > 0) return { allowed: true, reason: "trialing" as const, daysLeft };
  }
  return { allowed: false, reason: "expired" as const, daysLeft: 0 };
}

/** Returns the company that already uses this e-mail, unless it is the given one. */
export async function emailTakenElsewhere(email: string, companyId: string) {
  await ensureControlDatabase();
  const row = await env.CONTROL.prepare("SELECT company_id FROM directory WHERE email = ?").bind(email.trim().toLowerCase()).first<{ company_id: string }>();
  return Boolean(row && row.company_id !== companyId);
}

/** Mirrors the company's user e-mails into the central login directory. */
export async function syncDirectory(companyId: string) {
  await ensureControlDatabase();
  const users = await tenantDatabase(companyId).prepare("SELECT lower(email) AS email FROM users").all<{ email: string }>();
  const listed = await env.CONTROL.prepare("SELECT email FROM directory WHERE company_id = ?").bind(companyId).all<{ email: string }>();
  const wanted = new Set(users.results.map((row) => row.email));
  const present = new Set(listed.results.map((row) => row.email));
  const now = new Date().toISOString();
  const statements = [
    ...[...wanted].filter((email) => !present.has(email)).map((email) =>
      env.CONTROL.prepare("INSERT OR IGNORE INTO directory (email, company_id, created_at) VALUES (?, ?, ?)").bind(email, companyId, now)),
    ...[...present].filter((email) => !wanted.has(email)).map((email) =>
      env.CONTROL.prepare("DELETE FROM directory WHERE email = ? AND company_id = ?").bind(email, companyId)),
  ];
  if (statements.length) await env.CONTROL.batch(statements);
}

function newCompanyId() {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return "c" + Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("").slice(0, 11);
}

function tursoPlatform() {
  const token = process.env.TURSO_PLATFORM_TOKEN;
  const org = process.env.TURSO_ORG;
  return token && org ? { token, org, group: process.env.TURSO_GROUP || "default" } : null;
}

async function provisionDatabase(companyId: string) {
  const platform = tursoPlatform();
  if (!platform) {
    if (process.env.TENANT_DATABASE_URL_TEMPLATE) throw new Error("TURSO_PLATFORM_TOKEN und TURSO_ORG fehlen für neue Firmen-Datenbanken.");
    return;
  }
  const response = await fetch(`https://api.turso.tech/v1/organizations/${platform.org}/databases`, {
    method: "POST",
    headers: { authorization: `Bearer ${platform.token}`, "content-type": "application/json" },
    body: JSON.stringify({ name: tenantDatabaseName(companyId), group: platform.group }),
  });
  if (!response.ok) throw new Error(`Datenbank konnte nicht angelegt werden (${response.status})`);
}

async function dropDatabase(companyId: string) {
  forgetTenantDatabase(companyId);
  const platform = tursoPlatform();
  if (!platform) {
    const { rm } = await import("node:fs/promises");
    const dir = process.env.LOGIPAY_DATA_DIR || ".data";
    await rm(`${dir}/tenants/${companyId}.db`, { force: true });
    return;
  }
  const response = await fetch(`https://api.turso.tech/v1/organizations/${platform.org}/databases/${tenantDatabaseName(companyId)}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${platform.token}` },
  });
  if (!response.ok && response.status !== 404) throw new Error(`Datenbank konnte nicht gelöscht werden (${response.status})`);
}

export async function recordSignupAttempt(ipAddress: string) {
  await ensureControlDatabase();
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const recent = await env.CONTROL.prepare("SELECT COUNT(*) AS count FROM signup_attempts WHERE ip_address = ? AND created_at > ?").bind(ipAddress, since).first<{ count: number }>();
  if (Number(recent?.count || 0) >= 5) return false;
  await env.CONTROL.prepare("INSERT INTO signup_attempts (ip_address, created_at) VALUES (?, ?)").bind(ipAddress, new Date().toISOString()).run();
  return true;
}

export async function createCompany(input: { name: string; ownerName: string; email: string; passwordHash: string }) {
  await ensureControlDatabase();
  const email = input.email.trim().toLowerCase();
  if (await companyForEmail(email)) throw new CompanyError("Diese E-Mail ist bereits registriert.", 409);
  const id = newCompanyId();
  const now = new Date();
  const trialEnds = new Date(now.getTime() + TRIAL_DAYS * 86_400_000).toISOString();
  await provisionDatabase(id);
  const { ensureAuthDatabase } = await import("./auth");
  const { ensureDomainDatabase } = await import("./domain");
  let userId = 0;
  await runAsTenant(id, async () => {
    // A freshly created Turso database can need a moment before it accepts queries.
    for (let attempt = 0; ; attempt++) {
      try {
        await ensureAuthDatabase();
        break;
      } catch (error) {
        if (attempt >= 5) throw error;
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    }
    await ensureDomainDatabase();
    const created = await env.DB.prepare(
      "INSERT INTO users (email, full_name, role, password_hash, must_change_password, active) VALUES (?, ?, 'management', ?, 0, 1)",
    ).bind(email, input.ownerName.trim(), input.passwordHash).run();
    userId = Number(created.meta.last_row_id);
  });
  await env.CONTROL.batch([
    env.CONTROL.prepare("INSERT INTO companies (id, name, status, trial_ends_at, created_at, updated_at) VALUES (?, ?, 'trialing', ?, ?, ?)")
      .bind(id, input.name.trim(), trialEnds, now.toISOString(), now.toISOString()),
    env.CONTROL.prepare("INSERT INTO directory (email, company_id, created_at) VALUES (?, ?, ?)").bind(email, id, now.toISOString()),
  ]);
  return { id, userId };
}

/** Removes the company's database, files and logins for good (DSGVO Art. 17). */
export async function deleteCompany(companyId: string) {
  if (!isTenantId(companyId) || companyId === DEMO_TENANT) throw new CompanyError("Diese Firma kann nicht gelöscht werden.", 400);
  await env.documentsFor(companyId).deletePrefix("");
  await dropDatabase(companyId);
  const now = new Date().toISOString();
  await env.CONTROL.batch([
    env.CONTROL.prepare("DELETE FROM directory WHERE company_id = ?").bind(companyId),
    env.CONTROL.prepare("UPDATE companies SET status='deleted', deleted_at=?, updated_at=?, name='[gelöscht]' WHERE id=?").bind(now, now, companyId),
  ]);
  forgetCompany(companyId);
}

export async function updateCompany(companyId: string, fields: Partial<Pick<Company, "name" | "status" | "trial_ends_at" | "stripe_customer_id" | "stripe_subscription_id" | "seats">>) {
  const entries = Object.entries(fields).filter(([, value]) => value !== undefined);
  if (!entries.length) return;
  await ensureControlDatabase();
  await env.CONTROL.prepare(`UPDATE companies SET ${entries.map(([key]) => `${key} = ?`).join(", ")}, updated_at = ? WHERE id = ?`)
    .bind(...entries.map(([, value]) => value as string | number | null), new Date().toISOString(), companyId).run();
  forgetCompany(companyId);
}

export class CompanyError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}
