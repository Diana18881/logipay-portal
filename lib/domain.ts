import { env } from "cloudflare:workers";

const drivers = [
  ["Marcin Krawczyk", "2/2", "1750 € Netto", "HAJ1", "NAL LOGISTIK", "20.07–31.07"],
  ["Krzysztof Andrzej Ostap", "2/1", "2000–2200 € Netto", "BER8", "EuRide", ""],
  ["Osych Robert", "2/1", "2000–2200 € Netto", "BER8", "EVEREST", ""],
  ["Patryk Brzezinski", "2/1", "2300–2400 € Netto", "BER8 / HAJ1", "EVEREST", ""],
  ["Piotr Sekowski", "2/1", "2300–2400 € Netto", "BER8 / HAJ1", "EVEREST", ""],
  ["Andrzej Stanislaw Nazarewicz", "2/2", "1500 € Netto", "BER8", "EVEREST", ""],
  ["Krzysztof Szafer", "2/1", "2300–2400 € Netto", "BER8 / HAJ1", "EVEREST", ""],
  ["Wojciech Kaiser", "2/1", "2000–2200 € Netto", "BER8", "EuRide", ""],
  ["Patryk Karwecki", "2/1", "2300–2400 € Netto", "BER8 / HAJ1", "EVEREST", ""],
  ["Dariusz Radoslaw Raczynski", "SPRINGER", "3300 € Netto", "ALLE", "EuRide", ""],
  ["Lukasz Swiatlowski", "SPRINGER", "3300 € Netto", "ALLE", "ALMAZ", "31.08–07.09"],
  ["Grzegorz Swiatlowski", "SPRINGER", "3300 € Netto", "ALLE", "ALMAZ", "31.08–07.09"],
  ["Farhad Tabatabaie", "SPRINGER", "3300 € Netto", "ALLE", "SF", ""],
  ["Valentyn Haivaniuk", "SPRINGER", "3300 € Netto", "ALLE", "EuRide", ""],
  ["Piotr Wiosna", "2/2", "1500 € Netto", "BER8", "EVEREST", ""],
  ["Jakub Szymanek", "2/1", "2000–2200 € Netto", "BER8", "EVEREST", ""],
  ["Szymon Koput", "2/2", "2000 € Netto", "ALLE", "N&O", ""],
];

export async function ensureDomainDatabase() {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS staff (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, full_name TEXT NOT NULL, system_type TEXT, compensation TEXT, location TEXT, company TEXT, vacation TEXT, status TEXT NOT NULL DEFAULT 'active', hired_at TEXT, terminated_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS vehicles (id INTEGER PRIMARY KEY AUTOINCREMENT, license_plate TEXT NOT NULL UNIQUE, company TEXT, location TEXT, status TEXT NOT NULL DEFAULT 'active', assigned_staff_id INTEGER, inspection_due TEXT, notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS weekly_planning (id INTEGER PRIMARY KEY AUTOINCREMENT, calendar_week INTEGER NOT NULL, company TEXT NOT NULL, staff_id INTEGER, driver_name TEXT, location TEXT, license_plate TEXT, block_id TEXT, status TEXT NOT NULL DEFAULT 'planned', comments TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS salary_documents (id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id INTEGER NOT NULL, period TEXT NOT NULL, file_name TEXT NOT NULL, object_key TEXT NOT NULL UNIQUE, content_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, uploaded_by INTEGER NOT NULL, created_at TEXT NOT NULL)`),
  ]);
  const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM staff").first<{ count: number }>();
  if (!count?.count) {
    const now = new Date().toISOString();
    await env.DB.batch(drivers.map((d) => env.DB.prepare("INSERT INTO staff (full_name, system_type, compensation, location, company, vacation, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)").bind(...d, now, now)));
    const vehicles = [["B-CY 3603","EuRide","BER8","active",""],["KR-QG 237","EVEREST","BER8","active",""],["B-YL 7868","ALMAZ","HAJ1","workshop","Werkstatt / TÜV-SP prüfen"],["B-ML 4182","NAL LOGISTIK","HAJ1","active",""],["B-RS 9120","SF","PAD1","reserve","Ersatzfahrzeug"]];
    await env.DB.batch(vehicles.map((v) => env.DB.prepare("INSERT OR IGNORE INTO vehicles (license_plate, company, location, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(...v, now, now)));
    const plans = [[32,"EuRide","Krzysztof Andrzej Ostap","BER8","B-CY 3603","planned",""],[32,"EVEREST","Osych Robert","BER8","KR-QG 237","planned",""],[32,"ALMAZ","Lukasz Swiatlowski","HAJ1","B-YL 7868","attention","Werkstatttermin / TÜV"],[32,"NAL LOGISTIK","Marcin Krawczyk","HAJ1","B-ML 4182","vacation","Urlaub 20.07–31.07"]];
    await env.DB.batch(plans.map((p) => env.DB.prepare("INSERT INTO weekly_planning (calendar_week, company, driver_name, location, license_plate, status, comments, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(...p, now, now)));
  }
}
