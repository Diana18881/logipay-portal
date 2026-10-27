// End-to-end check of a driver's and the office's working day on a throwaway company.
// Usage: npm run test:e2e -- https://logipay-portal.vercel.app   (or a local dev server URL)
const BASE = (process.argv[2] || process.env.BASE || "http://localhost:3000").replace(/\/$/, "");
const stamp = Date.now().toString(36);
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok: Boolean(ok), detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };

class Client {
  constructor() { this.cookies = new Map(); }
  async req(path, init = {}) {
    const headers = new Headers(init.headers || {});
    if (this.cookies.size) headers.set("cookie", [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "));
    const response = await fetch(BASE + path, { ...init, headers, redirect: "manual" });
    for (const line of response.headers.getSetCookie?.() || []) {
      const [pair] = line.split(";"); const [k, ...v] = pair.split("="); this.cookies.set(k.trim(), v.join("="));
    }
    return response;
  }
  async json(path, body) {
    const r = await this.req(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  }
  async form(path, fields) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    const r = await this.req(path, { method: "POST", body: fd });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  }
  async portal(kw, year) { const r = await this.req(`/api/portal?kw=${kw}&year=${year}`); return { status: r.status, data: await r.json().catch(() => ({})) }; }
}

// Small real files
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWEXHbQEAEu8f/HV5mVBAAAAAElFTkSuQmCC", "base64");
const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
const audio = Buffer.alloc(2048, 7);
const file = (bytes, name, type) => new File([bytes], name, { type });

function isoWeek(date) {
  const t = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const d = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - d);
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return { year: t.getUTCFullYear(), week: Math.ceil(((t - y) / 86400000 + 1) / 7) };
}

const office = new Client();
const driver = new Client();
const { year, week } = isoWeek(new Date());
const today = new Date().toISOString().slice(0, 10);
const period = today.slice(0, 7);
const ownerEmail = `qa-${stamp}@qa-logipay.test`;
const driverEmail = `fahrer-${stamp}@qa-logipay.test`;
const companyName = `QA Test ${stamp}`;
const plate = `QA-${stamp.slice(-4).toUpperCase()} 1`;

try {
  let r = await office.json("/api/auth/register", { companyName, fullName: "Olga Office", email: ownerEmail, password: "QaOffice-12345", acceptTerms: true });
  check("Firma registrieren", r.status === 201, `HTTP ${r.status} ${r.data.error || ""}`);

  r = await office.json("/api/portal", { action: "addStaff", fullName: "Dmitri Driver", personnelNumber: "1001", company: companyName, location: "Hamburg", compensation: "2400 € Netto", systemType: "5/2", loginEmail: driverEmail, loginPassword: "QaDriver-12345" });
  check("Fahrer anlegen (mit Login)", r.status === 200, r.data.error);
  r = await office.json("/api/portal", { action: "addVehicle", licensePlate: plate, company: companyName, location: "Hamburg", status: "active" });
  check("Fahrzeug anlegen", r.status === 200, r.data.error);
  r = await office.json("/api/portal", { action: "addPlanning", planningYear: year, calendarWeek: week, driverName: "Dmitri Driver", licensePlate: plate, company: "Kunde Nord", location: "Hamburg", workDays: "1,2,3,4,5,6,7", startTime: "06:00", blockId: "QA-1" });
  check("Tour planen (diese Woche)", r.status === 200, r.data.error);

  r = await driver.json("/api/auth/login", { email: driverEmail, password: "QaDriver-12345" });
  check("Fahrer-Login ohne Code", r.status === 200, `HTTP ${r.status} ${r.data.error || ""}`);
  let p = await driver.portal(week, year);
  const plan = p.data.planning?.[0];
  const trip = p.data.tripOperations?.[0];
  check("Fahrer sieht seine Tour", p.status === 200 && plan && trip, `Touren: ${p.data.planning?.length ?? "?"}`);
  check("Fahrer sieht nur sich selbst", p.data.staff?.length === 1, `Mitarbeiter sichtbar: ${p.data.staff?.length}`);

  r = await driver.json("/api/portal", { action: "confirmDeparture", planningId: plan?.id, shiftDate: today });
  check("Abfahrt bestätigen", r.status === 200, r.data.error);
  r = await driver.json("/api/portal", { action: "saveChecklist", planningId: plan?.id, licensePlate: plate, phase: "Vor Fahrt", checksJson: JSON.stringify({ reifen: true, licht: true, warnweste: true }), damageNotes: "" });
  check("Fahrzeugcheck speichern", r.status === 200, r.data.error);
  r = await driver.json("/api/portal", { action: "saveTripOperation", planningId: plan?.id, status: "Unterwegs", pickupAddress: "Lager Hamburg", deliveryAddress: "Kunde Bremen", eta: new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 16), delayReason: "", recipientName: "", signatureName: "" });
  check("Tourstatus „Unterwegs“ setzen", r.status === 200, r.data.error);

  r = await driver.form("/api/trip-documents", { tripOperationId: String(trip?.id), category: "Lieferschein", file: file(png, "lieferschein.png", "image/png") });
  check("Foto Lieferschein hochladen", r.status === 200 || r.status === 201, `HTTP ${r.status} ${r.data.error || ""}`);
  r = await driver.form("/api/expense-receipts", { licensePlate: plate, expenseDate: today, category: "Parken", merchant: "Parkhaus", grossAmount: "12.50", vatAmount: "2.00", paymentMethod: "Privatauslage", reimbursable: "1", file: file(png, "beleg.png", "image/png") });
  check("Beleg-Foto hochladen", r.status === 200 || r.status === 201, `HTTP ${r.status} ${r.data.error || ""}`);
  r = await driver.form("/api/fuel-stops", { licensePlate: plate, station: "Tankstelle Süd", refueledAt: new Date().toISOString().slice(0, 16), odometerKm: "123456", dieselLiters: "120", adblueLiters: "10", grossAmount: "210.40", stationPhoto: file(png, "station.png", "image/png"), dieselPhoto: file(png, "diesel.png", "image/png"), adbluePhoto: file(png, "adblue.png", "image/png"), receiptPhoto: file(png, "quittung.png", "image/png") });
  check("Tankvorgang mit 4 Fotos", r.status === 200 || r.status === 201, `HTTP ${r.status} ${r.data.error || ""}`);
  r = await driver.form("/api/voice-messages", { licensePlate: plate, durationSeconds: "3", note: "Test", file: file(audio, "sprach.webm", "audio/webm") });
  check("Sprachnachricht senden", r.status === 200 || r.status === 201, `HTTP ${r.status} ${r.data.error || ""}`);
  r = await driver.form("/api/trip-chat", { tripOperationId: String(trip?.id), body: "Bin an der Rampe 4.", locale: "de" });
  check("Tour-Chat: Fahrer schreibt", r.status === 200 || r.status === 201, `HTTP ${r.status} ${r.data.error || ""}`);
  r = await driver.form("/api/trip-chat", { tripOperationId: String(trip?.id), locale: "de", file: file(png, "rampe.png", "image/png") });
  check("Tour-Chat: Fahrer sendet Foto", r.status === 200 || r.status === 201, `HTTP ${r.status} ${r.data.error || ""}`);
  r = await driver.json("/api/portal", { action: "driverConcern", itemName: "Scheibenwischer", truckNumber: plate, planningYear: year, calendarWeek: week });
  check("Anliegen melden", r.status === 200, r.data.error);

  // Office side
  p = await office.portal(week, year);
  const ownerId = p.data.user?.id;
  const msgs = p.data.tripMessages || [];
  check("Büro sieht Chat-Nachricht + Foto", msgs.length >= 2, `${msgs.length} Nachrichten`);
  check("Büro sieht Lieferschein", (p.data.tripDocuments || []).length >= 1);
  check("Büro sieht Beleg + Tankbeleg", (p.data.expenses || []).length >= 2, `${(p.data.expenses || []).length} Ausgaben`);
  check("Büro sieht Tankvorgang", (p.data.fuelStops || []).length >= 1);
  check("Büro sieht Sprachnachricht", (p.data.voiceMessages || []).length >= 1);
  check("Büro sieht Anliegen", (p.data.concerns || []).length >= 1);
  check("Abfahrt beim Büro bestätigt", (p.data.departureConfirmations || []).length >= 1);
  check("Fahrzeugcheck beim Büro", (p.data.checklists || []).length >= 1);
  check("Meldungen erzeugt", (p.data.notifications || []).length >= 1, `${(p.data.notifications || []).length} Meldungen`);

  const doc = (p.data.tripDocuments || [])[0];
  let file1 = doc ? await office.req(`/api/trip-documents/${doc.id}`) : null;
  const bytes1 = file1 ? Buffer.from(await file1.arrayBuffer()) : Buffer.alloc(0);
  check("Lieferschein-Foto öffnen (Datei identisch)", file1?.status === 200 && bytes1.equals(png), `HTTP ${file1?.status} ${bytes1.length} Bytes`);
  const expense = (p.data.expenses || []).find((e) => e.receipt_object_key);
  file1 = expense ? await office.req(`/api/expense-receipts/${expense.id}`) : null;
  check("Beleg-Foto öffnen", file1?.status === 200, `HTTP ${file1?.status}`);
  const photoMsg = msgs.find((m) => m.message_type === "photo");
  file1 = photoMsg ? await office.req(`/api/trip-chat/${photoMsg.id}/attachment`) : null;
  check("Chat-Foto öffnen", file1?.status === 200, `HTTP ${file1?.status}`);
  const voice = (p.data.voiceMessages || [])[0];
  file1 = voice ? await office.req(`/api/voice-messages/${voice.id}`) : null;
  check("Sprachnachricht abspielen", file1?.status === 200, `HTTP ${file1?.status}`);

  r = await office.form("/api/trip-chat", { tripOperationId: String(trip?.id), body: "Danke, bitte Lieferschein schicken.", locale: "de" });
  check("Tour-Chat: Büro antwortet", r.status === 200 || r.status === 201, r.data.error);
  p = await driver.portal(week, year);
  check("Fahrer sieht Antwort", (p.data.tripMessages || []).some((m) => String(m.body).startsWith("Danke")));
  r = await driver.form("/api/direct-chat", { recipientUserId: String(ownerId), body: "Direkte Nachricht an Büro", locale: "de" });
  check("Direkt-Chat Fahrer → Büro", r.status === 200 || r.status === 201, `HTTP ${r.status} ${r.data.error || ""}`);
  p = await office.portal(week, year);
  check("Büro bekommt Direkt-Nachricht", (p.data.directMessages || []).some((m) => m.body === "Direkte Nachricht an Büro"));
  const staffId = p.data.staff?.[0]?.id;

  r = await office.json("/api/portal", { action: "updateExpenseStatus", id: expense?.id, status: "Freigegeben" });
  check("Beleg freigeben", r.status === 200, r.data.error);
  r = await office.form("/api/employee-documents", { staffId: String(staffId), category: "Führerschein", expiresAt: new Date(Date.now() + 20 * 86400e3).toISOString().slice(0, 10), file: file(pdf, "fuehrerschein.pdf", "application/pdf") });
  check("Führerschein hochladen (mit Ablauf)", r.status === 200 || r.status === 201, `HTTP ${r.status} ${r.data.error || ""}`);
  r = await office.json("/api/portal", { action: "addAbsence", staffId, startDate: today, endDate: today, absenceType: "vacation", note: "QA" });
  check("Urlaub eintragen", r.status === 200, r.data.error);
  r = await office.json("/api/portal", { action: "calculatePayrollPeriod", period, countPlanned: true });
  check("Lohn für den Monat berechnen", r.status === 200, r.data.error);
  r = await office.form("/api/documents", { staffId: String(staffId), period, file: file(pdf, "lohn.pdf", "application/pdf") });
  check("Lohnabrechnung (PDF) hochladen", r.status === 200 || r.status === 201, `HTTP ${r.status} ${r.data.error || ""}`);
  r = await office.json("/api/payroll/datev", { consultant: "1234567", client: "12345" });
  check("DATEV-Einstellungen speichern", r.status === 200, r.data.error);
  const datev = await office.req(`/api/payroll/datev?period=${period}`);
  const datevText = await datev.text();
  check("DATEV-Datei erzeugen", datev.status === 200 && datevText.includes("[Bewegungsdaten]") && datevText.includes(";1001;"), `HTTP ${datev.status} ${datevText.slice(0, 60).replace(/\s+/g, " ")}`);

  p = await driver.portal(week, year);
  const salaryDoc = (p.data.documents || [])[0];
  file1 = salaryDoc ? await driver.req(`/api/documents/${salaryDoc.id}`) : null;
  check("Fahrer lädt Lohnabrechnung", file1?.status === 200, `HTTP ${file1?.status}`);
  const empDoc = (p.data.employeeDocuments || [])[0];
  file1 = empDoc ? await driver.req(`/api/employee-documents/${empDoc.id}`) : null;
  check("Fahrer öffnet eigenen Führerschein", file1?.status === 200, `HTTP ${file1?.status}`);

  const push = await (await driver.req("/api/push")).json().catch(() => ({}));
  check("Push-Schlüssel vorhanden", Boolean(push.publicKey), push.publicKey ? "VAPID ok" : "fehlt");
  r = await driver.json("/api/push", { subscription: { endpoint: `https://example.invalid/push/${stamp}`, keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" } } });
  check("Push-Abo speichern", r.status === 200, r.data.error);

  // Invitation link: driver sets own password
  r = await office.json("/api/portal", { action: "addStaff", fullName: "Ina Invite", company: companyName });
  p = await office.portal(week, year);
  const invitee = (p.data.staff || []).find((row) => row.full_name === "Ina Invite");
  const invite = await office.json("/api/invitations", { staffId: invitee?.id, email: `ina-${stamp}@qa-logipay.test` });
  check("Einladungslink erstellen", invite.status === 200 && invite.data.link, invite.data.error);
  const inviteToken = String(invite.data.link || "").split("/einladung/")[1]?.replace("-", ".");
  const page = await new Client().req(`/einladung/${String(invite.data.link || "").split("/einladung/")[1]}`);
  check("Einladungsseite öffnet", page.status === 200, `HTTP ${page.status}`);
  const invited = new Client();
  r = await invited.json("/api/auth/accept-invite", { token: inviteToken, password: "QaInvite-12345" });
  check("Fahrer legt Passwort per Link fest", r.status === 200, r.data.error);
  r = await new Client().json("/api/auth/accept-invite", { token: inviteToken, password: "QaInvite-12345" });
  check("Link ist nur einmal gültig", r.status === 410);

  // Excel import (rows as the import dialog sends them)
  r = await office.json("/api/portal", { action: "importVehicles", rows: JSON.stringify([{ licensePlate: `qa-im ${stamp.slice(-3)}`, location: "Kiel" }, { licensePlate: plate }]) });
  check("Excel-Import Fahrzeuge (ohne Doppelte)", r.status === 200 && r.data.imported === 1 && r.data.skipped === 1, JSON.stringify(r.data));

  // One-click demo is view-only
  const demo = new Client();
  const demoStart = await demo.req("/api/auth/demo");
  check("Demo mit einem Klick", demoStart.status === 302 && demo.cookies.has("logipay_session"), `HTTP ${demoStart.status}`);
  r = await demo.json("/api/portal", { action: "addVehicle", licensePlate: "DEMO-X 1" });
  check("Demo kann nichts ändern", r.status === 403, `HTTP ${r.status}`);

  const exp = await office.req("/api/company/export");
  check("Datenexport (DSGVO)", exp.status === 200);
} catch (error) {
  check("Unerwarteter Fehler", false, String(error?.stack || error).slice(0, 300));
} finally {
  const r = await office.json("/api/company/delete", { confirmName: companyName });
  check("Testfirma wieder löschen", r.status === 200, r.data.error);
  const failed = results.filter((x) => !x.ok);
  console.log(`\n${results.length - failed.length}/${results.length} bestanden`);
}
