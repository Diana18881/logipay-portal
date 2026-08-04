import { env } from "cloudflare:workers";
import { ensureDomainDatabase } from "../../../lib/domain";
import { requirePortalUser } from "../../../lib/auth";

const json = (data: unknown, status = 200) => Response.json(data, { status });

export async function GET(request: Request) {
  const user = await requirePortalUser();
  await ensureDomainDatabase();
  const kw = Number(new URL(request.url).searchParams.get("kw") || 32);
  const staffWhere = user.role === "driver" ? "WHERE s.user_id = ? OR s.full_name = ?" : "";
  const staffStmt = env.DB.prepare(`SELECT s.* FROM staff s ${staffWhere} ORDER BY s.status, s.full_name`);
  const staffResult = user.role === "driver" ? await staffStmt.bind(user.id, user.fullName).all() : await staffStmt.all();
  const vehicles = user.role === "driver" ? { results: [] } : await env.DB.prepare("SELECT * FROM vehicles ORDER BY status, license_plate").all();
  const planning = user.role === "driver"
    ? await env.DB.prepare("SELECT * FROM weekly_planning WHERE calendar_week = ? AND driver_name = ? ORDER BY company").bind(kw, user.fullName).all()
    : await env.DB.prepare("SELECT * FROM weekly_planning WHERE calendar_week = ? ORDER BY company, driver_name").bind(kw).all();
  const staffIds = (staffResult.results as {id:number}[]).map((s) => s.id);
  let documents: unknown[] = [];
  if (user.role !== "dispatcher" && (user.role !== "driver" || staffIds.length)) {
    const stmt = user.role === "driver"
      ? env.DB.prepare("SELECT d.*, s.full_name FROM salary_documents d JOIN staff s ON s.id=d.staff_id WHERE d.staff_id=? ORDER BY d.period DESC")
      : env.DB.prepare("SELECT d.*, s.full_name FROM salary_documents d JOIN staff s ON s.id=d.staff_id ORDER BY d.period DESC");
    documents = (user.role === "driver" ? await stmt.bind(staffIds[0]).all() : await stmt.all()).results;
  }
  const concerns = user.role === "driver" ? { results: [] } : await env.DB.prepare("SELECT * FROM driver_concerns ORDER BY period DESC, completion_status, company").all();
  return json({ user, kw, staff: staffResult.results, vehicles: vehicles.results, planning: planning.results, documents, concerns: concerns.results });
}

export async function POST(request: Request) {
  const user = await requirePortalUser(["management", "accountant", "dispatcher"]);
  await ensureDomainDatabase();
  const body = await request.json() as Record<string, string | number | null>;
  const action = String(body.action || "");
  const now = new Date().toISOString();
  if (action === "addStaff" && user.role === "management") {
    await env.DB.prepare("INSERT INTO staff (full_name, system_type, compensation, location, company, vacation, status, hired_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)").bind(body.fullName, body.systemType || "2/1", body.compensation || "", body.location || "", body.company || "", body.vacation || "", String(body.hiredAt || now.slice(0,10)), now, now).run();
  } else if (action === "archiveStaff" && user.role === "management") {
    await env.DB.prepare("UPDATE staff SET status='archived', terminated_at=?, updated_at=? WHERE id=?").bind(String(body.terminatedAt || now.slice(0,10)), now, body.id).run();
  } else if (action === "restoreStaff" && user.role === "management") {
    await env.DB.prepare("UPDATE staff SET status='active', terminated_at=NULL, updated_at=? WHERE id=?").bind(now, body.id).run();
  } else if (action === "updateStaff" && user.role === "management") {
    await env.DB.prepare("UPDATE staff SET full_name=?, system_type=?, compensation=?, location=?, company=?, vacation=?, updated_at=? WHERE id=?").bind(body.fullName, body.systemType || "", body.compensation || "", body.location || "", body.company || "", body.vacation || "", now, body.id).run();
  } else if (action === "deleteStaff" && user.role === "management") {
    const linked = await env.DB.prepare("SELECT (SELECT COUNT(*) FROM salary_documents WHERE staff_id=?) + (SELECT COUNT(*) FROM weekly_planning WHERE staff_id=?) AS count").bind(body.id, body.id).first<{count:number}>();
    if (linked?.count) return json({ error: "Mitarbeiter hat Historie und kann nur archiviert werden" }, 409);
    await env.DB.prepare("DELETE FROM staff WHERE id=? AND status='archived'").bind(body.id).run();
  } else if (action === "addVehicle" && ["management","dispatcher"].includes(user.role)) {
    await env.DB.prepare("INSERT INTO vehicles (license_plate, company, location, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(body.licensePlate, body.company || "", body.location || "", body.status || "active", body.notes || "", now, now).run();
  } else if (action === "addPlanning" && ["management","dispatcher"].includes(user.role)) {
    await env.DB.prepare("INSERT INTO weekly_planning (calendar_week, company, driver_name, location, license_plate, status, comments, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(body.calendarWeek, body.company, body.driverName || "", body.location || "", body.licensePlate || "", body.status || "planned", body.comments || "", now, now).run();
  } else if (action === "deletePlanning" && ["management","dispatcher"].includes(user.role)) {
    await env.DB.prepare("DELETE FROM weekly_planning WHERE id=?").bind(body.id).run();
  } else if (action === "addConcern" && ["management","dispatcher"].includes(user.role)) {
    await env.DB.prepare("INSERT INTO driver_concerns (period, company, base, truck_number, item_name, purchase_status, completion_status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(body.period, body.company, body.base || "", body.truckNumber || "", body.itemName, body.purchaseStatus || "", body.completionStatus || "Not delivered", body.notes || "", now, now).run();
  } else if (action === "updateConcern" && ["management","dispatcher"].includes(user.role)) {
    await env.DB.prepare("UPDATE driver_concerns SET period=?, company=?, base=?, truck_number=?, item_name=?, purchase_status=?, completion_status=?, notes=?, updated_at=? WHERE id=?").bind(body.period, body.company, body.base || "", body.truckNumber || "", body.itemName, body.purchaseStatus || "", body.completionStatus || "Not delivered", body.notes || "", now, body.id).run();
  } else if (action === "deleteConcern" && ["management","dispatcher"].includes(user.role)) {
    await env.DB.prepare("DELETE FROM driver_concerns WHERE id=?").bind(body.id).run();
  } else return json({ error: "Keine Berechtigung oder unbekannte Aktion" }, 403);
  return json({ ok: true });
}
