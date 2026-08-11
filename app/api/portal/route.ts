import { env } from "cloudflare:workers";
import { ensureDomainDatabase } from "../../../lib/domain";
import { hashPassword, requirePortalUser } from "../../../lib/auth";

const json = (data: unknown, status = 200) => Response.json(data, { status });
const normalizeDays = (value: unknown) => {
  const days = String(value || "1,2,3,4,5,6,7")
    .split(",")
    .map(Number)
    .filter((day) => Number.isInteger(day) && day >= 1 && day <= 7);
  return Array.from(new Set(days)).sort().join(",") || "1,2,3,4,5,6,7";
};
const daySetsOverlap = (left: string, right: string) => {
  const rightDays = new Set(right.split(","));
  return left.split(",").some((day) => rightDays.has(day));
};

export async function GET(request: Request) {
  const user = await requirePortalUser();
  await ensureDomainDatabase();
  const kw = Number(new URL(request.url).searchParams.get("kw") || 32);
  const year = Number(
    new URL(request.url).searchParams.get("year") || new Date().getFullYear(),
  );
  const staffWhere =
    user.role === "driver" ? "WHERE s.user_id = ? OR s.full_name = ?" : "";
  const staffStmt = env.DB.prepare(
    `SELECT s.*, u.email AS login_email FROM staff s LEFT JOIN users u ON u.id=s.user_id ${staffWhere} ORDER BY s.status, s.full_name`,
  );
  const staffResult =
    user.role === "driver"
      ? await staffStmt.bind(user.id, user.fullName).all()
      : await staffStmt.all();
  const vehicles =
    user.role === "driver"
      ? await env.DB.prepare(
          "SELECT DISTINCT v.* FROM vehicles v JOIN weekly_planning p ON p.license_plate=v.license_plate JOIN staff s ON s.id=p.staff_id WHERE s.user_id=? ORDER BY v.license_plate",
        )
          .bind(user.id)
          .all()
      : await env.DB.prepare(
          "SELECT * FROM vehicles ORDER BY status, license_plate",
        ).all();
  const driverStaffId = (staffResult.results as { id: number }[])[0]?.id;
  const planning =
    user.role === "driver"
      ? await env.DB.prepare(
          "SELECT * FROM weekly_planning WHERE planning_year = ? AND calendar_week = ? AND (staff_id = ? OR driver_name = ?) ORDER BY company",
        )
          .bind(year, kw, driverStaffId || -1, user.fullName)
          .all()
      : await env.DB.prepare(
          "SELECT * FROM weekly_planning WHERE planning_year = ? AND calendar_week = ? ORDER BY company, driver_name",
        )
          .bind(year, kw)
          .all();
  const staffIds = (staffResult.results as { id: number }[]).map((s) => s.id);
  let documents: unknown[] = [];
  if (
    user.role !== "dispatcher" &&
    (user.role !== "driver" || staffIds.length)
  ) {
    const stmt =
      user.role === "driver"
        ? env.DB.prepare(
            "SELECT d.*, s.full_name FROM salary_documents d JOIN staff s ON s.id=d.staff_id WHERE d.staff_id=? ORDER BY d.period DESC",
          )
        : env.DB.prepare(
            "SELECT d.*, s.full_name FROM salary_documents d JOIN staff s ON s.id=d.staff_id ORDER BY d.period DESC",
          );
    documents = (
      user.role === "driver"
        ? await stmt.bind(staffIds[0]).all()
        : await stmt.all()
    ).results;
  }
  const concerns =
    user.role === "driver"
      ? await env.DB.prepare(
          "SELECT * FROM driver_concerns WHERE staff_id=? OR notes=? ORDER BY created_at DESC",
        )
          .bind(driverStaffId || -1, user.fullName)
          .all()
      : await env.DB.prepare(
          "SELECT * FROM driver_concerns ORDER BY period DESC, completion_status, company",
        ).all();
  const voiceMessages = user.role === "driver"
    ? await env.DB.prepare("SELECT vm.*, s.full_name FROM voice_messages vm JOIN staff s ON s.id=vm.staff_id WHERE vm.user_id=? ORDER BY vm.created_at DESC LIMIT 100").bind(user.id).all()
    : ["management", "dispatcher"].includes(user.role)
      ? await env.DB.prepare("SELECT vm.*, s.full_name FROM voice_messages vm JOIN staff s ON s.id=vm.staff_id ORDER BY vm.status='Neu' DESC, vm.created_at DESC LIMIT 200").all()
      : { results: [] };
  const files =
    user.role === "driver"
      ? await env.DB.prepare(
          "SELECT vf.*, s.full_name AS driver_name FROM vehicle_files vf JOIN staff s ON s.id=vf.staff_id WHERE s.user_id=? ORDER BY vf.created_at DESC",
        )
          .bind(user.id)
          .all()
      : ["management", "dispatcher"].includes(user.role)
        ? await env.DB.prepare(
            "SELECT vf.*, s.full_name AS driver_name FROM vehicle_files vf LEFT JOIN staff s ON s.id=vf.staff_id ORDER BY vf.created_at DESC",
          ).all()
        : { results: [] };
  const employeeDocuments =
    user.role === "dispatcher"
      ? { results: [] }
      : user.role === "driver"
        ? await env.DB.prepare("SELECT d.*, s.full_name FROM employee_documents d JOIN staff s ON s.id=d.staff_id WHERE d.staff_id=? ORDER BY d.created_at DESC").bind(driverStaffId || -1).all()
        : await env.DB.prepare("SELECT d.*, s.full_name FROM employee_documents d JOIN staff s ON s.id=d.staff_id ORDER BY d.created_at DESC").all();
  const payroll =
    user.role === "dispatcher"
      ? { results: [] }
      : user.role === "driver"
        ? await env.DB.prepare("SELECT p.*, s.full_name FROM payroll_calculations p JOIN staff s ON s.id=p.staff_id WHERE p.staff_id=? ORDER BY p.period DESC").bind(driverStaffId || -1).all()
        : await env.DB.prepare("SELECT p.*, s.full_name FROM payroll_calculations p JOIN staff s ON s.id=p.staff_id ORDER BY p.period DESC, s.full_name").all();
  const maintenance =
    user.role === "accountant"
      ? { results: [] }
      : user.role === "driver"
        ? await env.DB.prepare("SELECT m.* FROM vehicle_maintenance m WHERE m.license_plate IN (SELECT license_plate FROM weekly_planning WHERE staff_id=?) ORDER BY m.created_at DESC").bind(driverStaffId || -1).all()
        : await env.DB.prepare("SELECT * FROM vehicle_maintenance ORDER BY created_at DESC").all();
  const latestTrackingSql = `SELECT t.id, t.license_plate, t.device_id, t.provider, t.enabled, t.last_connected_at,
      p.latitude, p.longitude, p.speed_kph, p.heading, p.ignition, p.odometer_km, p.address, p.source, p.recorded_at, p.received_at
    FROM truck_trackers t
    LEFT JOIN truck_positions p ON p.id=(SELECT tp.id FROM truck_positions tp WHERE tp.tracker_id=t.id ORDER BY tp.recorded_at DESC, tp.id DESC LIMIT 1)`;
  const tracking = user.role === "accountant"
    ? { results: [] }
    : user.role === "driver"
      ? await env.DB.prepare(`${latestTrackingSql}
          WHERE t.enabled=1 AND t.license_plate IN (
            SELECT DISTINCT license_plate FROM weekly_planning
            WHERE license_plate IS NOT NULL AND license_plate!='' AND (staff_id=? OR driver_name=?))
          ORDER BY t.license_plate`)
        .bind(driverStaffId || -1, user.fullName)
        .all()
      : await env.DB.prepare(`${latestTrackingSql} ORDER BY t.license_plate`).all();
  const loginAudit = user.role === "management"
    ? await env.DB.prepare("SELECT * FROM login_audit ORDER BY created_at DESC LIMIT 100").all()
    : { results: [] };
  const resetRequests = user.role === "management"
    ? await env.DB.prepare("SELECT * FROM password_reset_requests WHERE status='open' ORDER BY created_at DESC").all()
    : { results: [] };
  const audit = ["management", "accountant"].includes(user.role)
    ? await env.DB.prepare("SELECT a.*, u.full_name AS user_name FROM audit_log a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 150").all()
    : { results: [] };
  const portalUsers = user.role === "management"
    ? await env.DB.prepare("SELECT u.id, u.email, u.full_name, u.role, u.must_change_password, u.active, u.failed_attempts, u.locked_until, u.two_factor_enabled, s.id AS staff_id FROM users u LEFT JOIN staff s ON s.user_id=u.id ORDER BY u.active DESC, u.role, u.full_name").all()
    : { results: [] };
  const tachograph = user.role === "accountant"
    ? { results: [] }
    : user.role === "driver"
      ? await env.DB.prepare("SELECT t.*, s.full_name FROM tachograph_records t JOIN staff s ON s.id=t.staff_id WHERE t.staff_id=? ORDER BY t.record_date DESC, t.id DESC LIMIT 120").bind(driverStaffId || -1).all()
      : await env.DB.prepare("SELECT t.*, s.full_name FROM tachograph_records t JOIN staff s ON s.id=t.staff_id ORDER BY t.record_date DESC, t.id DESC LIMIT 300").all();
  const tripOperationsSql = `SELECT o.*, p.planning_year, p.calendar_week, p.company, p.staff_id, p.driver_name, p.location, p.license_plate, p.block_id, p.start_time
    FROM trip_operations o JOIN weekly_planning p ON p.id=o.planning_id`;
  const tripOperations = user.role === "accountant"
    ? { results: [] }
    : user.role === "driver"
      ? await env.DB.prepare(`${tripOperationsSql} WHERE p.planning_year=? AND p.calendar_week=? AND (p.staff_id=? OR p.driver_name=?) ORDER BY p.start_time, p.company`).bind(year, kw, driverStaffId || -1, user.fullName).all()
      : await env.DB.prepare(`${tripOperationsSql} WHERE p.planning_year=? AND p.calendar_week=? ORDER BY p.start_time, p.company`).bind(year, kw).all();
  const tripDocuments = user.role === "accountant"
    ? { results: [] }
    : user.role === "driver"
      ? await env.DB.prepare("SELECT d.* FROM trip_documents d JOIN trip_operations o ON o.id=d.trip_operation_id JOIN weekly_planning p ON p.id=o.planning_id WHERE p.staff_id=? OR p.driver_name=? ORDER BY d.created_at DESC").bind(driverStaffId || -1, user.fullName).all()
      : await env.DB.prepare("SELECT d.*, p.license_plate, p.driver_name FROM trip_documents d JOIN trip_operations o ON o.id=d.trip_operation_id JOIN weekly_planning p ON p.id=o.planning_id ORDER BY d.created_at DESC LIMIT 300").all();
  const expenses = user.role === "driver"
    ? await env.DB.prepare("SELECT e.*, s.full_name FROM expenses e JOIN staff s ON s.id=e.staff_id WHERE e.staff_id=? ORDER BY e.expense_date DESC, e.id DESC").bind(driverStaffId || -1).all()
    : await env.DB.prepare("SELECT e.*, s.full_name FROM expenses e JOIN staff s ON s.id=e.staff_id ORDER BY e.expense_date DESC, e.id DESC LIMIT 500").all();
  const notifications = user.role === "management"
    ? await env.DB.prepare("SELECT * FROM notifications ORDER BY read_at IS NOT NULL, created_at DESC LIMIT 250").all()
    : await env.DB.prepare(
        "SELECT * FROM notifications WHERE user_id=? OR role_scope=? OR role_scope='all' ORDER BY read_at IS NOT NULL, created_at DESC LIMIT 150",
      ).bind(user.id, user.role).all();
  const checklists = user.role === "accountant"
    ? { results: [] }
    : user.role === "driver"
      ? await env.DB.prepare("SELECT c.*, s.full_name FROM vehicle_checklists c JOIN staff s ON s.id=c.staff_id WHERE c.staff_id=? ORDER BY c.created_at DESC LIMIT 120").bind(driverStaffId || -1).all()
      : await env.DB.prepare("SELECT c.*, s.full_name FROM vehicle_checklists c JOIN staff s ON s.id=c.staff_id ORDER BY c.created_at DESC LIMIT 300").all();
  return json({
    user,
    year,
    kw,
    staff: staffResult.results,
    vehicles: vehicles.results,
    planning: planning.results,
    documents,
    concerns: concerns.results,
    voiceMessages: voiceMessages.results,
    files: files.results,
    employeeDocuments: employeeDocuments.results,
    payroll: payroll.results,
    maintenance: maintenance.results,
    tracking: tracking.results,
    loginAudit: loginAudit.results,
    resetRequests: resetRequests.results,
    audit: audit.results,
    portalUsers: portalUsers.results,
    tachograph: tachograph.results,
    tripOperations: tripOperations.results,
    tripDocuments: tripDocuments.results,
    expenses: expenses.results,
    notifications: notifications.results,
    checklists: checklists.results,
  });
}

export async function POST(request: Request) {
  const user = await requirePortalUser();
  await ensureDomainDatabase();
  const body = (await request.json()) as Record<string, string | number | null>;
  const action = String(body.action || "");
  const now = new Date().toISOString();
  let auditDetails: Record<string, unknown> = {};
  if (action === "addPortalUser" && user.role === "management") {
    const email = String(body.email || "").trim().toLowerCase();
    const fullName = String(body.fullName || "").trim();
    const role = String(body.role || "");
    const password = String(body.password || "");
    if (!email || !fullName || !["management", "accountant", "dispatcher", "driver"].includes(role))
      return json({ error: "Name, E-Mail und gültige Rolle sind erforderlich" }, 400);
    if (password.length < 10 || !/[A-ZА-Я]/.test(password) || !/[0-9]/.test(password))
      return json({ error: "Startpasswort: mindestens 10 Zeichen, Großbuchstabe und Zahl" }, 400);
    const exists = await env.DB.prepare("SELECT id FROM users WHERE email=?").bind(email).first();
    if (exists) return json({ error: "Diese E-Mail ist bereits registriert" }, 409);
    const created = await env.DB.prepare(
      "INSERT INTO users (email, full_name, role, password_hash, must_change_password, active, failed_attempts) VALUES (?, ?, ?, ?, 1, 1, 0)",
    ).bind(email, fullName, role, await hashPassword(password)).run();
    const createdId = Number(created.meta.last_row_id);
    if (role === "driver" && Number(body.staffId || 0))
      await env.DB.prepare("UPDATE staff SET user_id=?, updated_at=? WHERE id=? AND status='active'").bind(createdId, now, Number(body.staffId)).run();
    auditDetails = { oldValue: null, newValue: { id: createdId, email, fullName, role, staffId: body.staffId || null } };
  } else if (action === "updatePortalUser" && user.role === "management") {
    const targetId = Number(body.id);
    if (!targetId) return json({ error: "Benutzer fehlt" }, 400);
    if (targetId === user.id && Number(body.active) === 0)
      return json({ error: "Der eigene Management-Zugang kann nicht deaktiviert werden" }, 409);
    const oldValue = await env.DB.prepare("SELECT id, email, full_name, role, active FROM users WHERE id=?").bind(targetId).first();
    if (!oldValue) return json({ error: "Benutzer nicht gefunden" }, 404);
    const role = String(body.role || "");
    if (!["management", "accountant", "dispatcher", "driver"].includes(role))
      return json({ error: "Ungültige Rolle" }, 400);
    await env.DB.prepare("UPDATE users SET email=?, full_name=?, role=?, active=? WHERE id=?")
      .bind(String(body.email || "").trim().toLowerCase(), String(body.fullName || "").trim(), role, Number(body.active) ? 1 : 0, targetId).run();
    if (role === "driver" && Number(body.staffId || 0))
      await env.DB.prepare("UPDATE staff SET user_id=?, updated_at=? WHERE id=? AND status='active'").bind(targetId, now, Number(body.staffId)).run();
    auditDetails = { oldValue, newValue: { email: body.email, fullName: body.fullName, role, active: Number(body.active) ? 1 : 0, staffId: body.staffId || null } };
  } else if (action === "adminResetPassword" && user.role === "management") {
    const targetId = Number(body.id);
    const password = String(body.password || "");
    if (!targetId || password.length < 10 || !/[A-ZА-Я]/.test(password) || !/[0-9]/.test(password))
      return json({ error: "Neues Startpasswort: mindestens 10 Zeichen, Großbuchstabe und Zahl" }, 400);
    await env.DB.prepare("UPDATE users SET password_hash=?, must_change_password=1, failed_attempts=0, locked_until=NULL, active=1 WHERE id=?")
      .bind(await hashPassword(password), targetId).run();
    await env.DB.prepare("UPDATE password_reset_requests SET status='resolved', resolved_at=? WHERE email=(SELECT email FROM users WHERE id=?) AND status='open'").bind(now, targetId).run();
    auditDetails = { oldValue: "password-hidden", newValue: { targetId, mustChangePassword: true, unlocked: true } };
  } else if (action === "saveTachograph" && ["management", "dispatcher"].includes(user.role)) {
    const staffId = Number(body.staffId);
    const drivingMinutes = Math.max(0, Number(body.drivingMinutes || 0));
    const restMinutes = Math.max(0, Number(body.restMinutes || 0));
    const remainingMinutes = Math.max(0, Number(body.remainingMinutes || 0));
    if (!staffId || !body.licensePlate || !body.recordDate)
      return json({ error: "Fahrer, Kennzeichen und Datum sind erforderlich" }, 400);
    await env.DB.prepare("INSERT INTO tachograph_records (staff_id, license_plate, record_date, driving_minutes, rest_minutes, remaining_minutes, infringement, source, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(staffId, body.licensePlate, body.recordDate, drivingMinutes, restMinutes, remainingMinutes, body.infringement || "", body.source || "manual", body.notes || "", now, now).run();
    if (remainingMinutes <= 90 || body.infringement)
      await env.DB.prepare("INSERT INTO notifications (role_scope, category, title, message, entity_type, entity_id, severity, created_at) VALUES ('dispatcher', 'tachograph', 'Tachograph-Warnung', ?, 'staff', ?, 'warning', ?)")
        .bind(`${body.licensePlate}: ${body.infringement || `nur noch ${remainingMinutes} Minuten Fahrzeit`}`, String(staffId), now).run();
    auditDetails = { oldValue: null, newValue: { staffId, licensePlate: body.licensePlate, recordDate: body.recordDate, drivingMinutes, restMinutes, remainingMinutes, infringement: body.infringement } };
  } else if (action === "saveTripOperation" && ["management", "dispatcher", "driver"].includes(user.role)) {
    const planningId = Number(body.planningId);
    const status = String(body.status || "Geplant");
    const allowedStatuses = ["Geplant", "Gestartet", "Beladen", "Unterwegs", "Zugestellt", "Problem"];
    if (!planningId || !allowedStatuses.includes(status)) return json({ error: "Ungültiger Einsatzstatus" }, 400);
    const plan = await env.DB.prepare("SELECT p.*, s.user_id FROM weekly_planning p LEFT JOIN staff s ON s.id=p.staff_id WHERE p.id=?").bind(planningId).first<Record<string, string | number | null>>();
    if (!plan) return json({ error: "Planung nicht gefunden" }, 404);
    if (user.role === "driver" && Number(plan.user_id) !== user.id && String(plan.driver_name) !== user.fullName)
      return json({ error: "Dieser Einsatz ist Ihnen nicht zugeteilt" }, 403);
    const startedAt = ["Gestartet", "Beladen", "Unterwegs", "Zugestellt", "Problem"].includes(status) ? now : null;
    const loadedAt = ["Beladen", "Unterwegs", "Zugestellt"].includes(status) ? now : null;
    const deliveredAt = status === "Zugestellt" ? now : null;
    const oldValue = await env.DB.prepare("SELECT * FROM trip_operations WHERE planning_id=?").bind(planningId).first();
    await env.DB.prepare(`INSERT INTO trip_operations (planning_id, status, pickup_address, delivery_address, eta, delay_reason, recipient_name, signature_name, started_at, loaded_at, delivered_at, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(planning_id) DO UPDATE SET status=excluded.status, pickup_address=excluded.pickup_address, delivery_address=excluded.delivery_address, eta=excluded.eta, delay_reason=excluded.delay_reason, recipient_name=excluded.recipient_name, signature_name=excluded.signature_name, started_at=COALESCE(trip_operations.started_at, excluded.started_at), loaded_at=COALESCE(trip_operations.loaded_at, excluded.loaded_at), delivered_at=COALESCE(trip_operations.delivered_at, excluded.delivered_at), updated_by=excluded.updated_by, updated_at=excluded.updated_at`)
      .bind(planningId, status, body.pickupAddress || "", body.deliveryAddress || "", body.eta || null, body.delayReason || "", body.recipientName || "", body.signatureName || "", startedAt, loadedAt, deliveredAt, user.id, now, now).run();
    if (status === "Problem" || body.delayReason)
      await env.DB.prepare("INSERT INTO notifications (role_scope, category, title, message, entity_type, entity_id, severity, created_at) VALUES ('dispatcher', 'trip', 'Einsatz benötigt Aufmerksamkeit', ?, 'planning', ?, 'urgent', ?)")
        .bind(`${plan.license_plate || "Ohne Kennzeichen"}: ${body.delayReason || "Problem gemeldet"}`, String(planningId), now).run();
    auditDetails = { oldValue, newValue: { planningId, status, pickupAddress: body.pickupAddress, deliveryAddress: body.deliveryAddress, eta: body.eta, delayReason: body.delayReason, recipientName: body.recipientName } };
  } else if (action === "updateVoiceMessageStatus" && ["management", "dispatcher"].includes(user.role)) {
    const id = Number(body.id || 0);
    const status = String(body.status || "");
    if (!id || !["Neu", "Abgehört", "Erledigt"].includes(status))
      return json({ error: "Ungültiger Nachrichtenstatus" }, 400);
    const oldValue = await env.DB.prepare("SELECT * FROM voice_messages WHERE id=?").bind(id).first<Record<string, string | number | null>>();
    if (!oldValue) return json({ error: "Sprachnachricht nicht gefunden" }, 404);
    await env.DB.prepare("UPDATE voice_messages SET status=?, listened_by=?, listened_at=? WHERE id=?")
      .bind(status, status === "Neu" ? null : user.id, status === "Neu" ? null : now, id).run();
    if (status === "Erledigt") {
      await env.DB.prepare("INSERT INTO notifications (user_id, category, title, message, entity_type, entity_id, severity, created_at) VALUES (?, 'voice', 'Sprachnachricht bearbeitet', 'Die Disposition hat Ihre Sprachnachricht bearbeitet.', 'voice_message', ?, 'info', ?)")
        .bind(oldValue.user_id, String(id), now).run();
    }
    auditDetails = { oldValue, newValue: { status, listenedBy: user.id, listenedAt: status === "Neu" ? null : now } };
  } else if (action === "updateExpenseStatus" && ["management", "accountant"].includes(user.role)) {
    const status = String(body.status || "");
    if (!["Eingereicht", "In Prüfung", "Freigegeben", "Zur Zahlung", "Erstattet", "Abgelehnt", "Exportiert"].includes(status))
      return json({ error: "Ungültiger Belegstatus" }, 400);
    const oldValue = await env.DB.prepare("SELECT * FROM expenses WHERE id=?").bind(body.id).first<Record<string, string | number | null>>();
    if (!oldValue) return json({ error: "Ausgabe nicht gefunden" }, 404);
    const grossAmount = Number(body.grossAmount ?? oldValue.gross_amount ?? 0);
    const vatAmount = Number(body.vatAmount ?? oldValue.vat_amount ?? 0);
    const reimbursable = String(body.reimbursable ?? oldValue.reimbursable ?? "0") === "1";
    const reimbursementAmount = reimbursable ? Number(body.reimbursementAmount ?? oldValue.reimbursement_amount ?? grossAmount) : 0;
    if (!Number.isFinite(grossAmount) || grossAmount <= 0 || !Number.isFinite(vatAmount) || vatAmount < 0 || vatAmount > grossAmount)
      return json({ error: "Brutto oder MwSt. ist ungültig" }, 400);
    if (!Number.isFinite(reimbursementAmount) || reimbursementAmount < 0 || reimbursementAmount > grossAmount)
      return json({ error: "Erstattungsbetrag muss zwischen 0 und Brutto liegen" }, 400);
    const reviewedAt = status === "Eingereicht" ? null : now;
    const paidAt = status === "Erstattet"
      ? String(body.paidAt || oldValue.paid_at || now)
      : status === "Exportiert"
        ? oldValue.paid_at
        : null;
    const recognitionStatus = status === "Eingereicht" ? String(body.recognitionStatus || oldValue.recognition_status || "Prüfen") : "Geprüft";
    await env.DB.prepare(`UPDATE expenses SET merchant=?, gross_amount=?, vat_amount=?, payment_method=?, reimbursable=?, reimbursement_amount=?, amazon_site=?, block_id=?, tour_reference=?, cost_center=?, receipt_number=?, status=?, recognition_status=?, payment_reference=?, reviewed_by=?, reviewed_at=?, paid_at=?, rejection_reason=?, notes=?, updated_at=? WHERE id=?`)
      .bind(body.merchant ?? oldValue.merchant ?? "", grossAmount, vatAmount, body.paymentMethod ?? oldValue.payment_method ?? "Privatauslage", reimbursable ? 1 : 0, reimbursementAmount, body.amazonSite ?? oldValue.amazon_site ?? "", body.blockId ?? oldValue.block_id ?? "", body.tourReference ?? oldValue.tour_reference ?? "", body.costCenter ?? oldValue.cost_center ?? "", body.receiptNumber ?? oldValue.receipt_number ?? "", status, recognitionStatus, body.paymentReference ?? oldValue.payment_reference ?? "", user.id, reviewedAt, paidAt, body.rejectionReason ?? oldValue.rejection_reason ?? "", body.notes ?? oldValue.notes ?? "", now, body.id).run();
    const staffUser = await env.DB.prepare("SELECT user_id FROM staff WHERE id=?").bind(oldValue.staff_id).first<{ user_id: number | null }>();
    if (staffUser?.user_id && ["Freigegeben", "Zur Zahlung", "Erstattet", "Abgelehnt"].includes(status)) {
      const messages: Record<string, string> = {
        Freigegeben: `Ihre Ausgabe über ${reimbursementAmount.toFixed(2)} € wurde freigegeben.`,
        "Zur Zahlung": `Ihre Erstattung über ${reimbursementAmount.toFixed(2)} € wurde zur Zahlung eingeplant.`,
        Erstattet: `Ihre Erstattung über ${reimbursementAmount.toFixed(2)} € wurde als bezahlt markiert.`,
        Abgelehnt: `Ihre Ausgabe wurde abgelehnt${body.rejectionReason ? `: ${body.rejectionReason}` : "."}`,
      };
      await env.DB.prepare("INSERT INTO notifications (user_id, category, title, message, entity_type, entity_id, severity, created_at) VALUES (?, 'expense', 'Status Ihrer Auslage', ?, 'expense', ?, ?, ?)")
        .bind(staffUser.user_id, messages[status], String(body.id), status === "Abgelehnt" ? "warning" : "info", now).run();
    }
    auditDetails = { oldValue, newValue: { status, grossAmount, vatAmount, reimbursable, reimbursementAmount, paymentReference: body.paymentReference, paidAt, rejectionReason: body.rejectionReason, amazonSite: body.amazonSite, blockId: body.blockId, costCenter: body.costCenter } };
  } else if (action === "saveChecklist" && ["management", "dispatcher", "driver"].includes(user.role)) {
    let staffId = Number(body.staffId || 0);
    if (user.role === "driver") {
      const own = await env.DB.prepare("SELECT id FROM staff WHERE user_id=? AND status='active'").bind(user.id).first<{ id: number }>();
      staffId = own?.id || 0;
    }
    const licensePlate = String(body.licensePlate || "");
    if (!staffId || !licensePlate || !["Vor Fahrt", "Nach Fahrt"].includes(String(body.phase)))
      return json({ error: "Fahrer, Kennzeichen und Phase sind erforderlich" }, 400);
    if (user.role === "driver") {
      const assigned = await env.DB.prepare("SELECT 1 FROM weekly_planning WHERE staff_id=? AND license_plate=? LIMIT 1").bind(staffId, licensePlate).first();
      if (!assigned) return json({ error: "Fahrzeug ist Ihnen nicht zugeteilt" }, 403);
    }
    let checks: Record<string, boolean> = {};
    try { checks = JSON.parse(String(body.checksJson || "{}")) as Record<string, boolean>; } catch { return json({ error: "Checkliste ist ungültig" }, 400); }
    const status = Object.values(checks).every(Boolean) && !String(body.damageNotes || "").trim() ? "OK" : "Mangel";
    const result = await env.DB.prepare("INSERT INTO vehicle_checklists (staff_id, planning_id, license_plate, phase, checks_json, damage_notes, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(staffId, body.planningId || null, licensePlate, body.phase, JSON.stringify(checks), body.damageNotes || "", status, now).run();
    if (status === "Mangel")
      await env.DB.prepare("INSERT INTO notifications (role_scope, category, title, message, entity_type, entity_id, severity, created_at) VALUES ('dispatcher', 'checklist', 'Fahrzeugmangel gemeldet', ?, 'checklist', ?, 'urgent', ?)")
        .bind(`${licensePlate}: ${body.damageNotes || "Checkliste nicht vollständig"}`, String(result.meta.last_row_id), now).run();
    auditDetails = { oldValue: null, newValue: { staffId, licensePlate, phase: body.phase, status, checks, damageNotes: body.damageNotes } };
  } else if (action === "markNotificationRead") {
    if (user.role === "management")
      await env.DB.prepare("UPDATE notifications SET read_at=? WHERE id=?").bind(now, body.id).run();
    else
      await env.DB.prepare("UPDATE notifications SET read_at=? WHERE id=? AND (user_id=? OR role_scope=? OR role_scope='all')")
        .bind(now, body.id, user.id, user.role).run();
    auditDetails = { oldValue: null, newValue: { notificationId: body.id, readAt: now } };
  } else if (action === "addStaff" && user.role === "management") {
    let userId: number | null = null;
    if (body.loginEmail && body.loginPassword) {
      const created = await env.DB.prepare(
        "INSERT INTO users (email, full_name, role, password_hash, must_change_password, active) VALUES (?, ?, 'driver', ?, 1, 1)",
      )
        .bind(
          String(body.loginEmail).toLowerCase(),
          body.fullName,
          await hashPassword(String(body.loginPassword)),
        )
        .run();
      userId = Number(created.meta.last_row_id);
    }
    await env.DB.prepare(
      "INSERT INTO staff (user_id, full_name, system_type, compensation, location, company, vacation, status, hired_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)",
    )
      .bind(
        userId,
        body.fullName,
        body.systemType || "2/1",
        body.compensation || "",
        body.location || "",
        body.company || "",
        body.vacation || "",
        String(body.hiredAt || now.slice(0, 10)),
        now,
        now,
      )
      .run();
  } else if (action === "archiveStaff" && user.role === "management") {
    const oldValue = await env.DB.prepare("SELECT * FROM staff WHERE id=?")
      .bind(body.id)
      .first();
    await env.DB.prepare(
      "UPDATE staff SET status='archived', terminated_at=?, updated_at=? WHERE id=?",
    )
      .bind(String(body.terminatedAt || now.slice(0, 10)), now, body.id)
      .run();
    await env.DB.prepare("UPDATE users SET active=0 WHERE id=(SELECT user_id FROM staff WHERE id=?)").bind(body.id).run();
    auditDetails = {
      oldValue,
      newValue: {
        status: "archived",
        terminatedAt: String(body.terminatedAt || now.slice(0, 10)),
      },
    };
  } else if (action === "restoreStaff" && user.role === "management") {
    await env.DB.prepare(
      "UPDATE staff SET status='active', terminated_at=NULL, updated_at=? WHERE id=?",
    )
      .bind(now, body.id)
      .run();
    await env.DB.prepare("UPDATE users SET active=1 WHERE id=(SELECT user_id FROM staff WHERE id=?)").bind(body.id).run();
  } else if (action === "updateStaff" && user.role === "management") {
    const oldValue = await env.DB.prepare("SELECT * FROM staff WHERE id=?")
      .bind(body.id)
      .first();
    await env.DB.prepare(
      "UPDATE staff SET full_name=?, system_type=?, compensation=?, location=?, company=?, vacation=?, updated_at=? WHERE id=?",
    )
      .bind(
        body.fullName,
        body.systemType || "",
        body.compensation || "",
        body.location || "",
        body.company || "",
        body.vacation || "",
        now,
        body.id,
      )
      .run();
    if (body.loginEmail && body.loginPassword) {
      const current = await env.DB.prepare(
        "SELECT user_id FROM staff WHERE id=?",
      )
        .bind(body.id)
        .first<{ user_id: number | null }>();
      const passwordHash = await hashPassword(String(body.loginPassword));
      if (current?.user_id)
        await env.DB.prepare(
          "UPDATE users SET email=?, full_name=?, password_hash=?, active=1, must_change_password=1 WHERE id=?",
        )
          .bind(
            String(body.loginEmail).toLowerCase(),
            body.fullName,
            passwordHash,
            current.user_id,
          )
          .run();
      else {
        const created = await env.DB.prepare(
          "INSERT INTO users (email, full_name, role, password_hash, must_change_password, active) VALUES (?, ?, 'driver', ?, 1, 1)",
        )
          .bind(
            String(body.loginEmail).toLowerCase(),
            body.fullName,
            passwordHash,
          )
          .run();
        await env.DB.prepare("UPDATE staff SET user_id=? WHERE id=?")
          .bind(Number(created.meta.last_row_id), body.id)
          .run();
      }
    }
    auditDetails = {
      oldValue,
      newValue: {
        fullName: body.fullName,
        systemType: body.systemType,
        compensation: body.compensation,
        location: body.location,
        company: body.company,
      },
    };
  } else if (action === "deleteStaff" && user.role === "management") {
    const oldValue = await env.DB.prepare("SELECT * FROM staff WHERE id=?")
      .bind(body.id)
      .first();
    const linked = await env.DB.prepare(
      "SELECT (SELECT COUNT(*) FROM salary_documents WHERE staff_id=?) + (SELECT COUNT(*) FROM weekly_planning WHERE staff_id=?) AS count",
    )
      .bind(body.id, body.id)
      .first<{ count: number }>();
    if (linked?.count)
      return json(
        { error: "Mitarbeiter hat Historie und kann nur archiviert werden" },
        409,
      );
    await env.DB.prepare("DELETE FROM staff WHERE id=? AND status='archived'")
      .bind(body.id)
      .run();
    auditDetails = { oldValue, newValue: null };
  } else if (
    action === "addVehicle" &&
    ["management", "dispatcher"].includes(user.role)
  ) {
    await env.DB.prepare(
      "INSERT INTO vehicles (license_plate, company, location, status, inspection_due, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(
        body.licensePlate,
        body.company || "",
        body.location || "",
        body.status || "active",
        body.inspectionDue || null,
        body.notes || "",
        now,
        now,
      )
      .run();
  } else if (
    action === "addPlanning" &&
    ["management", "dispatcher"].includes(user.role)
  ) {
    if (!String(body.workDays || "").trim())
      return json({ error: "Mindestens einen Einsatztag auswählen" }, 400);
    const workDays = normalizeDays(body.workDays);
    const assigned = body.driverName
      ? await env.DB.prepare(
          "SELECT id FROM staff WHERE full_name=? AND status='active'",
        )
          .bind(body.driverName)
          .first<{ id: number }>()
      : null;
    if (body.driverName && !assigned)
      return json({ error: "Fahrer ist ausgeschieden oder nicht aktiv" }, 409);
    const selectedVehicle = body.licensePlate
      ? await env.DB.prepare(
          "SELECT status, inspection_due FROM vehicles WHERE license_plate=?",
        )
          .bind(body.licensePlate)
          .first<{ status: string; inspection_due: string | null }>()
      : null;
    if (selectedVehicle?.status === "workshop")
      return json({ error: "Fahrzeug befindet sich in der Werkstatt" }, 409);
    const possibleConflicts = await env.DB.prepare(
      "SELECT driver_name, license_plate, work_days, start_time FROM weekly_planning WHERE planning_year=? AND calendar_week=? AND ((staff_id IS NOT NULL AND staff_id=?) OR (license_plate!='' AND license_plate=?))",
    )
      .bind(
        body.planningYear,
        body.calendarWeek,
        assigned?.id || -1,
        body.licensePlate || "",
      )
      .all<{
        driver_name: string;
        license_plate: string;
        work_days: string;
        start_time: string;
      }>();
    const startTime = String(body.startTime || "06:00");
    const conflict = possibleConflicts.results.find(
      (entry) =>
        daySetsOverlap(workDays, normalizeDays(entry.work_days)) &&
        (!entry.start_time || entry.start_time === startTime),
    );
    if (conflict)
      return json(
        {
          error: `Konflikt: Fahrer oder Fahrzeug ist in dieser KW bereits eingeplant (${conflict.driver_name} / ${conflict.license_plate})`,
        },
        409,
      );
    const createdPlan = await env.DB.prepare(
      "INSERT INTO weekly_planning (planning_year, calendar_week, company, staff_id, driver_name, location, license_plate, work_days, start_time, block_id, status, comments, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(
        body.planningYear,
        body.calendarWeek,
        body.company,
        assigned?.id || null,
        body.driverName || "",
        body.location || "",
        body.licensePlate || "",
        workDays,
        startTime,
        body.blockId || "",
        body.status || "planned",
        body.comments || "",
        now,
        now,
      )
      .run();
    await env.DB.prepare("INSERT INTO trip_operations (planning_id, status, pickup_address, delivery_address, eta, delay_reason, recipient_name, signature_name, updated_by, created_at, updated_at) VALUES (?, 'Geplant', ?, '', NULL, '', '', '', ?, ?, ?)")
      .bind(Number(createdPlan.meta.last_row_id), body.location || "", user.id, now, now).run();
  } else if (
    action === "updatePlanning" &&
    ["management", "dispatcher"].includes(user.role)
  ) {
    if (!String(body.workDays || "").trim())
      return json({ error: "Mindestens einen Einsatztag auswählen" }, 400);
    const workDays = normalizeDays(body.workDays);
    const assigned = body.driverName
      ? await env.DB.prepare(
          "SELECT id FROM staff WHERE full_name=? AND status='active'",
        )
          .bind(body.driverName)
          .first<{ id: number }>()
      : null;
    if (body.driverName && !assigned)
      return json({ error: "Fahrer ist ausgeschieden oder nicht aktiv" }, 409);
    const selectedVehicle = body.licensePlate
      ? await env.DB.prepare(
          "SELECT status FROM vehicles WHERE license_plate=?",
        )
          .bind(body.licensePlate)
          .first<{ status: string }>()
      : null;
    if (selectedVehicle?.status === "workshop")
      return json({ error: "Fahrzeug befindet sich in der Werkstatt" }, 409);
    const oldValue = await env.DB.prepare(
      "SELECT * FROM weekly_planning WHERE id=?",
    )
      .bind(body.id)
      .first();
    const possibleConflicts = await env.DB.prepare(
      "SELECT id, work_days, start_time FROM weekly_planning WHERE planning_year=? AND calendar_week=? AND id!=? AND ((staff_id IS NOT NULL AND staff_id=?) OR (license_plate!='' AND license_plate=?))",
    )
      .bind(
        body.planningYear,
        body.calendarWeek,
        body.id,
        assigned?.id || -1,
        body.licensePlate || "",
      )
      .all<{ id: number; work_days: string; start_time: string }>();
    const startTime = String(body.startTime || "06:00");
    const conflict = possibleConflicts.results.find(
      (entry) =>
        daySetsOverlap(workDays, normalizeDays(entry.work_days)) &&
        (!entry.start_time || entry.start_time === startTime),
    );
    if (conflict)
      return json(
        { error: "Konflikt: Fahrer oder Fahrzeug ist bereits eingeplant" },
        409,
      );
    await env.DB.prepare(
      "UPDATE weekly_planning SET company=?, staff_id=?, driver_name=?, location=?, license_plate=?, work_days=?, start_time=?, block_id=?, status=?, comments=?, updated_at=? WHERE id=?",
    )
      .bind(
        body.company,
        assigned?.id || null,
        body.driverName || "",
        body.location || "",
        body.licensePlate || "",
        workDays,
        startTime,
        body.blockId || "",
        body.status || "planned",
        body.comments || "",
        now,
        body.id,
      )
      .run();
    auditDetails = {
      oldValue,
      newValue: {
        company: body.company,
        driverName: body.driverName,
        licensePlate: body.licensePlate,
        workDays,
        startTime,
        blockId: body.blockId,
        status: body.status,
        comments: body.comments,
      },
    };
  } else if (
    action === "deletePlanning" &&
    ["management", "dispatcher"].includes(user.role)
  ) {
    const oldValue = await env.DB.prepare(
      "SELECT * FROM weekly_planning WHERE id=?",
    )
      .bind(body.id)
      .first();
    const operation = await env.DB.prepare("SELECT id FROM trip_operations WHERE planning_id=?").bind(body.id).first<{ id: number }>();
    if (operation) {
      const documents = await env.DB.prepare("SELECT COUNT(*) AS count FROM trip_documents WHERE trip_operation_id=?").bind(operation.id).first<{ count: number }>();
      if (documents?.count) return json({ error: "Einsatz hat CMR/Fotos und kann nur archiviert werden" }, 409);
      await env.DB.prepare("DELETE FROM trip_operations WHERE id=?").bind(operation.id).run();
    }
    await env.DB.prepare("DELETE FROM weekly_planning WHERE id=?")
      .bind(body.id)
      .run();
    auditDetails = { oldValue, newValue: null };
  } else if (
    action === "copyPreviousWeek" &&
    ["management", "dispatcher"].includes(user.role)
  ) {
    const targetYear = Number(body.planningYear);
    const targetWeek = Number(body.calendarWeek);
    const sourceYear = targetWeek === 1 ? targetYear - 1 : targetYear;
    const sourceWeek = targetWeek === 1 ? 53 : targetWeek - 1;
    const existing = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM weekly_planning WHERE planning_year=? AND calendar_week=?",
    )
      .bind(targetYear, targetWeek)
      .first<{ count: number }>();
    if (existing?.count)
      return json({ error: "Für diese Woche existiert bereits ein Plan" }, 409);
    await env.DB.prepare(
      `INSERT INTO weekly_planning (planning_year, calendar_week, company, staff_id, driver_name, location, license_plate, work_days, start_time, block_id, status, comments, created_at, updated_at)
      SELECT ?, ?, company, staff_id, driver_name, location, license_plate, work_days, start_time, block_id, 'planned', comments, ?, ? FROM weekly_planning WHERE planning_year=? AND calendar_week=?`,
    )
      .bind(targetYear, targetWeek, now, now, sourceYear, sourceWeek)
      .run();
    const copiedPlans = await env.DB.prepare("SELECT id, location FROM weekly_planning WHERE planning_year=? AND calendar_week=?").bind(targetYear, targetWeek).all<{ id: number; location: string | null }>();
    if (copiedPlans.results.length)
      await env.DB.batch(copiedPlans.results.map((plan) => env.DB.prepare("INSERT OR IGNORE INTO trip_operations (planning_id, status, pickup_address, delivery_address, eta, delay_reason, recipient_name, signature_name, updated_by, created_at, updated_at) VALUES (?, 'Geplant', ?, '', NULL, '', '', '', ?, ?, ?)").bind(plan.id, plan.location || "", user.id, now, now)));
  } else if (action === "driverConcern" && user.role === "driver") {
    const person = await env.DB.prepare(
      "SELECT id, full_name, company, location FROM staff WHERE user_id=? AND status='active'",
    )
      .bind(user.id)
      .first<{
        id: number;
        full_name: string;
        company: string;
        location: string;
      }>();
    if (!person) return json({ error: "Fahrerprofil nicht verknüpft" }, 409);
    const assignment = await env.DB.prepare(
      "SELECT license_plate FROM weekly_planning WHERE planning_year=? AND calendar_week=? AND (staff_id=? OR driver_name=?) ORDER BY id DESC LIMIT 1",
    )
      .bind(body.planningYear, body.calendarWeek, person.id, person.full_name)
      .first<{ license_plate: string }>();
    const concern = await env.DB.prepare(
      "INSERT INTO driver_concerns (staff_id, period, company, base, truck_number, item_name, purchase_status, completion_status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'Angefragt', 'Neu', ?, ?, ?)",
    )
      .bind(
        person.id,
        now.slice(0, 7),
        person.company || "",
        person.location || "",
        assignment?.license_plate || String(body.truckNumber || ""),
        body.itemName,
        person.full_name,
        now,
        now,
      )
      .run();
    await env.DB.prepare("INSERT INTO notifications (role_scope, category, title, message, entity_type, entity_id, severity, created_at) VALUES ('dispatcher', 'concern', 'Neues Fahreranliegen', ?, 'concern', ?, 'urgent', ?)")
      .bind(`${person.full_name} · ${assignment?.license_plate || body.truckNumber || "ohne Kennzeichen"}: ${body.itemName}`, String(concern.meta.last_row_id), now).run();
  } else if (
    action === "addConcern" &&
    ["management", "dispatcher"].includes(user.role)
  ) {
    await env.DB.prepare(
      "INSERT INTO driver_concerns (period, company, base, truck_number, item_name, purchase_status, completion_status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(
        body.period,
        body.company,
        body.base || "",
        body.truckNumber || "",
        body.itemName,
        body.purchaseStatus || "",
        body.completionStatus || "Neu",
        body.notes || "",
        now,
        now,
      )
      .run();
    auditDetails = {
      oldValue: null,
      newValue: {
        period: body.period,
        company: body.company,
        truckNumber: body.truckNumber,
        itemName: body.itemName,
        purchaseStatus: body.purchaseStatus,
        completionStatus: body.completionStatus || "Neu",
        notes: body.notes,
      },
    };
  } else if (
    action === "updateConcern" &&
    ["management", "dispatcher"].includes(user.role)
  ) {
    const oldValue = await env.DB.prepare(
      "SELECT * FROM driver_concerns WHERE id=?",
    )
      .bind(body.id)
      .first();
    await env.DB.prepare(
      "UPDATE driver_concerns SET period=?, company=?, base=?, truck_number=?, item_name=?, purchase_status=?, completion_status=?, notes=?, updated_at=? WHERE id=?",
    )
      .bind(
        body.period,
        body.company,
        body.base || "",
        body.truckNumber || "",
        body.itemName,
        body.purchaseStatus || "",
        body.completionStatus || "Neu",
        body.notes || "",
        now,
        body.id,
      )
      .run();
    auditDetails = {
      oldValue,
      newValue: {
        period: body.period,
        company: body.company,
        truckNumber: body.truckNumber,
        itemName: body.itemName,
        purchaseStatus: body.purchaseStatus,
        completionStatus: body.completionStatus || "Neu",
        notes: body.notes,
      },
    };
  } else if (
    action === "deleteConcern" &&
    ["management", "dispatcher"].includes(user.role)
  ) {
    await env.DB.prepare("DELETE FROM driver_concerns WHERE id=?")
      .bind(body.id)
      .run();
  } else if (
    action === "savePayroll" &&
    ["management", "accountant"].includes(user.role)
  ) {
    const staffId = Number(body.staffId);
    const period = String(body.period || "");
    if (!staffId || !/^\d{4}-\d{2}$/.test(period)) return json({ error: "Mitarbeiter und Monat sind erforderlich" }, 400);
    const baseSalary = Number(body.baseSalary || 0);
    const tourCount = Number(body.tourCount || 0);
    const bonuses = Number(body.bonuses || 0);
    const expenses = Number(body.expenses || 0);
    const deductions = Number(body.deductions || 0);
    const netAmount = Math.round((baseSalary + bonuses + expenses - deductions) * 100) / 100;
    const paymentStatus = String(body.paymentStatus || "draft");
    if (!["draft", "review", "approved", "paid"].includes(paymentStatus)) return json({ error: "Ungültiger Zahlungsstatus" }, 400);
    const oldValue = await env.DB.prepare("SELECT * FROM payroll_calculations WHERE staff_id=? AND period=?").bind(staffId, period).first<Record<string, unknown>>();
    if (oldValue?.locked_at && user.role !== "management") return json({ error: "Freigegebene Abrechnung ist gesperrt" }, 409);
    await env.DB.prepare(`INSERT INTO payroll_calculations (staff_id, period, base_salary, tour_count, bonuses, expenses, deductions, net_amount, payment_status, locked_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(staff_id, period) DO UPDATE SET base_salary=excluded.base_salary, tour_count=excluded.tour_count, bonuses=excluded.bonuses, expenses=excluded.expenses, deductions=excluded.deductions, net_amount=excluded.net_amount, payment_status=excluded.payment_status, locked_at=excluded.locked_at, updated_at=excluded.updated_at`)
      .bind(staffId, period, baseSalary, tourCount, bonuses, expenses, deductions, netAmount, paymentStatus, ["approved", "paid"].includes(paymentStatus) ? now : null, now, now).run();
    auditDetails = { oldValue, newValue: { staffId, period, baseSalary, tourCount, bonuses, expenses, deductions, netAmount, paymentStatus } };
  } else if (
    action === "addMaintenance" &&
    ["management", "dispatcher"].includes(user.role)
  ) {
    if (!body.licensePlate || !body.description) return json({ error: "Kennzeichen und Beschreibung sind erforderlich" }, 400);
    await env.DB.prepare("INSERT INTO vehicle_maintenance (license_plate, category, description, cost, status, responsible, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(body.licensePlate, body.category || "Wartung", body.description, Number(body.cost || 0), body.status || "Gemeldet", body.responsible || "", body.dueDate || null, now, now).run();
  } else if (
    action === "updateMaintenance" &&
    ["management", "dispatcher"].includes(user.role)
  ) {
    const oldValue = await env.DB.prepare("SELECT * FROM vehicle_maintenance WHERE id=?").bind(body.id).first();
    await env.DB.prepare("UPDATE vehicle_maintenance SET category=?, description=?, cost=?, status=?, responsible=?, due_date=?, updated_at=? WHERE id=?").bind(body.category, body.description, Number(body.cost || 0), body.status, body.responsible || "", body.dueDate || null, now, body.id).run();
    if (body.status === "Werkstatt") await env.DB.prepare("UPDATE vehicles SET status='workshop', updated_at=? WHERE license_plate=(SELECT license_plate FROM vehicle_maintenance WHERE id=?)").bind(now, body.id).run();
    if (body.status === "Freigegeben") await env.DB.prepare("UPDATE vehicles SET status='active', updated_at=? WHERE license_plate=(SELECT license_plate FROM vehicle_maintenance WHERE id=?)").bind(now, body.id).run();
    auditDetails = { oldValue, newValue: { category: body.category, description: body.description, cost: body.cost, status: body.status, responsible: body.responsible, dueDate: body.dueDate } };
  } else if (
    action === "saveTracker" &&
    ["management", "dispatcher"].includes(user.role)
  ) {
    const licensePlate = String(body.licensePlate || "").trim();
    const deviceId = String(body.deviceId || "").trim();
    const provider = String(body.provider || "Andere").trim();
    if (!licensePlate || !deviceId)
      return json({ error: "Kennzeichen und Geräte-ID sind erforderlich" }, 400);
    const vehicle = await env.DB.prepare("SELECT id FROM vehicles WHERE license_plate=?")
      .bind(licensePlate)
      .first();
    if (!vehicle) return json({ error: "Fahrzeug ist nicht im Fahrzeugstamm" }, 404);
    const duplicate = await env.DB.prepare("SELECT license_plate FROM truck_trackers WHERE device_id=? AND license_plate!=?")
      .bind(deviceId, licensePlate)
      .first<{ license_plate: string }>();
    if (duplicate)
      return json({ error: `Geräte-ID ist bereits ${duplicate.license_plate} zugeordnet` }, 409);
    const oldValue = await env.DB.prepare("SELECT * FROM truck_trackers WHERE license_plate=?")
      .bind(licensePlate)
      .first();
    await env.DB.prepare(`INSERT INTO truck_trackers (license_plate, device_id, provider, enabled, created_at, updated_at)
      VALUES (?, ?, ?, 1, ?, ?)
      ON CONFLICT(license_plate) DO UPDATE SET device_id=excluded.device_id, provider=excluded.provider, enabled=1, updated_at=excluded.updated_at`)
      .bind(licensePlate, deviceId, provider, now, now)
      .run();
    auditDetails = { oldValue, newValue: { licensePlate, deviceId, provider, enabled: true } };
  } else if (
    action === "addManualPosition" &&
    ["management", "dispatcher"].includes(user.role)
  ) {
    const licensePlate = String(body.licensePlate || "").trim();
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    const speedKph = Number(body.speedKph || 0);
    if (!licensePlate || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180)
      return json({ error: "Gültiges Kennzeichen sowie GPS-Breite und GPS-Länge eingeben" }, 400);
    if (!Number.isFinite(speedKph) || speedKph < 0 || speedKph > 250)
      return json({ error: "Geschwindigkeit muss zwischen 0 und 250 km/h liegen" }, 400);
    const tracker = await env.DB.prepare("SELECT id FROM truck_trackers WHERE license_plate=? AND enabled=1")
      .bind(licensePlate)
      .first<{ id: number }>();
    if (!tracker) return json({ error: "Zuerst einen Tracker mit dem Fahrzeug verbinden" }, 409);
    await env.DB.prepare("INSERT INTO truck_positions (tracker_id, license_plate, latitude, longitude, speed_kph, heading, ignition, odometer_km, address, source, recorded_at, received_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?)")
      .bind(tracker.id, licensePlate, latitude, longitude, speedKph, body.heading == null ? null : Number(body.heading), String(body.ignition || "") === "true" || String(body.ignition || "") === "on" ? 1 : 0, body.odometerKm == null || body.odometerKm === "" ? null : Number(body.odometerKm), body.address || "", now, now)
      .run();
    await env.DB.prepare("UPDATE truck_trackers SET last_connected_at=?, updated_at=? WHERE id=?")
      .bind(now, now, tracker.id)
      .run();
    auditDetails = { oldValue: null, newValue: { licensePlate, latitude, longitude, speedKph, source: "manual" } };
  } else if (action === "resolveResetRequest" && user.role === "management") {
    await env.DB.prepare("UPDATE password_reset_requests SET status='resolved', resolved_at=? WHERE id=?").bind(now, body.id).run();
  } else
    return json({ error: "Keine Berechtigung oder unbekannte Aktion" }, 403);
  await env.DB.prepare(
    "INSERT INTO audit_log (user_id, action, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(
      user.id,
      action,
      String(body.id || ""),
      JSON.stringify({
        role: user.role,
        year: body.planningYear,
        week: body.calendarWeek,
        ...auditDetails,
      }),
      now,
    )
    .run();
  return json({ ok: true });
}
