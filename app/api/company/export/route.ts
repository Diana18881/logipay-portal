import { env } from "@logipay/env";
import { getPortalUser } from "../../../../lib/auth";
import { ensureDomainDatabase } from "../../../../lib/domain";

// Full export of the company's data (DSGVO Art. 20). Secrets such as password hashes are left out.
const hiddenColumns = new Set(["password_hash", "two_factor_secret", "token_hash", "code_value"]);

export async function GET() {
  const user = await getPortalUser();
  if (!user || user.role !== "management") return Response.json({ error: "Nur die Geschäftsleitung kann alle Daten exportieren" }, { status: 403 });
  await ensureDomainDatabase();
  const tables = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('sessions', 'push_subscriptions') ORDER BY name").all<{ name: string }>();
  const data: Record<string, Record<string, unknown>[]> = {};
  for (const { name } of tables.results) {
    const rows = await env.DB.prepare(`SELECT * FROM "${name.replaceAll('"', "")}"`).all<Record<string, unknown>>();
    data[name] = rows.results.map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => !hiddenColumns.has(key))));
  }
  const createdAt = new Date().toISOString();
  await env.DB.prepare("INSERT INTO audit_log (user_id, action, entity_id, details, created_at) VALUES (?, 'companyExport', NULL, ?, ?)").bind(user.id, JSON.stringify({ tables: Object.keys(data).length }), createdAt).run();
  return Response.json(
    { product: "LOGIPAY", company: user.companyName, createdAt, note: "Dateien (Belege, Dokumente) sind über die Datensätze im Portal einzeln abrufbar.", data },
    { headers: { "Content-Disposition": `attachment; filename="logipay-export-${createdAt.slice(0, 10)}.json"`, "Cache-Control": "private, no-store" } },
  );
}
