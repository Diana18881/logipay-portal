import { currentTenantId, env } from "@logipay/env";
import { seedDemoCompany } from "./demo-seed";
import { DEMO_TENANT } from "./tenants";

export async function ensureDomainDatabase() {
  await env.DB.batch([
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS staff (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, full_name TEXT NOT NULL, system_type TEXT, compensation TEXT, location TEXT, company TEXT, vacation TEXT, status TEXT NOT NULL DEFAULT 'active', hired_at TEXT, terminated_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS vehicles (id INTEGER PRIMARY KEY AUTOINCREMENT, license_plate TEXT NOT NULL UNIQUE, company TEXT, location TEXT, status TEXT NOT NULL DEFAULT 'active', assigned_staff_id INTEGER, inspection_due TEXT, notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS weekly_planning (id INTEGER PRIMARY KEY AUTOINCREMENT, planning_year INTEGER NOT NULL DEFAULT 2026, calendar_week INTEGER NOT NULL, company TEXT NOT NULL, staff_id INTEGER, driver_name TEXT, location TEXT, license_plate TEXT, work_days TEXT NOT NULL DEFAULT '1,2,3,4,5,6,7', start_time TEXT NOT NULL DEFAULT '06:00', block_id TEXT, status TEXT NOT NULL DEFAULT 'planned', comments TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS salary_documents (id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id INTEGER NOT NULL, period TEXT NOT NULL, file_name TEXT NOT NULL, object_key TEXT NOT NULL UNIQUE, content_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, uploaded_by INTEGER NOT NULL, created_at TEXT NOT NULL)`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS driver_concerns (id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id INTEGER, period TEXT NOT NULL, company TEXT NOT NULL, base TEXT, truck_number TEXT, item_name TEXT NOT NULL, purchase_status TEXT, completion_status TEXT NOT NULL DEFAULT 'Neu', notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    ),
    env.DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_concerns_period_status ON driver_concerns(period, completion_status)`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS voice_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id INTEGER NOT NULL, user_id INTEGER NOT NULL, license_plate TEXT, duration_seconds INTEGER NOT NULL DEFAULT 0, file_name TEXT NOT NULL, object_key TEXT NOT NULL UNIQUE, content_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, note TEXT, status TEXT NOT NULL DEFAULT 'Neu', listened_by INTEGER, listened_at TEXT, created_at TEXT NOT NULL)`,
    ),
    env.DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_voice_messages_status_created ON voice_messages(status, created_at)`,
    ),
    env.DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_voice_messages_staff_created ON voice_messages(staff_id, created_at)`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, action TEXT NOT NULL, entity_id TEXT, details TEXT, created_at TEXT NOT NULL)`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS vehicle_files (id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id INTEGER, license_plate TEXT NOT NULL, category TEXT NOT NULL, file_name TEXT NOT NULL, object_key TEXT NOT NULL UNIQUE, content_type TEXT NOT NULL, notes TEXT, created_at TEXT NOT NULL)`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS vehicle_comments (id INTEGER PRIMARY KEY AUTOINCREMENT, license_plate TEXT NOT NULL, author_user_id INTEGER NOT NULL, author_name TEXT NOT NULL, comment TEXT NOT NULL, created_at TEXT NOT NULL)`,
    ),
    env.DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_vehicle_comments_plate_created ON vehicle_comments(license_plate, created_at)`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS vehicle_fuel_codes (id INTEGER PRIMARY KEY AUTOINCREMENT, license_plate TEXT NOT NULL, fuel_type TEXT NOT NULL, code_value TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, updated_by INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(license_plate, fuel_type))`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS employee_documents (id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id INTEGER NOT NULL, category TEXT NOT NULL, file_name TEXT NOT NULL, object_key TEXT NOT NULL UNIQUE, content_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, expires_at TEXT, uploaded_by INTEGER NOT NULL, created_at TEXT NOT NULL)`,
    ),
    env.DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_employee_documents_staff ON employee_documents(staff_id, category)`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS payroll_calculations (id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id INTEGER NOT NULL, period TEXT NOT NULL, base_salary REAL NOT NULL DEFAULT 0, tour_count INTEGER NOT NULL DEFAULT 0, bonuses REAL NOT NULL DEFAULT 0, expenses REAL NOT NULL DEFAULT 0, deductions REAL NOT NULL DEFAULT 0, net_amount REAL NOT NULL DEFAULT 0, payment_status TEXT NOT NULL DEFAULT 'draft', locked_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(staff_id, period))`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS work_days (id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id INTEGER NOT NULL, work_date TEXT NOT NULL, day_type TEXT NOT NULL DEFAULT 'work', hours REAL NOT NULL DEFAULT 8, night INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, UNIQUE(staff_id, work_date))`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS absences (id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id INTEGER NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, absence_type TEXT NOT NULL DEFAULT 'vacation', note TEXT, created_by INTEGER, created_at TEXT NOT NULL)`,
    ),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_absences_staff_dates ON absences(staff_id, start_date, end_date)`),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS payroll_periods (id INTEGER PRIMARY KEY AUTOINCREMENT, period TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'open', closed_by INTEGER, closed_at TEXT, reopened_by INTEGER, reopened_at TEXT, reopen_reason TEXT, updated_at TEXT NOT NULL)`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS vehicle_maintenance (id INTEGER PRIMARY KEY AUTOINCREMENT, license_plate TEXT NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL, cost REAL NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'Gemeldet', responsible TEXT, due_date TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    ),
    env.DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_vehicle_maintenance_plate ON vehicle_maintenance(license_plate, status)`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS login_audit (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, email TEXT NOT NULL, success INTEGER NOT NULL, ip_address TEXT, user_agent TEXT, created_at TEXT NOT NULL)`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS password_reset_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL, resolved_at TEXT)`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS truck_trackers (id INTEGER PRIMARY KEY AUTOINCREMENT, license_plate TEXT NOT NULL, device_id TEXT NOT NULL, provider TEXT NOT NULL DEFAULT 'other', enabled INTEGER NOT NULL DEFAULT 1, last_connected_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    ),
    env.DB.prepare(
      `CREATE UNIQUE INDEX IF NOT EXISTS tracker_license_plate_unique ON truck_trackers(license_plate)`,
    ),
    env.DB.prepare(
      `CREATE UNIQUE INDEX IF NOT EXISTS tracker_device_id_unique ON truck_trackers(device_id)`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS truck_positions (id INTEGER PRIMARY KEY AUTOINCREMENT, tracker_id INTEGER NOT NULL, license_plate TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL, speed_kph REAL NOT NULL DEFAULT 0, heading REAL, ignition INTEGER NOT NULL DEFAULT 0, odometer_km REAL, address TEXT, source TEXT NOT NULL DEFAULT 'tracker', recorded_at TEXT NOT NULL, received_at TEXT NOT NULL, FOREIGN KEY (tracker_id) REFERENCES truck_trackers(id))`,
    ),
    env.DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_truck_positions_plate_recorded ON truck_positions(license_plate, recorded_at)`,
    ),
    env.DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_truck_positions_tracker_recorded ON truck_positions(tracker_id, recorded_at)`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS tachograph_records (id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id INTEGER NOT NULL, license_plate TEXT NOT NULL, record_date TEXT NOT NULL, driving_minutes INTEGER NOT NULL DEFAULT 0, rest_minutes INTEGER NOT NULL DEFAULT 0, remaining_minutes INTEGER NOT NULL DEFAULT 540, infringement TEXT, source TEXT NOT NULL DEFAULT 'manual', notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    ),
    env.DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_tachograph_staff_date ON tachograph_records(staff_id, record_date)`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS trip_operations (id INTEGER PRIMARY KEY AUTOINCREMENT, planning_id INTEGER NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'Geplant', pickup_address TEXT, delivery_address TEXT, eta TEXT, delay_reason TEXT, recipient_name TEXT, signature_name TEXT, started_at TEXT, loaded_at TEXT, delivered_at TEXT, updated_by INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    ),
    env.DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_trip_operations_status_eta ON trip_operations(status, eta)`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS planning_departure_confirmations (id INTEGER PRIMARY KEY AUTOINCREMENT, planning_id INTEGER NOT NULL, shift_date TEXT NOT NULL, confirmed_at TEXT NOT NULL, confirmed_by INTEGER NOT NULL, created_at TEXT NOT NULL, UNIQUE(planning_id, shift_date), FOREIGN KEY (planning_id) REFERENCES weekly_planning(id), FOREIGN KEY (confirmed_by) REFERENCES users(id))`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS trip_documents (id INTEGER PRIMARY KEY AUTOINCREMENT, trip_operation_id INTEGER NOT NULL, staff_id INTEGER, category TEXT NOT NULL, file_name TEXT NOT NULL, object_key TEXT NOT NULL UNIQUE, content_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, created_at TEXT NOT NULL)`,
    ),
    env.DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_trip_documents_trip ON trip_documents(trip_operation_id, category)`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS trip_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, trip_operation_id INTEGER NOT NULL, sender_user_id INTEGER NOT NULL, sender_role TEXT NOT NULL, message_type TEXT NOT NULL DEFAULT 'text', body TEXT, original_language TEXT NOT NULL DEFAULT 'de', translations_json TEXT NOT NULL DEFAULT '{}', file_name TEXT, object_key TEXT UNIQUE, content_type TEXT, size_bytes INTEGER, duration_seconds INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`,
    ),
    env.DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_trip_messages_operation_created ON trip_messages(trip_operation_id, created_at)`,
    ),
    env.DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_trip_messages_sender_created ON trip_messages(sender_user_id, created_at)`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS trip_message_reads (id INTEGER PRIMARY KEY AUTOINCREMENT, message_id INTEGER NOT NULL, user_id INTEGER NOT NULL, read_at TEXT NOT NULL, UNIQUE(message_id, user_id))`,
    ),
    env.DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_trip_message_reads_user ON trip_message_reads(user_id, read_at)`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS direct_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, sender_user_id INTEGER NOT NULL, recipient_user_id INTEGER, recipient_staff_id INTEGER, message_type TEXT NOT NULL DEFAULT 'text', body TEXT, original_language TEXT NOT NULL DEFAULT 'de', translations_json TEXT NOT NULL DEFAULT '{}', file_name TEXT, object_key TEXT UNIQUE, content_type TEXT, size_bytes INTEGER, duration_seconds INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, read_at TEXT)`,
    ),
    env.DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_direct_messages_pair_created ON direct_messages(sender_user_id, recipient_user_id, created_at)`,
    ),
    env.DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_direct_messages_recipient_read ON direct_messages(recipient_user_id, read_at)`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS expenses (id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id INTEGER NOT NULL, license_plate TEXT NOT NULL, expense_date TEXT NOT NULL, category TEXT NOT NULL, merchant TEXT, gross_amount REAL NOT NULL DEFAULT 0, vat_amount REAL NOT NULL DEFAULT 0, liters REAL, odometer_km REAL, payment_method TEXT NOT NULL DEFAULT 'Privatauslage', reimbursable INTEGER NOT NULL DEFAULT 1, reimbursement_amount REAL NOT NULL DEFAULT 0, amazon_site TEXT, block_id TEXT, tour_reference TEXT, cost_center TEXT, receipt_number TEXT, status TEXT NOT NULL DEFAULT 'Eingereicht', receipt_file_name TEXT, receipt_object_key TEXT UNIQUE, receipt_content_type TEXT, recognition_status TEXT NOT NULL DEFAULT 'Prüfen', payment_reference TEXT, reviewed_by INTEGER, reviewed_at TEXT, paid_at TEXT, rejection_reason TEXT, notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS fuel_stops (id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id INTEGER NOT NULL, license_plate TEXT NOT NULL, station TEXT NOT NULL, refueled_at TEXT NOT NULL, odometer_km REAL NOT NULL, diesel_liters REAL NOT NULL DEFAULT 0, adblue_liters REAL NOT NULL DEFAULT 0, gross_amount REAL NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'Eingereicht', station_file_name TEXT NOT NULL, station_object_key TEXT NOT NULL UNIQUE, station_content_type TEXT NOT NULL, diesel_file_name TEXT NOT NULL, diesel_object_key TEXT NOT NULL UNIQUE, diesel_content_type TEXT NOT NULL, adblue_file_name TEXT NOT NULL, adblue_object_key TEXT NOT NULL UNIQUE, adblue_content_type TEXT NOT NULL, receipt_file_name TEXT NOT NULL, receipt_object_key TEXT NOT NULL UNIQUE, receipt_content_type TEXT NOT NULL, expense_id INTEGER, notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    ),
    env.DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_fuel_stops_plate_date ON fuel_stops(license_plate, refueled_at)`,
    ),
    env.DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_fuel_stops_staff_date ON fuel_stops(staff_id, refueled_at)`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS driver_performance_events (id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id INTEGER NOT NULL, event_date TEXT NOT NULL, event_type TEXT NOT NULL, rating INTEGER, score_delta INTEGER NOT NULL DEFAULT 0, minutes_late INTEGER NOT NULL DEFAULT 0, notes TEXT, created_by INTEGER NOT NULL, created_by_name TEXT NOT NULL, created_at TEXT NOT NULL)`,
    ),
    env.DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_driver_performance_staff_date ON driver_performance_events(staff_id, event_date)`,
    ),
    env.DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_driver_performance_type_date ON driver_performance_events(event_type, event_date)`,
    ),
    env.DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_expenses_date_status ON expenses(expense_date, status)`,
    ),
    env.DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_expenses_staff_date ON expenses(staff_id, expense_date)`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, role_scope TEXT, category TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL, entity_type TEXT, entity_id TEXT, severity TEXT NOT NULL DEFAULT 'info', read_at TEXT, created_at TEXT NOT NULL)`,
    ),
    env.DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_notifications_scope_read ON notifications(role_scope, read_at)`,
    ),
    env.DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read_at)`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS vehicle_checklists (id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id INTEGER NOT NULL, planning_id INTEGER, license_plate TEXT NOT NULL, phase TEXT NOT NULL, checks_json TEXT NOT NULL, damage_notes TEXT, status TEXT NOT NULL DEFAULT 'OK', created_at TEXT NOT NULL)`,
    ),
    env.DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_vehicle_checklists_plate_created ON vehicle_checklists(license_plate, created_at)`,
    ),
  ]);
  // Early builds of direct_messages required a recipient login; rebuild so drivers without one can be addressed by staff id.
  const directColumns = await env.DB.prepare("PRAGMA table_info(direct_messages)").all<{ name: string }>();
  if (!directColumns.results.some((column) => column.name === "recipient_staff_id")) await env.DB.batch([
    env.DB.prepare("ALTER TABLE direct_messages RENAME TO direct_messages_old"),
    env.DB.prepare(`CREATE TABLE direct_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, sender_user_id INTEGER NOT NULL, recipient_user_id INTEGER, recipient_staff_id INTEGER, message_type TEXT NOT NULL DEFAULT 'text', body TEXT, original_language TEXT NOT NULL DEFAULT 'de', translations_json TEXT NOT NULL DEFAULT '{}', file_name TEXT, object_key TEXT UNIQUE, content_type TEXT, size_bytes INTEGER, duration_seconds INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, read_at TEXT)`),
    env.DB.prepare("INSERT INTO direct_messages (id, sender_user_id, recipient_user_id, message_type, body, original_language, translations_json, file_name, object_key, content_type, size_bytes, duration_seconds, created_at, read_at) SELECT id, sender_user_id, recipient_user_id, message_type, body, original_language, translations_json, file_name, object_key, content_type, size_bytes, duration_seconds, created_at, read_at FROM direct_messages_old"),
    env.DB.prepare("DROP TABLE direct_messages_old"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_direct_messages_pair_created ON direct_messages(sender_user_id, recipient_user_id, created_at)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_direct_messages_recipient_read ON direct_messages(recipient_user_id, read_at)"),
  ]);
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_direct_messages_staff ON direct_messages(recipient_staff_id)").run();
  const perfColumns = await env.DB.prepare("PRAGMA table_info(driver_performance_events)").all<{ name: string }>();
  if (!perfColumns.results.some((column) => column.name === "criteria"))
    await env.DB.prepare("ALTER TABLE driver_performance_events ADD COLUMN criteria TEXT").run();
  const expenseColumns = await env.DB.prepare(
    "PRAGMA table_info(expenses)",
  ).all<{ name: string }>();
  const expenseColumnNames = new Set(expenseColumns.results.map((column) => column.name));
  const missingExpenseColumns: Array<[string, string]> = [
    ["payment_method", "ALTER TABLE expenses ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'Privatauslage'"],
    ["reimbursable", "ALTER TABLE expenses ADD COLUMN reimbursable INTEGER NOT NULL DEFAULT 1"],
    ["reimbursement_amount", "ALTER TABLE expenses ADD COLUMN reimbursement_amount REAL NOT NULL DEFAULT 0"],
    ["amazon_site", "ALTER TABLE expenses ADD COLUMN amazon_site TEXT"],
    ["block_id", "ALTER TABLE expenses ADD COLUMN block_id TEXT"],
    ["tour_reference", "ALTER TABLE expenses ADD COLUMN tour_reference TEXT"],
    ["cost_center", "ALTER TABLE expenses ADD COLUMN cost_center TEXT"],
    ["receipt_number", "ALTER TABLE expenses ADD COLUMN receipt_number TEXT"],
    ["payment_reference", "ALTER TABLE expenses ADD COLUMN payment_reference TEXT"],
    ["reviewed_by", "ALTER TABLE expenses ADD COLUMN reviewed_by INTEGER"],
    ["reviewed_at", "ALTER TABLE expenses ADD COLUMN reviewed_at TEXT"],
    ["paid_at", "ALTER TABLE expenses ADD COLUMN paid_at TEXT"],
    ["rejection_reason", "ALTER TABLE expenses ADD COLUMN rejection_reason TEXT"],
  ];
  for (const [name, sql] of missingExpenseColumns) {
    if (!expenseColumnNames.has(name)) await env.DB.prepare(sql).run();
  }
  await env.DB.prepare(
    "UPDATE expenses SET reimbursement_amount=gross_amount WHERE reimbursable=1 AND reimbursement_amount=0 AND payment_method='Privatauslage'",
  ).run();
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_expenses_reimbursement_status ON expenses(reimbursable, status, paid_at)",
  ).run();
  const payrollColumns = await env.DB.prepare(
    "PRAGMA table_info(payroll_calculations)",
  ).all<{ name: string }>();
  const payrollColumnNames = new Set(payrollColumns.results.map((column) => column.name));
  const missingPayrollColumns: Array<[string, string]> = [
    ["night_bonus", "ALTER TABLE payroll_calculations ADD COLUMN night_bonus REAL NOT NULL DEFAULT 0"],
    ["sunday_bonus", "ALTER TABLE payroll_calculations ADD COLUMN sunday_bonus REAL NOT NULL DEFAULT 0"],
    ["holiday_bonus", "ALTER TABLE payroll_calculations ADD COLUMN holiday_bonus REAL NOT NULL DEFAULT 0"],
    ["reimbursements", "ALTER TABLE payroll_calculations ADD COLUMN reimbursements REAL NOT NULL DEFAULT 0"],
    ["calculation_details", "ALTER TABLE payroll_calculations ADD COLUMN calculation_details TEXT NOT NULL DEFAULT '{}'"],
    ["calculated_at", "ALTER TABLE payroll_calculations ADD COLUMN calculated_at TEXT"],
    ["calculated_by", "ALTER TABLE payroll_calculations ADD COLUMN calculated_by INTEGER"],
    ["locked_by", "ALTER TABLE payroll_calculations ADD COLUMN locked_by INTEGER"],
  ];
  for (const [name, sql] of missingPayrollColumns) {
    if (!payrollColumnNames.has(name)) await env.DB.prepare(sql).run();
  }
  await env.DB.prepare(
    `INSERT OR IGNORE INTO payroll_periods (period, status, closed_at, updated_at)
     SELECT DISTINCT period, 'closed', MAX(locked_at), MAX(updated_at)
     FROM payroll_calculations WHERE locked_at IS NOT NULL GROUP BY period`,
  ).run();
  const planningColumns = await env.DB.prepare(
    "PRAGMA table_info(weekly_planning)",
  ).all<{ name: string }>();
  if (
    !planningColumns.results.some((column) => column.name === "planning_year")
  ) {
    await env.DB.prepare(
      "ALTER TABLE weekly_planning ADD COLUMN planning_year INTEGER NOT NULL DEFAULT 2026",
    ).run();
  }
  if (!planningColumns.results.some((column) => column.name === "work_days")) {
    await env.DB.prepare(
      "ALTER TABLE weekly_planning ADD COLUMN work_days TEXT NOT NULL DEFAULT '1,2,3,4,5,6,7'",
    ).run();
  }
  if (!planningColumns.results.some((column) => column.name === "start_time")) {
    await env.DB.prepare(
      "ALTER TABLE weekly_planning ADD COLUMN start_time TEXT NOT NULL DEFAULT '06:00'",
    ).run();
  }
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_weekly_planning_year_week ON weekly_planning(planning_year, calendar_week)",
  ).run();
  await env.DB.prepare(
    `UPDATE driver_concerns SET completion_status = CASE
      WHEN completion_status IN ('Delivered') THEN 'Erledigt'
      WHEN completion_status IN ('Next week', 'in second week') THEN 'In Bearbeitung'
      WHEN completion_status IN ('New', 'Not delivered') THEN 'Neu'
      ELSE completion_status END
    WHERE completion_status IN ('Delivered', 'Next week', 'in second week', 'New', 'Not delivered')`,
  ).run();
  const concernColumns = await env.DB.prepare(
    "PRAGMA table_info(driver_concerns)",
  ).all<{ name: string }>();
  if (!concernColumns.results.some((column) => column.name === "staff_id")) {
    await env.DB.prepare(
      "ALTER TABLE driver_concerns ADD COLUMN staff_id INTEGER",
    ).run();
  }
  if (currentTenantId() === DEMO_TENANT) await seedDemoCompany();
  const syncNow = new Date().toISOString();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO trip_operations (planning_id, status, pickup_address, delivery_address, eta, delay_reason, recipient_name, signature_name, updated_by, created_at, updated_at)
     SELECT p.id, 'Geplant', COALESCE(p.location, ''), '', NULL, '', '', '', COALESCE((SELECT id FROM users WHERE role='management' ORDER BY id LIMIT 1), 1), ?, ?
     FROM weekly_planning p`,
  ).bind(syncNow, syncNow).run();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO notifications (role_scope, category, title, message, entity_type, entity_id, severity, created_at)
       SELECT 'management', 'document', 'Dokument läuft ab', s.full_name || ': ' || d.category || ' bis ' || d.expires_at, 'employee_document', CAST(d.id AS TEXT), 'warning', ?
       FROM employee_documents d JOIN staff s ON s.id=d.staff_id
       WHERE d.expires_at IS NOT NULL AND d.expires_at!='' AND date(d.expires_at)<=date('now','+60 days')
       AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.category='document' AND n.entity_type='employee_document' AND n.entity_id=CAST(d.id AS TEXT))`,
    ).bind(syncNow),
    env.DB.prepare(
      `INSERT INTO notifications (role_scope, category, title, message, entity_type, entity_id, severity, created_at)
       SELECT 'dispatcher', 'tracking', 'Tracker ohne aktuelles Signal', t.license_plate || ': letztes Signal ' || COALESCE(t.last_connected_at, 'unbekannt'), 'tracker', CAST(t.id AS TEXT), 'warning', ?
       FROM truck_trackers t
       WHERE t.enabled=1 AND (t.last_connected_at IS NULL OR datetime(t.last_connected_at)<datetime('now','-30 minutes'))
       AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.category='tracking' AND n.entity_type='tracker' AND n.entity_id=CAST(t.id AS TEXT))`,
    ).bind(syncNow),
    env.DB.prepare(
      `INSERT INTO notifications (role_scope, category, title, message, entity_type, entity_id, severity, created_at)
       SELECT 'dispatcher', 'concern', 'Offenes Fahreranliegen', COALESCE(s.full_name,c.notes,'Fahrer') || ': ' || c.item_name, 'concern', CAST(c.id AS TEXT), 'urgent', ?
       FROM driver_concerns c LEFT JOIN staff s ON s.id=c.staff_id
       WHERE c.completion_status NOT IN ('Erledigt','Delivered')
       AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.category='concern' AND n.entity_type='concern' AND n.entity_id=CAST(c.id AS TEXT))`,
    ).bind(syncNow),
    env.DB.prepare(
      `INSERT INTO notifications (role_scope, category, title, message, entity_type, entity_id, severity, created_at)
       SELECT 'dispatcher', 'departure', 'Abfahrt nicht bestätigt', COALESCE(p.driver_name, 'Fahrer') || ' · ' || COALESCE(p.company, 'Tour') || ' · Block ' || COALESCE(p.block_id, '—') || ' · Ersatzfahrer suchen', 'planning', CAST(p.id AS TEXT) || ':' || date('now'), 'urgent', ?
       FROM weekly_planning p
       WHERE p.driver_name IS NOT NULL AND p.driver_name != '' AND COALESCE(p.status, 'planned') != 'vacation'
       AND NOT EXISTS (
         SELECT 1 FROM planning_departure_confirmations c
         WHERE c.planning_id = p.id AND c.shift_date = date('now')
       )
       AND NOT EXISTS (
         SELECT 1 FROM notifications n
         WHERE n.category = 'departure' AND n.entity_type = 'planning' AND n.entity_id = CAST(p.id AS TEXT) || ':' || date('now')
       )`,
    ).bind(syncNow),
  ]);
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS company_settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT NOT NULL)").run();
  const staffColumns = await env.DB.prepare("PRAGMA table_info(staff)").all<{ name: string }>();
  if (!staffColumns.results.some((column) => column.name === "personnel_number"))
    await env.DB.prepare("ALTER TABLE staff ADD COLUMN personnel_number TEXT").run();
  // Optional planner hint; Turso/libsql rejects this statement, so failures are ignored.
  await env.DB.prepare("PRAGMA optimize").run().catch(() => undefined);
}
