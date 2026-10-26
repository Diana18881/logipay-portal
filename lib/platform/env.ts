import { AsyncLocalStorage } from "node:async_hooks";
import { getHeadersContext } from "vinext/shims/headers";
import { createBlobDocuments, type DocumentsStore } from "./blob-documents";
import { createLibsqlDatabase, type LibsqlDatabase } from "./libsql-d1";

// Every company (tenant) has its own database and its own file prefix.
// The tenant is taken from an explicit scope (login, signup, device ingest) or from the session cookie.

export const SESSION_COOKIE = "logipay_session";
const TENANT_ID = /^[a-z0-9]{4,32}$/;

const tenantScope = new AsyncLocalStorage<string>();
const databases = new Map<string, LibsqlDatabase>();
let control: LibsqlDatabase | null = null;
let documents: DocumentsStore | null = null;

export function isTenantId(value: string | null | undefined): value is string {
  return Boolean(value && TENANT_ID.test(value));
}

export function runAsTenant<T>(tenantId: string, fn: () => T): T {
  if (!isTenantId(tenantId)) throw new Error("Ungültige Firmenkennung");
  return tenantScope.run(tenantId, fn);
}

/** Session tokens look like `<tenantId>.<secret>`; the tenant part only selects the database. */
export function tenantFromSessionToken(token: string | null | undefined) {
  const tenant = token?.split(".")[0];
  return isTenantId(tenant) ? tenant : null;
}

export function currentTenantId(): string | null {
  const scoped = tenantScope.getStore();
  if (scoped) return scoped;
  try {
    const context = getHeadersContext() as { cookies?: Map<string, string> } | null;
    return tenantFromSessionToken(context?.cookies?.get(SESSION_COOKIE));
  } catch {
    return null;
  }
}

function localDataDir() {
  return process.env.LOGIPAY_DATA_DIR || ".data";
}

function isProduction() {
  return process.env.VERCEL_ENV === "production" || process.env.VERCEL_ENV === "preview";
}

function controlDatabaseUrl() {
  const url = process.env.TURSO_DATABASE_URL || process.env.LOGIPAY_DATABASE_URL;
  if (url) return url;
  if (isProduction()) throw new Error("TURSO_DATABASE_URL fehlt (zentrale Datenbank).");
  return `file:${localDataDir()}/control.db`;
}

export function tenantDatabaseName(tenantId: string) {
  return `lp-${tenantId}`;
}

export function tenantDatabaseUrl(tenantId: string) {
  const template = process.env.TENANT_DATABASE_URL_TEMPLATE;
  if (template) return template.replaceAll("{db}", tenantDatabaseName(tenantId));
  if (isProduction()) throw new Error("TENANT_DATABASE_URL_TEMPLATE fehlt.");
  return `file:${localDataDir()}/tenants/${tenantId}.db`;
}

export function tenantDatabase(tenantId: string) {
  if (!isTenantId(tenantId)) throw new Error("Ungültige Firmenkennung");
  let database = databases.get(tenantId);
  if (!database) {
    database = createLibsqlDatabase(tenantDatabaseUrl(tenantId), process.env.TENANT_DATABASE_TOKEN || process.env.TURSO_AUTH_TOKEN);
    databases.set(tenantId, database);
  }
  return database;
}

export function forgetTenantDatabase(tenantId: string) {
  databases.delete(tenantId);
}

function requireTenant() {
  const tenant = currentTenantId();
  if (!tenant) throw new Error("Keine Firma angemeldet");
  return tenant;
}

function tenantDocuments(tenantId: string): DocumentsStore {
  documents ??= createBlobDocuments();
  const store = documents;
  const prefix = `tenants/${tenantId}/`;
  return {
    put: (key, body, options) => store.put(prefix + key, body, options),
    get: (key) => store.get(prefix + key),
    delete: (key) => store.delete(prefix + key),
    deletePrefix: (key) => store.deletePrefix(prefix + key),
  };
}

export const env = {
  /** Database of the company that is currently signed in. */
  get DB() {
    return tenantDatabase(requireTenant());
  },
  /** File storage of the company that is currently signed in; keys are prefixed per company. */
  get DOCUMENTS() {
    return tenantDocuments(requireTenant());
  },
  /** Central database: companies, login directory, billing. */
  get CONTROL() {
    control ??= createLibsqlDatabase(controlDatabaseUrl(), process.env.TURSO_AUTH_TOKEN || process.env.LOGIPAY_DATABASE_TOKEN);
    return control;
  },
  documentsFor: tenantDocuments,
};
