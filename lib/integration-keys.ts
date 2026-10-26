import { env, runAsTenant, tenantFromSessionToken } from "@logipay/env";
import { getCompany, companyAccess } from "./tenants";

// Telematics devices authenticate with a per-company key `<companyId>.<secret>`; only a hash is stored.

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export async function getSetting(key: string) {
  const row = await env.DB.prepare("SELECT value FROM company_settings WHERE key=?").bind(key).first<{ value: string | null }>();
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string | null) {
  await env.DB.prepare("INSERT INTO company_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at")
    .bind(key, value, new Date().toISOString()).run();
}

/** Creates a new key for the signed-in company and returns it once; the previous key stops working. */
export async function rotateIntegrationKey(companyId: string) {
  const secret = Array.from(crypto.getRandomValues(new Uint8Array(24)), (byte) => byte.toString(16).padStart(2, "0")).join("");
  await setSetting("integration_key_hash", await sha256(secret));
  await setSetting("integration_key_created_at", new Date().toISOString());
  return `${companyId}.${secret}`;
}

export async function hasIntegrationKey() {
  return Boolean(await getSetting("integration_key_hash"));
}

/** Runs the handler inside the company that owns the bearer key, or answers 401. */
export async function withIntegrationKey(request: Request, handler: () => Promise<Response>) {
  const authorization = request.headers.get("authorization") || "";
  const key = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  const companyId = tenantFromSessionToken(key);
  const secret = key.slice((companyId?.length ?? 0) + 1);
  const unauthorized = () => Response.json({ error: "Ungültiger Schnittstellenschlüssel" }, { status: 401 });
  if (!companyId || !secret) return unauthorized();
  if (!companyAccess(await getCompany(companyId)).allowed) return unauthorized();
  return runAsTenant(companyId, async () => {
    const { ensureDomainDatabase } = await import("./domain");
    await ensureDomainDatabase();
    const stored = await getSetting("integration_key_hash");
    if (!stored || !safeEqual(stored, await sha256(secret))) return unauthorized();
    return handler();
  });
}
