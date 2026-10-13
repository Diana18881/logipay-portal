import { env } from "@logipay/env";

const drivers = [
  [
    "Михаил Козлов",
    "2/2",
    "2000 € Netto",
    "HAJ1",
    "NAL LOGISTIK",
    "",
  ],
  [
    "Marcin Krawczyk",
    "2/2",
    "1750 € Netto",
    "HAJ1",
    "NAL LOGISTIK",
    "20.07–31.07",
  ],
  ["Krzysztof Andrzej Ostap", "2/1", "2000–2200 € Netto", "BER8", "EuRide", ""],
  ["Osych Robert", "2/1", "2000–2200 € Netto", "BER8", "EVEREST", ""],
  [
    "Patryk Brzezinski",
    "2/1",
    "2300–2400 € Netto",
    "BER8 / HAJ1",
    "EVEREST",
    "",
  ],
  ["Piotr Sekowski", "2/1", "2300–2400 € Netto", "BER8 / HAJ1", "EVEREST", ""],
  [
    "Andrzej Stanislaw Nazarewicz",
    "2/2",
    "1500 € Netto",
    "BER8",
    "EVEREST",
    "",
  ],
  [
    "Krzysztof Szafer",
    "2/1",
    "2300–2400 € Netto",
    "BER8 / HAJ1",
    "EVEREST",
    "",
  ],
  ["Wojciech Kaiser", "2/1", "2000–2200 € Netto", "BER8", "EuRide", ""],
  ["Patryk Karwecki", "2/1", "2300–2400 € Netto", "BER8 / HAJ1", "EVEREST", ""],
  [
    "Dariusz Radoslaw Raczynski",
    "SPRINGER",
    "3300 € Netto",
    "ALLE",
    "EuRide",
    "",
  ],
  [
    "Lukasz Swiatlowski",
    "SPRINGER",
    "3300 € Netto",
    "ALLE",
    "ALMAZ",
    "31.08–07.09",
  ],
  [
    "Grzegorz Swiatlowski",
    "SPRINGER",
    "3300 € Netto",
    "ALLE",
    "ALMAZ",
    "31.08–07.09",
  ],
  ["Farhad Tabatabaie", "SPRINGER", "3300 € Netto", "ALLE", "SF", ""],
  ["Valentyn Haivaniuk", "SPRINGER", "3300 € Netto", "ALLE", "EuRide", ""],
  ["Piotr Wiosna", "2/2", "1500 € Netto", "BER8", "EVEREST", ""],
  ["Jakub Szymanek", "2/1", "2000–2200 € Netto", "BER8", "EVEREST", ""],
  ["Szymon Koput", "2/2", "2000 € Netto", "ALLE", "N&O", ""],
];

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
  const count = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM staff",
  ).first<{ count: number }>();
  if (!count?.count) {
    const now = new Date().toISOString();
    await env.DB.batch(
      drivers.map((d) =>
        env.DB.prepare(
          "INSERT INTO staff (full_name, system_type, compensation, location, company, vacation, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)",
        ).bind(...d, now, now),
      ),
    );
    const vehicles = [
      ["B-CY 3603", "EuRide", "BER8", "active", ""],
      ["KR-QG 237", "EVEREST", "BER8", "active", ""],
      ["B-YL 7868", "ALMAZ", "HAJ1", "workshop", "Werkstatt / TÜV-SP prüfen"],
      ["B-ML 4182", "NAL LOGISTIK", "HAJ1", "active", ""],
      ["B-RS 9120", "SF", "PAD1", "reserve", "Ersatzfahrzeug"],
    ];
    await env.DB.batch(
      vehicles.map((v) =>
        env.DB.prepare(
          "INSERT OR IGNORE INTO vehicles (license_plate, company, location, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ).bind(...v, now, now),
      ),
    );
    const plans = [
      [
        32,
        "EuRide",
        "Krzysztof Andrzej Ostap",
        "BER8",
        "B-CY 3603",
        "planned",
        "",
      ],
      [32, "EVEREST", "Osych Robert", "BER8", "KR-QG 237", "planned", ""],
      [
        32,
        "ALMAZ",
        "Lukasz Swiatlowski",
        "HAJ1",
        "B-YL 7868",
        "attention",
        "Werkstatttermin / TÜV",
      ],
      [
        32,
        "NAL LOGISTIK",
        "Михаил Козлов",
        "HAJ1",
        "B-ML 4182",
        "planned",
        "Demo-Einsatz",
      ],
    ];
    await env.DB.batch(
      plans.map((p) =>
        env.DB.prepare(
          "INSERT INTO weekly_planning (calendar_week, company, driver_name, location, license_plate, status, comments, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ).bind(...p, now, now),
      ),
    );
  }
  await ensureDemoDriverSetup();
  const concerns = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM driver_concerns",
  ).first<{ count: number }>();
  if (!concerns?.count) {
    const now = new Date().toISOString();
    const rows = [
      [
        "2026-01",
        "Euride",
        "HAJ1, BER43",
        "B-WY 9027",
        "Wiper blades for Mercedes",
        "Repurchase needed",
        "Not delivered",
        "S. Czechowski",
      ],
      [
        "2026-01",
        "Euride",
        "HAJ1, BER43",
        "KR-XQ 611",
        "Windshield washer fluid",
        "Sold out",
        "Delivered",
        "G. Swiatlowski",
      ],
      [
        "2026-01",
        "Everest",
        "BER43",
        "B-ET 9940",
        "Low beam bulb H7 x2",
        "In stock",
        "Delivered",
        "L. Krzyzanowski",
      ],
      [
        "2026-01",
        "NAL Logistics",
        "HAJ42",
        "B-WY 9544",
        "Washer fluid and work gloves",
        "Sold out",
        "Not delivered",
        "R. Pilarszyk",
      ],
      [
        "2026-01",
        "SF Transport",
        "PAD1, PAD2",
        "B-CY 5807",
        "Fender bands, wipers and washer",
        "Sold out",
        "Delivered",
        "T. Jinchtaradze",
      ],
      [
        "2026-01",
        "Spedition Almaz",
        "HAM2",
        "B-WY 9638",
        "Windshield wipers",
        "Sold out",
        "Not delivered",
        "M. Mishchuk",
      ],
      [
        "2026-01",
        "NO Transport",
        "ERF1, LEJ5",
        "B-WY 8786",
        "Schuhe Größe 42",
        "Temporarily unavailable",
        "Next week",
        "P. Marci",
      ],
      [
        "2026-02",
        "Euride",
        "HAJ1, BER43",
        "B-ER 9930",
        "Solidoil",
        "Repurchase needed",
        "Not delivered",
        "R. Tshekmeister",
      ],
      [
        "2026-02",
        "Spedition Almaz",
        "HAM2",
        "KR-XQ 700",
        "ABS (7/15 point)",
        "In stock",
        "Not delivered",
        "S. Balan",
      ],
      [
        "2026-02",
        "Everest",
        "BER43",
        "B-WY 8885",
        "Engine oil, glass cleaner, wipers",
        "Sold out",
        "Not delivered",
        "V. Scherbina",
      ],
      [
        "2026-02",
        "Everest",
        "BER43",
        "BET 9870",
        "Washer fluid, radiator fluid, gloves",
        "Repurchase needed",
        "Delivered",
        "R. Osuch",
      ],
    ];
    await env.DB.batch(
      rows.map((r) =>
        env.DB.prepare(
          "INSERT INTO driver_concerns (period, company, base, truck_number, item_name, purchase_status, completion_status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ).bind(...r, now, now),
      ),
    );
  }
  const trackerCount = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM truck_trackers",
  ).first<{ count: number }>();
  if (!trackerCount?.count) {
    const now = new Date();
    const demo = [
      ["B-CY 3603", "DEMO-B-CY-3603", "Demo", 52.520008, 13.404954, 72, 84, 1, 412568, "Berlin-Mitte", 2],
      ["B-ML 4182", "DEMO-B-ML-4182", "Demo", 52.375892, 9.732010, 0, 0, 0, 286410, "Hannover", 8],
      ["KR-QG 237", "DEMO-KR-QG-237", "Demo", 52.120533, 11.627624, 96, 248, 1, 350892, "Magdeburg", 1],
      ["B-YL 7868", "DEMO-B-YL-7868", "Demo", 51.339695, 12.373075, 0, 0, 0, 521044, "Leipzig · Werkstatt", 55],
      ["B-RS 9120", "DEMO-B-RS-9120", "Demo", 53.551086, 9.993682, 0, 0, 0, 198553, "Hamburg", 20],
    ] as const;
    for (const row of demo) {
      const recordedAt = new Date(now.getTime() - row[10] * 60_000).toISOString();
      const created = await env.DB.prepare(
        "INSERT OR IGNORE INTO truck_trackers (license_plate, device_id, provider, enabled, last_connected_at, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?, ?)",
      ).bind(row[0], row[1], row[2], recordedAt, now.toISOString(), now.toISOString()).run();
      const tracker = created.meta.last_row_id
        ? { id: Number(created.meta.last_row_id) }
        : await env.DB.prepare("SELECT id FROM truck_trackers WHERE license_plate=?").bind(row[0]).first<{ id: number }>();
      if (tracker?.id) {
        await env.DB.prepare(
          "INSERT INTO truck_positions (tracker_id, license_plate, latitude, longitude, speed_kph, heading, ignition, odometer_km, address, source, recorded_at, received_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'demo', ?, ?)",
        ).bind(tracker.id, row[0], row[3], row[4], row[5], row[6], row[7], row[8], row[9], recordedAt, recordedAt).run();
      }
    }
  }
  const operationsCount = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM trip_operations",
  ).first<{ count: number }>();
  if (!operationsCount?.count) {
    const now = new Date().toISOString();
    const manager = await env.DB.prepare("SELECT id FROM users WHERE role='management' ORDER BY id LIMIT 1").first<{ id: number }>();
    const samplePlans = await env.DB.prepare("SELECT id, staff_id, driver_name, license_plate FROM weekly_planning ORDER BY id LIMIT 3").all<{ id: number; staff_id: number | null; driver_name: string | null; license_plate: string | null }>();
    for (const [index, plan] of samplePlans.results.entries()) {
      await env.DB.prepare(
        "INSERT OR IGNORE INTO trip_operations (planning_id, status, pickup_address, delivery_address, eta, delay_reason, recipient_name, signature_name, started_at, loaded_at, delivered_at, updated_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).bind(
        plan.id,
        index === 0 ? "Unterwegs" : index === 1 ? "Beladen" : "Geplant",
        index === 0 ? "Amazon BER8, Berlin" : "Logistikzentrum",
        index === 0 ? "Amazon LEJ1, Leipzig" : "Kundenadresse",
        new Date(Date.now() + (index + 2) * 3_600_000).toISOString(),
        "",
        "",
        "",
        index < 2 ? now : null,
        index === 1 ? now : null,
        null,
        manager?.id || 1,
        now,
        now,
      ).run();
    }
    const activeStaff = await env.DB.prepare("SELECT id, full_name FROM staff WHERE status='active' ORDER BY id LIMIT 2").all<{ id: number; full_name: string }>();
    for (const [index, person] of activeStaff.results.entries()) {
      await env.DB.prepare(
        "INSERT INTO tachograph_records (staff_id, license_plate, record_date, driving_minutes, rest_minutes, remaining_minutes, infringement, source, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'demo', ?, ?, ?)",
      ).bind(person.id, index ? "KR-QG 237" : "B-CY 3603", now.slice(0, 10), index ? 455 : 310, index ? 35 : 55, index ? 85 : 230, index ? "Pause in 25 Min. erforderlich" : "", "Demo-Datensatz", now, now).run();
    }
    if (activeStaff.results[0]) {
      await env.DB.prepare(
        "INSERT INTO expenses (staff_id, license_plate, expense_date, category, merchant, gross_amount, vat_amount, liters, odometer_km, status, recognition_status, notes, created_at, updated_at) VALUES (?, 'B-CY 3603', ?, 'Kraftstoff', 'Shell Berlin', 186.40, 29.76, 102.3, 412568, 'Eingereicht', 'Prüfen', 'Demo-Beleg', ?, ?)",
      ).bind(activeStaff.results[0].id, now.slice(0, 10), now, now).run();
      await env.DB.prepare(
        "INSERT INTO vehicle_checklists (staff_id, planning_id, license_plate, phase, checks_json, damage_notes, status, created_at) VALUES (?, ?, 'B-CY 3603', 'Vor Fahrt', ?, '', 'OK', ?)",
      ).bind(activeStaff.results[0].id, samplePlans.results[0]?.id || null, JSON.stringify({ feuerloescher: true, ersteHilfe: true, warnweste: true, reifen: true, licht: true, dokumente: true }), now).run();
    }
    await env.DB.prepare(
      "INSERT INTO notifications (role_scope, category, title, message, entity_type, entity_id, severity, created_at) VALUES ('dispatcher', 'operations', 'Demo: Fahrzeug unterwegs', 'B-CY 3603 ist auf dem Weg nach Leipzig.', 'vehicle', 'B-CY 3603', 'info', ?)",
    ).bind(now).run();
  }
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
  await env.DB.prepare("PRAGMA optimize").run();
}

async function ensureDemoDriverSetup() {
  const now = new Date().toISOString();
  const driver = await env.DB.prepare("SELECT id, full_name FROM users WHERE email='driver@logipay.demo'").first<{ id: number; full_name: string }>();
  if (!driver) return;

  const demoPlate = "B-ML 4182";
  const demoBlock = "HAJ1-B042";
  const demoCompany = "NAL LOGISTIK";
  const demoLocation = "HAJ1";
  const demoWeek = 32;
  const demoYear = 2026;
  const manager = await env.DB.prepare("SELECT id FROM users WHERE role='management' ORDER BY id LIMIT 1").first<{ id: number }>();

  let staff = await env.DB.prepare("SELECT id, full_name FROM staff WHERE user_id=?").bind(driver.id).first<{ id: number; full_name: string }>();
  if (staff && staff.full_name !== driver.full_name) {
    const marcin = await env.DB.prepare("SELECT id FROM staff WHERE full_name='Marcin Krawczyk' AND user_id IS NULL").first<{ id: number }>();
    if (!marcin) {
      await env.DB.prepare(
        "INSERT INTO staff (full_name, system_type, compensation, location, company, vacation, status, created_at, updated_at) VALUES ('Marcin Krawczyk', '2/2', '1750 € Netto', 'HAJ1', 'NAL LOGISTIK', '20.07–31.07', 'active', ?, ?)",
      ).bind(now, now).run();
    }
    await env.DB.prepare("UPDATE staff SET full_name=?, system_type='2/2', compensation='2000 € Netto', location=?, company=?, vacation='', status='active', updated_at=? WHERE id=?")
      .bind(driver.full_name, demoLocation, demoCompany, now, staff.id).run();
  } else if (!staff) {
    const byName = await env.DB.prepare("SELECT id FROM staff WHERE full_name=?").bind(driver.full_name).first<{ id: number }>();
    if (byName) {
      await env.DB.prepare("UPDATE staff SET user_id=?, system_type='2/2', compensation='2000 € Netto', location=?, company=?, vacation='', status='active', updated_at=? WHERE id=?")
        .bind(driver.id, demoLocation, demoCompany, now, byName.id).run();
      staff = { id: byName.id, full_name: driver.full_name };
    } else {
      const created = await env.DB.prepare(
        "INSERT INTO staff (user_id, full_name, system_type, compensation, location, company, vacation, status, created_at, updated_at) VALUES (?, ?, '2/2', '2000 € Netto', ?, ?, '', 'active', ?, ?)",
      ).bind(driver.id, driver.full_name, demoLocation, demoCompany, now, now).run();
      staff = { id: Number(created.meta.last_row_id), full_name: driver.full_name };
    }
  } else {
    await env.DB.prepare("UPDATE staff SET location=?, company=?, status='active', updated_at=? WHERE id=?")
      .bind(demoLocation, demoCompany, now, staff.id).run();
  }
  if (!staff) return;

  await env.DB.prepare("UPDATE vehicles SET assigned_staff_id=?, status='active', updated_at=? WHERE license_plate=?")
    .bind(staff.id, now, demoPlate).run();

  const existingPlan = await env.DB.prepare(
    "SELECT id FROM weekly_planning WHERE planning_year=? AND calendar_week=? AND (staff_id=? OR driver_name=? OR license_plate=?)",
  ).bind(demoYear, demoWeek, staff.id, driver.full_name, demoPlate).first<{ id: number }>();

  let planningId: number;
  if (existingPlan) {
    planningId = existingPlan.id;
    await env.DB.prepare(
      `UPDATE weekly_planning SET planning_year=?, calendar_week=?, company=?, staff_id=?, driver_name=?, location=?, license_plate=?, work_days='1,2,3,4,5,6,7', start_time='06:00', block_id=?, status='planned', comments='Demo-Einsatz', updated_at=? WHERE id=?`,
    ).bind(demoYear, demoWeek, demoCompany, staff.id, driver.full_name, demoLocation, demoPlate, demoBlock, now, planningId).run();
  } else {
    const created = await env.DB.prepare(
      `INSERT INTO weekly_planning (planning_year, calendar_week, company, staff_id, driver_name, location, license_plate, work_days, start_time, block_id, status, comments, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, '1,2,3,4,5,6,7', '06:00', ?, 'planned', 'Demo-Einsatz', ?, ?)`,
    ).bind(demoYear, demoWeek, demoCompany, staff.id, driver.full_name, demoLocation, demoPlate, demoBlock, now, now).run();
    planningId = Number(created.meta.last_row_id);
  }

  const eta = new Date(Date.now() + 4 * 3_600_000).toISOString();
  await env.DB.prepare(
    `INSERT INTO trip_operations (planning_id, status, pickup_address, delivery_address, eta, delay_reason, recipient_name, signature_name, started_at, loaded_at, delivered_at, updated_by, created_at, updated_at)
     VALUES (?, 'Unterwegs', 'Amazon HAJ1, Hannover', 'Amazon BER8, Berlin', ?, '', '', '', ?, ?, NULL, ?, ?, ?)
     ON CONFLICT(planning_id) DO UPDATE SET status='Unterwegs', pickup_address=excluded.pickup_address, delivery_address=excluded.delivery_address, eta=excluded.eta, started_at=COALESCE(trip_operations.started_at, excluded.started_at), loaded_at=COALESCE(trip_operations.loaded_at, excluded.loaded_at), updated_at=excluded.updated_at`,
  ).bind(planningId, eta, now, now, manager?.id || 1, now, now).run();

  await env.DB.prepare(
    `INSERT OR IGNORE INTO vehicle_fuel_codes (license_plate, fuel_type, code_value, active, updated_by, created_at, updated_at)
     VALUES (?, 'Diesel', 'MK4182-DEMO', 1, ?, ?, ?)`,
  ).bind(demoPlate, manager?.id || 1, now, now).run();

  const tracker = await env.DB.prepare("SELECT id FROM truck_trackers WHERE license_plate=?").bind(demoPlate).first<{ id: number }>();
  if (tracker?.id) {
    const recentPosition = await env.DB.prepare(
      "SELECT id FROM truck_positions WHERE license_plate=? AND datetime(recorded_at) > datetime('now', '-30 minutes') LIMIT 1",
    ).bind(demoPlate).first<{ id: number }>();
    if (!recentPosition) {
      const recordedAt = now;
      await env.DB.prepare(
        "INSERT INTO truck_positions (tracker_id, license_plate, latitude, longitude, speed_kph, heading, ignition, odometer_km, address, source, recorded_at, received_at) VALUES (?, ?, 52.375892, 9.732010, 68, 92, 1, 286410, 'A2 Richtung Berlin', 'demo', ?, ?)",
      ).bind(tracker.id, demoPlate, recordedAt, recordedAt).run();
      await env.DB.prepare("UPDATE truck_trackers SET last_connected_at=?, updated_at=? WHERE id=?").bind(recordedAt, recordedAt, tracker.id).run();
    }
  }

  const todayTacho = await env.DB.prepare(
    "SELECT id FROM tachograph_records WHERE staff_id=? AND license_plate=? AND record_date=date('now') LIMIT 1",
  ).bind(staff.id, demoPlate).first<{ id: number }>();
  if (!todayTacho) {
    await env.DB.prepare(
      "INSERT INTO tachograph_records (staff_id, license_plate, record_date, driving_minutes, rest_minutes, remaining_minutes, infringement, source, notes, created_at, updated_at) VALUES (?, ?, date('now'), 280, 45, 180, '', 'demo', 'Demo für Präsentation', ?, ?)",
    ).bind(staff.id, demoPlate, now, now).run();
  }
}
