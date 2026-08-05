import { env } from "cloudflare:workers";
import { requirePortalUser } from "../../../../../lib/auth";
import { ensureDomainDatabase } from "../../../../../lib/domain";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requirePortalUser(["management"]);
  await ensureDomainDatabase();
  const { id } = await context.params;
  const staff = await env.DB.prepare("SELECT * FROM staff WHERE id=?").bind(id).first();
  if (!staff) return new Response("Nicht gefunden", { status: 404 });
  const [planning, concerns, payroll, documents, files] = await Promise.all([
    env.DB.prepare("SELECT * FROM weekly_planning WHERE staff_id=?").bind(id).all(),
    env.DB.prepare("SELECT * FROM driver_concerns WHERE staff_id=?").bind(id).all(),
    env.DB.prepare("SELECT * FROM payroll_calculations WHERE staff_id=?").bind(id).all(),
    env.DB.prepare("SELECT id, category, file_name, expires_at, created_at FROM employee_documents WHERE staff_id=?").bind(id).all(),
    env.DB.prepare("SELECT id, license_plate, category, file_name, notes, created_at FROM vehicle_files WHERE staff_id=?").bind(id).all(),
  ]);
  await env.DB.prepare("INSERT INTO audit_log (user_id, action, entity_id, details, created_at) VALUES (?, 'gdprStaffExport', ?, '{}', ?)").bind(user.id, id, new Date().toISOString()).run();
  return Response.json({ staff, planning: planning.results, concerns: concerns.results, payroll: payroll.results, documentMetadata: documents.results, vehicleFileMetadata: files.results }, { headers: { "Content-Disposition": `attachment; filename="mitarbeiter-${id}-export.json"`, "Cache-Control": "private, no-store" } });
}
