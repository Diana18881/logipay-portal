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
  return json({
    user,
    year,
    kw,
    staff: staffResult.results,
    vehicles: vehicles.results,
    planning: planning.results,
    documents,
    concerns: concerns.results,
    files: files.results,
  });
}

export async function POST(request: Request) {
  const user = await requirePortalUser();
  await ensureDomainDatabase();
  const body = (await request.json()) as Record<string, string | number | null>;
  const action = String(body.action || "");
  const now = new Date().toISOString();
  if (action === "addStaff" && user.role === "management") {
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
    await env.DB.prepare(
      "UPDATE staff SET status='archived', terminated_at=?, updated_at=? WHERE id=?",
    )
      .bind(String(body.terminatedAt || now.slice(0, 10)), now, body.id)
      .run();
  } else if (action === "restoreStaff" && user.role === "management") {
    await env.DB.prepare(
      "UPDATE staff SET status='active', terminated_at=NULL, updated_at=? WHERE id=?",
    )
      .bind(now, body.id)
      .run();
  } else if (action === "updateStaff" && user.role === "management") {
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
  } else if (action === "deleteStaff" && user.role === "management") {
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
  } else if (
    action === "addVehicle" &&
    ["management", "dispatcher"].includes(user.role)
  ) {
    await env.DB.prepare(
      "INSERT INTO vehicles (license_plate, company, location, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(
        body.licensePlate,
        body.company || "",
        body.location || "",
        body.status || "active",
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
    const possibleConflicts = await env.DB.prepare(
      "SELECT driver_name, license_plate, work_days FROM weekly_planning WHERE planning_year=? AND calendar_week=? AND ((staff_id IS NOT NULL AND staff_id=?) OR (license_plate!='' AND license_plate=?))",
    )
      .bind(
        body.planningYear,
        body.calendarWeek,
        assigned?.id || -1,
        body.licensePlate || "",
      )
      .all<{ driver_name: string; license_plate: string; work_days: string }>();
    const conflict = possibleConflicts.results.find((entry) =>
      daySetsOverlap(workDays, normalizeDays(entry.work_days)),
    );
    if (conflict)
      return json(
        {
          error: `Konflikt: Fahrer oder Fahrzeug ist in dieser KW bereits eingeplant (${conflict.driver_name} / ${conflict.license_plate})`,
        },
        409,
      );
    await env.DB.prepare(
      "INSERT INTO weekly_planning (planning_year, calendar_week, company, staff_id, driver_name, location, license_plate, work_days, block_id, status, comments, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
        body.blockId || "",
        body.status || "planned",
        body.comments || "",
        now,
        now,
      )
      .run();
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
    const possibleConflicts = await env.DB.prepare(
      "SELECT id, work_days FROM weekly_planning WHERE planning_year=? AND calendar_week=? AND id!=? AND ((staff_id IS NOT NULL AND staff_id=?) OR (license_plate!='' AND license_plate=?))",
    )
      .bind(
        body.planningYear,
        body.calendarWeek,
        body.id,
        assigned?.id || -1,
        body.licensePlate || "",
      )
      .all<{ id: number; work_days: string }>();
    const conflict = possibleConflicts.results.find((entry) =>
      daySetsOverlap(workDays, normalizeDays(entry.work_days)),
    );
    if (conflict)
      return json(
        { error: "Konflikt: Fahrer oder Fahrzeug ist bereits eingeplant" },
        409,
      );
    await env.DB.prepare(
      "UPDATE weekly_planning SET company=?, staff_id=?, driver_name=?, location=?, license_plate=?, work_days=?, block_id=?, status=?, comments=?, updated_at=? WHERE id=?",
    )
      .bind(
        body.company,
        assigned?.id || null,
        body.driverName || "",
        body.location || "",
        body.licensePlate || "",
        workDays,
        body.blockId || "",
        body.status || "planned",
        body.comments || "",
        now,
        body.id,
      )
      .run();
  } else if (
    action === "deletePlanning" &&
    ["management", "dispatcher"].includes(user.role)
  ) {
    await env.DB.prepare("DELETE FROM weekly_planning WHERE id=?")
      .bind(body.id)
      .run();
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
      `INSERT INTO weekly_planning (planning_year, calendar_week, company, staff_id, driver_name, location, license_plate, work_days, block_id, status, comments, created_at, updated_at)
      SELECT ?, ?, company, staff_id, driver_name, location, license_plate, work_days, block_id, 'planned', comments, ?, ? FROM weekly_planning WHERE planning_year=? AND calendar_week=?`,
    )
      .bind(targetYear, targetWeek, now, now, sourceYear, sourceWeek)
      .run();
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
    await env.DB.prepare(
      "INSERT INTO driver_concerns (staff_id, period, company, base, truck_number, item_name, purchase_status, completion_status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'Requested', 'New', ?, ?, ?)",
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
        body.completionStatus || "Not delivered",
        body.notes || "",
        now,
        now,
      )
      .run();
  } else if (
    action === "updateConcern" &&
    ["management", "dispatcher"].includes(user.role)
  ) {
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
        body.completionStatus || "Not delivered",
        body.notes || "",
        now,
        body.id,
      )
      .run();
  } else if (
    action === "deleteConcern" &&
    ["management", "dispatcher"].includes(user.role)
  ) {
    await env.DB.prepare("DELETE FROM driver_concerns WHERE id=?")
      .bind(body.id)
      .run();
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
      }),
      now,
    )
    .run();
  return json({ ok: true });
}
