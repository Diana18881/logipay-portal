import { env } from "@logipay/env";
import { requirePortalUser } from "../../../../lib/auth";
import { ensureDomainDatabase } from "../../../../lib/domain";

export async function GET() {
  const user = await requirePortalUser(["management"]);
  await ensureDomainDatabase();
  const tables = ["staff", "vehicles", "weekly_planning", "trip_operations", "trip_documents", "driver_concerns", "payroll_calculations", "salary_documents", "employee_documents", "vehicle_files", "vehicle_maintenance", "tachograph_records", "expenses", "vehicle_checklists", "truck_trackers", "truck_positions", "notifications", "audit_log", "login_audit", "work_days", "absences", "driver_performance_events", "payroll_periods"];
  const data: Record<string, unknown[]> = {};
  for (const table of tables) data[table] = (await env.DB.prepare(`SELECT * FROM ${table}`).all()).results;
  const createdAt = new Date().toISOString();
  await env.DB.prepare("INSERT INTO audit_log (user_id, action, entity_id, details, created_at) VALUES (?, 'backupExport', NULL, ?, ?)").bind(user.id, JSON.stringify({ tables, format: "json" }), createdAt).run();
  return Response.json({ product: "LOGIPAY", version: 2, createdAt, note: "Metadata export; protected file objects remain in R2", data }, { headers: { "Content-Disposition": `attachment; filename="logipay-backup-${createdAt.slice(0, 10)}.json"`, "Cache-Control": "private, no-store" } });
}
