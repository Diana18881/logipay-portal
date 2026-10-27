import { env } from "@logipay/env";

// Fictional sample data for the public demo company. Real companies start with an empty portal.

const company = "Muster Transporte";

const staff = [
  ["Marek Nowak", "2/1", "2400 € Netto", "Hamburg", ""],
  ["Tomasz Zieliński", "2/1", "2300 € Netto", "Hamburg", ""],
  ["Andrei Popescu", "5/2", "2500 € Netto", "Bremen", ""],
  ["Lukas Hoffmann", "5/2", "2600 € Netto", "Hannover", ""],
  ["Oleksandr Bondar", "Springer", "2800 € Netto", "Alle", ""],
  ["Piotr Lewandowski", "2/2", "2100 € Netto", "Bremen", "03.11–14.11"],
  ["Mehmet Yılmaz", "5/2", "2500 € Netto", "Hannover", ""],
  ["Ivan Petrenko", "Springer", "2800 € Netto", "Alle", ""],
] as const;

const vehicles = [
  ["HH-MT 101", "Hamburg", "active", ""],
  ["HH-MT 102", "Hamburg", "active", ""],
  ["HB-MT 201", "Bremen", "active", ""],
  ["H-MT 301", "Hannover", "workshop", "Werkstatt: Bremsen prüfen"],
  ["HH-MT 103", "Hamburg", "reserve", "Ersatzfahrzeug"],
] as const;

// [plate, latitude, longitude, speed, heading, ignition, odometer, place, minutes ago]
const positions = [
  ["HH-MT 101", 53.5511, 9.9937, 74, 210, 1, 312480, "A1 bei Hamburg-Harburg", 2],
  ["HH-MT 102", 53.0793, 8.8017, 0, 0, 0, 198220, "Bremen, Kundenhof", 9],
  ["HB-MT 201", 52.6367, 9.8451, 88, 160, 1, 254901, "A7 bei Schwarmstedt", 1],
  ["H-MT 301", 52.3759, 9.732, 0, 0, 0, 401377, "Hannover · Werkstatt", 45],
] as const;

function isoWeek(date: Date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return { year: target.getUTCFullYear(), week: Math.ceil(((target.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7) };
}

/** Six months of fictional history so the demo dashboard shows real-looking charts. */
export async function seedDemoHistory() {
  const existing = await env.DB.prepare("SELECT COUNT(*) AS count FROM payroll_calculations").first<{ count: number }>();
  if (Number(existing?.count || 0) > 0) return;
  const people = await env.DB.prepare("SELECT id, compensation FROM staff WHERE status='active' ORDER BY id").all<{ id: number; compensation: string }>();
  if (!people.results.length) return;
  const now = new Date();
  const stamp = now.toISOString();
  const statements = [];
  for (let back = 5; back >= 0; back--) {
    const month = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const period = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
    for (const [index, person] of people.results.entries()) {
      const base = Number(String(person.compensation).match(/\d{4}/)?.[0] || 2400);
      const extra = ((index * 37 + back * 53) % 9) * 25;
      const night = ((index + back) % 3) * 60;
      const total = base + extra + night;
      if (back > 0) statements.push(env.DB.prepare(
        "INSERT OR IGNORE INTO payroll_calculations (staff_id, period, base_salary, tour_count, bonuses, expenses, night_bonus, sunday_bonus, holiday_bonus, reimbursements, deductions, net_amount, payment_status, calculation_details, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, ?, 'paid', '{\"source\":\"demo\"}', ?, ?)",
      ).bind(person.id, period, base, 20 + (index % 3), extra, 0, night, total, stamp, stamp));
      if (index < 5) {
        const day = String(3 + ((index * 5 + back * 3) % 24)).padStart(2, "0");
        const amount = 140 + ((index * 61 + back * 97) % 260) + 0.4;
        statements.push(env.DB.prepare(
          "INSERT INTO expenses (staff_id, license_plate, expense_date, category, merchant, gross_amount, vat_amount, status, recognition_status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Geprüft', 'Demo-Beleg', ?, ?)",
        ).bind(person.id, ["HH-MT 101", "HH-MT 102", "HB-MT 201", "H-MT 301", "HH-MT 103"][index], `${period}-${day}`, index % 2 ? "Parken" : "Diesel", index % 2 ? "Parkhaus" : "Tankstelle", amount, Math.round(amount * 0.16 * 100) / 100, back === 0 ? "Eingereicht" : "Erstattet", stamp, stamp));
      }
    }
  }
  const soon = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString().slice(0, 10);
  const docs = [[0, "Fahrerkarte", 18], [2, "Führerschein", 41], [4, "Code 95", 9]] as const;
  for (const [index, category, days] of docs) {
    const person = people.results[index];
    if (person) statements.push(env.DB.prepare(
      "INSERT OR IGNORE INTO employee_documents (staff_id, category, file_name, object_key, content_type, size_bytes, expires_at, uploaded_by, created_at) VALUES (?, ?, ?, ?, 'application/pdf', 0, ?, 1, ?)",
    ).bind(person.id, category, `${category}.pdf`, `demo/${person.id}/${category}`, soon(days), stamp));
  }
  if (statements.length) await env.DB.batch(statements);
}

export async function seedDemoCompany() {
  const existing = await env.DB.prepare("SELECT COUNT(*) AS count FROM staff").first<{ count: number }>();
  if (Number(existing?.count || 0) > 0) return;
  const now = new Date();
  const stamp = now.toISOString();
  const today = stamp.slice(0, 10);
  const { year, week } = isoWeek(now);
  const manager = await env.DB.prepare("SELECT id FROM users WHERE role='management' ORDER BY id LIMIT 1").first<{ id: number }>();
  const managerId = manager?.id || 1;
  const driverUser = await env.DB.prepare("SELECT id FROM users WHERE email='driver@logipay.demo'").first<{ id: number }>();

  await env.DB.batch(staff.map(([name, system, pay, location, vacation], index) =>
    env.DB.prepare(
      "INSERT INTO staff (user_id, full_name, system_type, compensation, location, company, vacation, status, hired_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)",
    ).bind(index === 0 ? driverUser?.id ?? null : null, name, system, pay, location, company, vacation, `202${3 + (index % 3)}-0${1 + (index % 9)}-01`, stamp, stamp)));
  const staffRows = await env.DB.prepare("SELECT id, full_name FROM staff ORDER BY id").all<{ id: number; full_name: string }>();
  const staffId = (index: number) => staffRows.results[index]?.id ?? null;

  await env.DB.batch(vehicles.map(([plate, location, status, notes], index) =>
    env.DB.prepare(
      "INSERT OR IGNORE INTO vehicles (license_plate, company, location, status, assigned_staff_id, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(plate, company, location, status, index < 3 ? staffId(index) : null, notes, stamp, stamp)));

  const plans = [
    [0, "Hansa Handel", "Hamburg", "HH-MT 101", "T-1001", "planned", ""],
    [1, "Weser Food", "Hamburg", "HH-MT 102", "T-1002", "planned", ""],
    [2, "Elbe Pharma", "Bremen", "HB-MT 201", "T-2001", "planned", "Kühlware 2–8 °C"],
    [3, "Hansa Handel", "Hannover", "H-MT 301", "T-3001", "attention", "Fahrzeug in der Werkstatt – Ersatz klären"],
  ] as const;
  for (const [index, customer, location, plate, block, status, comments] of plans) {
    const person = staffRows.results[index];
    await env.DB.prepare(
      `INSERT INTO weekly_planning (planning_year, calendar_week, company, staff_id, driver_name, location, license_plate, work_days, start_time, block_id, status, comments, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, '1,2,3,4,5', '06:00', ?, ?, ?, ?, ?)`,
    ).bind(year, week, customer, person?.id ?? null, person?.full_name ?? null, location, plate, block, status, comments, stamp, stamp).run();
  }
  const planRows = await env.DB.prepare("SELECT id, license_plate FROM weekly_planning ORDER BY id").all<{ id: number; license_plate: string }>();
  const routes = [
    ["Unterwegs", "Lager Hamburg-Billbrook", "Hansa Handel, Lüneburg"],
    ["Beladen", "Lager Hamburg-Billbrook", "Weser Food, Bremen"],
    ["Unterwegs", "Elbe Pharma, Bremen", "Apothekenlager Hannover"],
    ["Geplant", "Depot Hannover", "Hansa Handel, Celle"],
  ] as const;
  for (const [index, plan] of planRows.results.entries()) {
    const [status, pickup, delivery] = routes[index] ?? routes[3];
    await env.DB.prepare(
      "INSERT OR IGNORE INTO trip_operations (planning_id, status, pickup_address, delivery_address, eta, delay_reason, recipient_name, signature_name, started_at, loaded_at, delivered_at, updated_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, '', '', '', ?, ?, NULL, ?, ?, ?)",
    ).bind(plan.id, status, pickup, delivery, new Date(now.getTime() + (index + 2) * 3_600_000).toISOString(), status === "Geplant" ? null : stamp, status === "Beladen" ? stamp : null, managerId, stamp, stamp).run();
  }

  for (const [plate, latitude, longitude, speed, heading, ignition, odometer, place, minutesAgo] of positions) {
    const recordedAt = new Date(now.getTime() - minutesAgo * 60_000).toISOString();
    const tracker = await env.DB.prepare(
      "INSERT OR IGNORE INTO truck_trackers (license_plate, device_id, provider, enabled, last_connected_at, created_at, updated_at) VALUES (?, ?, 'Demo', 1, ?, ?, ?)",
    ).bind(plate, `DEMO-${plate.replace(/\W+/g, "-")}`, recordedAt, stamp, stamp).run();
    await env.DB.prepare(
      "INSERT INTO truck_positions (tracker_id, license_plate, latitude, longitude, speed_kph, heading, ignition, odometer_km, address, source, recorded_at, received_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'demo', ?, ?)",
    ).bind(Number(tracker.meta.last_row_id), plate, latitude, longitude, speed, heading, ignition, odometer, place, recordedAt, recordedAt).run();
  }

  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO tachograph_records (staff_id, license_plate, record_date, driving_minutes, rest_minutes, remaining_minutes, infringement, source, notes, created_at, updated_at) VALUES (?, 'HH-MT 101', ?, 280, 45, 260, '', 'demo', 'Demo-Datensatz', ?, ?)",
    ).bind(staffId(0), today, stamp, stamp),
    env.DB.prepare(
      "INSERT INTO tachograph_records (staff_id, license_plate, record_date, driving_minutes, rest_minutes, remaining_minutes, infringement, source, notes, created_at, updated_at) VALUES (?, 'HB-MT 201', ?, 455, 35, 85, 'Pause in 25 Min. erforderlich', 'demo', 'Demo-Datensatz', ?, ?)",
    ).bind(staffId(2), today, stamp, stamp),
    env.DB.prepare(
      "INSERT INTO expenses (staff_id, license_plate, expense_date, category, merchant, gross_amount, vat_amount, liters, odometer_km, status, recognition_status, notes, created_at, updated_at) VALUES (?, 'HH-MT 101', ?, 'Diesel', 'Tankstelle Hamburg-Süd', 312.4, 49.88, 182.5, 312400, 'Eingereicht', 'Prüfen', 'Demo-Beleg', ?, ?)",
    ).bind(staffId(0), today, stamp, stamp),
    env.DB.prepare(
      "INSERT INTO vehicle_checklists (staff_id, planning_id, license_plate, phase, checks_json, damage_notes, status, created_at) VALUES (?, ?, 'HH-MT 101', 'Vor Fahrt', ?, '', 'OK', ?)",
    ).bind(staffId(0), planRows.results[0]?.id ?? null, JSON.stringify({ feuerloescher: true, ersteHilfe: true, warnweste: true, reifen: true, licht: true, dokumente: true }), stamp),
    env.DB.prepare(
      "INSERT INTO driver_concerns (staff_id, period, company, base, truck_number, item_name, purchase_status, completion_status, notes, created_at, updated_at) VALUES (?, ?, ?, 'Hamburg', 'HH-MT 102', 'Scheibenwischer vorne', 'Bestellt', 'In Bearbeitung', '', ?, ?)",
    ).bind(staffId(1), today.slice(0, 7), company, stamp, stamp),
    env.DB.prepare(
      "INSERT INTO driver_concerns (staff_id, period, company, base, truck_number, item_name, purchase_status, completion_status, notes, created_at, updated_at) VALUES (?, ?, ?, 'Bremen', 'HB-MT 201', 'Warnweste Größe XL', '', 'Neu', '', ?, ?)",
    ).bind(staffId(2), today.slice(0, 7), company, stamp, stamp),
    env.DB.prepare(
      "INSERT OR IGNORE INTO vehicle_fuel_codes (license_plate, fuel_type, code_value, active, updated_by, created_at, updated_at) VALUES ('HH-MT 101', 'diesel', 'DEMO-4711', 1, ?, ?, ?)",
    ).bind(managerId, stamp, stamp),
    env.DB.prepare(
      "INSERT INTO notifications (role_scope, category, title, message, entity_type, entity_id, severity, created_at) VALUES ('dispatcher', 'operations', 'Fahrzeug unterwegs', 'HH-MT 101 ist auf dem Weg nach Lüneburg.', 'trip', '1', 'info', ?)",
    ).bind(stamp),
  ]);
}
