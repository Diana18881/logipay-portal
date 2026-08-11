import { env } from "cloudflare:workers";

const drivers = [
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
      `CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, action TEXT NOT NULL, entity_id TEXT, details TEXT, created_at TEXT NOT NULL)`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS vehicle_files (id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id INTEGER, license_plate TEXT NOT NULL, category TEXT NOT NULL, file_name TEXT NOT NULL, object_key TEXT NOT NULL UNIQUE, content_type TEXT NOT NULL, notes TEXT, created_at TEXT NOT NULL)`,
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
      `CREATE TABLE IF NOT EXISTS trip_documents (id INTEGER PRIMARY KEY AUTOINCREMENT, trip_operation_id INTEGER NOT NULL, staff_id INTEGER, category TEXT NOT NULL, file_name TEXT NOT NULL, object_key TEXT NOT NULL UNIQUE, content_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, created_at TEXT NOT NULL)`,
    ),
    env.DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_trip_documents_trip ON trip_documents(trip_operation_id, category)`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS expenses (id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id INTEGER NOT NULL, license_plate TEXT NOT NULL, expense_date TEXT NOT NULL, category TEXT NOT NULL, merchant TEXT, gross_amount REAL NOT NULL DEFAULT 0, vat_amount REAL NOT NULL DEFAULT 0, liters REAL, odometer_km REAL, status TEXT NOT NULL DEFAULT 'Eingereicht', receipt_file_name TEXT, receipt_object_key TEXT UNIQUE, receipt_content_type TEXT, recognition_status TEXT NOT NULL DEFAULT 'Prüfen', notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
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
        "Marcin Krawczyk",
        "HAJ1",
        "B-ML 4182",
        "vacation",
        "Urlaub 20.07–31.07",
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
  await env.DB.prepare(
    "UPDATE staff SET user_id=(SELECT id FROM users WHERE email='driver@logipay.demo') WHERE full_name='Marcin Krawczyk' AND user_id IS NULL",
  ).run();
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
  ]);
  await env.DB.prepare("PRAGMA optimize").run();
}
