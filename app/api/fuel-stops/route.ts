import { env } from "@logipay/env";
import { requirePortalUser } from "../../../lib/auth";
import { ensureDomainDatabase } from "../../../lib/domain";

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const fileFields = ["stationPhoto", "dieselPhoto", "adbluePhoto", "receiptPhoto"] as const;

export async function POST(request: Request) {
  const user = await requirePortalUser(["driver"]);
  await ensureDomainDatabase();
  const form = await request.formData();
  const licensePlate = String(form.get("licensePlate") || "").trim();
  const station = String(form.get("station") || "").trim();
  const refueledAt = String(form.get("refueledAt") || "").trim();
  const odometerKm = Number(form.get("odometerKm"));
  const dieselLiters = Number(form.get("dieselLiters") || 0);
  const adblueLiters = Number(form.get("adblueLiters") || 0);
  const grossAmount = Number(form.get("grossAmount") || 0);
  if (!licensePlate || !station || !refueledAt || !Number.isFinite(odometerKm) || odometerKm <= 0)
    return Response.json({ error: "Kennzeichen, Tankstelle, Datum und Kilometerstand sind erforderlich" }, { status: 400 });
  if (![dieselLiters, adblueLiters, grossAmount].every((value) => Number.isFinite(value) && value >= 0) || dieselLiters + adblueLiters <= 0)
    return Response.json({ error: "Diesel- oder AdBlue-Menge sowie Betrag prüfen" }, { status: 400 });
  const files = Object.fromEntries(fileFields.map((field) => [field, form.get(field)])) as Record<(typeof fileFields)[number], FormDataEntryValue | null>;
  for (const field of fileFields) {
    const file = files[field];
    if (!(file instanceof File) || !file.type.startsWith("image/"))
      return Response.json({ error: "Vier Fotos sind Pflicht: LKW an der Tankstelle, Diesel, AdBlue und Beleg" }, { status: 400 });
    if (file.size > MAX_FILE_SIZE)
      return Response.json({ error: "Jedes Foto darf maximal 15 MB groß sein" }, { status: 400 });
  }
  const staff = await env.DB.prepare("SELECT id FROM staff WHERE user_id=? AND status='active'")
    .bind(user.id).first<{ id: number }>();
  if (!staff) return Response.json({ error: "Fahrerprofil ist nicht verknüpft" }, { status: 409 });
  const assigned = await env.DB.prepare(
    "SELECT 1 FROM weekly_planning WHERE staff_id=? AND license_plate=? LIMIT 1",
  ).bind(staff.id, licensePlate).first();
  if (!assigned) return Response.json({ error: "Fahrzeug ist Ihnen nicht zugeteilt" }, { status: 403 });

  const stopId = crypto.randomUUID();
  const stored = {} as Record<(typeof fileFields)[number], { file: File; key: string }>;
  let expenseId = 0;
  let fuelStopId = 0;
  try {
    for (const field of fileFields) {
      const file = files[field] as File;
      const key = `tankvorgaenge/${licensePlate}/${stopId}/${field}`;
      await env.DOCUMENTS.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
      stored[field] = { file, key };
    }
    const now = new Date().toISOString();
    const expense = await env.DB.prepare(
      `INSERT INTO expenses (staff_id, license_plate, expense_date, category, merchant, gross_amount, vat_amount, liters, odometer_km, payment_method, reimbursable, reimbursement_amount, status, receipt_file_name, receipt_object_key, receipt_content_type, recognition_status, notes, created_at, updated_at)
       VALUES (?, ?, ?, 'Kraftstoff / AdBlue', ?, ?, 0, ?, ?, 'Firmenkarte', 0, 0, 'Eingereicht', ?, ?, ?, 'Prüfen', ?, ?, ?)`,
    ).bind(staff.id, licensePlate, refueledAt.slice(0, 10), station, grossAmount, dieselLiters + adblueLiters, odometerKm, stored.receiptPhoto.file.name, stored.receiptPhoto.key, stored.receiptPhoto.file.type, String(form.get("notes") || ""), now, now).run();
    expenseId = Number(expense.meta.last_row_id);
    const result = await env.DB.prepare(
      `INSERT INTO fuel_stops (staff_id, license_plate, station, refueled_at, odometer_km, diesel_liters, adblue_liters, gross_amount, status, station_file_name, station_object_key, station_content_type, diesel_file_name, diesel_object_key, diesel_content_type, adblue_file_name, adblue_object_key, adblue_content_type, receipt_file_name, receipt_object_key, receipt_content_type, expense_id, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Eingereicht', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      staff.id, licensePlate, station, refueledAt, odometerKm, dieselLiters, adblueLiters, grossAmount,
      stored.stationPhoto.file.name, stored.stationPhoto.key, stored.stationPhoto.file.type,
      stored.dieselPhoto.file.name, stored.dieselPhoto.key, stored.dieselPhoto.file.type,
      stored.adbluePhoto.file.name, stored.adbluePhoto.key, stored.adbluePhoto.file.type,
      stored.receiptPhoto.file.name, stored.receiptPhoto.key, stored.receiptPhoto.file.type,
      expenseId, String(form.get("notes") || ""), now, now,
    ).run();
    fuelStopId = Number(result.meta.last_row_id);
    await env.DB.batch([
      env.DB.prepare("INSERT INTO notifications (role_scope, category, title, message, entity_type, entity_id, severity, created_at) VALUES ('accountant', 'fuel', 'Neuer Tankvorgang', ?, 'fuel_stop', ?, 'warning', ?)")
        .bind(`${licensePlate} · ${station} · ${grossAmount.toFixed(2)} €`, String(fuelStopId), now),
      env.DB.prepare("INSERT INTO notifications (role_scope, category, title, message, entity_type, entity_id, severity, created_at) VALUES ('dispatcher', 'fuel', 'Tanknachweis vollständig', ?, 'fuel_stop', ?, 'info', ?)")
        .bind(`${licensePlate}: 4 Fotos und Kilometerstand ${Math.round(odometerKm).toLocaleString("de-DE")} km`, String(fuelStopId), now),
      env.DB.prepare("INSERT INTO audit_log (user_id, action, entity_id, details, created_at) VALUES (?, 'submitFuelStop', ?, ?, ?)")
        .bind(user.id, String(fuelStopId), JSON.stringify({ licensePlate, station, refueledAt, odometerKm, dieselLiters, adblueLiters, grossAmount }), now),
    ]);
    return Response.json({ ok: true, id: fuelStopId });
  } catch (error) {
    if (fuelStopId) await env.DB.prepare("DELETE FROM fuel_stops WHERE id=?").bind(fuelStopId).run();
    if (expenseId) await env.DB.prepare("DELETE FROM expenses WHERE id=?").bind(expenseId).run();
    await Promise.all(Object.values(stored).map((entry) => env.DOCUMENTS.delete(entry.key)));
    console.error("fuel-stop-upload", error);
    return Response.json({ error: "Tankvorgang konnte nicht gespeichert werden" }, { status: 500 });
  }
}
