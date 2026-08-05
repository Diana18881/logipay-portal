import { env } from "cloudflare:workers";
import { requirePortalUser } from "../../../../lib/auth";
import { ensureDomainDatabase } from "../../../../lib/domain";

export async function GET() {
  const user = await requirePortalUser(["management"]);
  await ensureDomainDatabase();
  const tables = ["staff", "vehicles", "weekly_planning", "driver_concerns", "payroll_calculations", "salary_documents", "employee_documents", "vehicle_files", "vehicle_maintenance", "audit_log", "login_audit"];
  const data: Record<string, unknown[]> = {};
  for (const table of tables) data[table] = (await env.DB.prepare(`SELECT * FROM ${table}`).all()).results;
  const createdAt = new Date().toISOString();
  await env.DB.prepare("INSERT INTO audit_log (user_id, action, entity_id, details, created_at) VALUES (?, 'backupExport', NULL, ?, ?)").bind(user.id, JSON.stringify({ tables, format: "json" }), createdAt).run();
  return Response.json({ product: "LOGIPAY", version: 1, createdAt, note: "Metadata export; protected file objects remain in R2", data }, { headers: { "Content-Disposition": `attachment; filename="logipay-backup-${createdAt.slice(0, 10)}.json"`, "Cache-Control": "private, no-store" } });
}
