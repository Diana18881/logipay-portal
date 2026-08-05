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
}
