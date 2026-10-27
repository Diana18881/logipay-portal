import { env, tenantDatabase } from "@logipay/env";
import { createBlobDocuments } from "../../../../lib/platform/blob-documents";
import { ensureControlDatabase } from "../../../../lib/tenants";

// Nightly backup (Vercel Cron, 03:00): every company database and the central database as JSON
// into private file storage under backups/<date>/; backups older than 14 days are removed.

const KEEP_DAYS = 14;

async function dump(db: { prepare: (sql: string) => { all: <T>() => Promise<{ results: T[] }> } }) {
  const tables = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all<{ name: string }>();
  const data: Record<string, unknown[]> = {};
  for (const { name } of tables.results) data[name] = (await db.prepare(`SELECT * FROM "${name.replaceAll('"', "")}"`).all()).results;
  return data;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Nicht erlaubt" }, { status: 401 });
  await ensureControlDatabase();
  const storage = createBlobDocuments();
  const day = new Date().toISOString().slice(0, 10);
  const companies = await env.CONTROL.prepare("SELECT id FROM companies WHERE deleted_at IS NULL").all<{ id: string }>();
  const results: { company: string; ok: boolean; error?: string }[] = [];
  await storage.put(`backups/${day}/control.json`, JSON.stringify({ createdAt: new Date().toISOString(), data: await dump(env.CONTROL) }), { httpMetadata: { contentType: "application/json" } });
  for (const { id } of companies.results) {
    try {
      const data = await dump(tenantDatabase(id));
      await storage.put(`backups/${day}/${id}.json`, JSON.stringify({ company: id, createdAt: new Date().toISOString(), data }), { httpMetadata: { contentType: "application/json" } });
      results.push({ company: id, ok: true });
    } catch (error) {
      results.push({ company: id, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  for (let back = KEEP_DAYS; back < KEEP_DAYS + 30; back++) {
    const old = new Date(Date.now() - back * 86_400_000).toISOString().slice(0, 10);
    await storage.deletePrefix(`backups/${old}/`).catch(() => undefined);
  }
  const failed = results.filter((result) => !result.ok);
  if (failed.length) console.error("Backup failed for", failed);
  return Response.json({ day, companies: results.length, failed: failed.length }, { status: failed.length ? 500 : 200 });
}
