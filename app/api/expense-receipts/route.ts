import { env } from "@logipay/env";
import { requirePortalUser } from "../../../lib/auth";
import { ensureDomainDatabase } from "../../../lib/domain";

const categories = new Set(["Kraftstoff", "AdBlue", "Maut", "Parken", "Waschanlage", "Reparatur", "Hotel", "Verpflegung", "Taxi", "Büromaterial", "Sonstige Auslage"]);
const paymentMethods = new Set(["Privatauslage", "Firmenkarte", "Tankkarte", "Bar"]);

export async function POST(request: Request) {
  const user = await requirePortalUser(["management", "accountant", "driver"]);
  await ensureDomainDatabase();
  const form = await request.formData();
  const file = form.get("file");
  let staffId = Number(form.get("staffId") || 0);
  const licensePlate = String(form.get("licensePlate") || "OHNE FAHRZEUG").trim() || "OHNE FAHRZEUG";
  const category = String(form.get("category") || "");
  const paymentMethod = String(form.get("paymentMethod") || "Privatauslage");
  let scanResult: Record<string, string | number | null> = {};
  try { scanResult = JSON.parse(String(form.get("scanResult") || "{}")) as Record<string, string | number | null>; } catch { scanResult = {}; }
  if (user.role === "driver") {
    const own = await env.DB.prepare("SELECT id FROM staff WHERE user_id=? AND status='active'").bind(user.id).first<{ id: number }>();
    staffId = own?.id || 0;
    if (licensePlate !== "OHNE FAHRZEUG") {
      const assigned = await env.DB.prepare("SELECT 1 FROM weekly_planning WHERE staff_id=? AND license_plate=? LIMIT 1").bind(staffId, licensePlate).first();
      if (!assigned) return Response.json({ error: "Fahrzeug ist Ihnen nicht zugeteilt" }, { status: 403 });
    }
  }
  if (!(file instanceof File) || !staffId || !categories.has(category) || !paymentMethods.has(paymentMethod))
    return Response.json({ error: "Fahrer, Kategorie, Zahlungsart und Beleg sind erforderlich" }, { status: 400 });
  if (!file.type.startsWith("image/") && file.type !== "application/pdf")
    return Response.json({ error: "Nur Foto oder PDF" }, { status: 400 });
  if (file.size > 15 * 1024 * 1024)
    return Response.json({ error: "Maximal 15 MB" }, { status: 400 });

  const fileDate = file.name.match(/(20\d{2})[-_.](\d{2})[-_.](\d{2})/);
  const fileAmount = file.name.match(/(\d{1,5}[,.]\d{2})(?:\s?EUR|\s?EURO|\s?€)/i);
  const expenseDate = String(form.get("expenseDate") || scanResult.date || "") || (fileDate ? `${fileDate[1]}-${fileDate[2]}-${fileDate[3]}` : new Date().toISOString().slice(0, 10));
  const grossAmount = Number(String(form.get("grossAmount") || scanResult.grossAmount || fileAmount?.[1] || "0").replace(",", "."));
  const vatAmount = Number(String(form.get("vatAmount") || scanResult.vatAmount || "0").replace(",", "."));
  if (!Number.isFinite(grossAmount) || grossAmount <= 0 || !Number.isFinite(vatAmount) || vatAmount < 0 || vatAmount > grossAmount)
    return Response.json({ error: "Betrag oder MwSt. ist ungültig" }, { status: 400 });
  const reimbursable = String(form.get("reimbursable") || (paymentMethod === "Privatauslage" ? "1" : "0")) === "1";
  const requestedReimbursement = Number(String(form.get("reimbursementAmount") || (reimbursable ? grossAmount : 0)).replace(",", "."));
  if (!Number.isFinite(requestedReimbursement) || requestedReimbursement < 0 || requestedReimbursement > grossAmount)
    return Response.json({ error: "Erstattungsbetrag muss zwischen 0 und dem Bruttobetrag liegen" }, { status: 400 });
  const reimbursementAmount = reimbursable ? requestedReimbursement : 0;
  const key = `belege/${staffId}/${expenseDate}/${crypto.randomUUID()}`;
  await env.DOCUMENTS.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type }, customMetadata: { originalName: file.name } });
  const now = new Date().toISOString();
  const recognitionStatus = String(scanResult.status || (fileDate || fileAmount ? "Automatisch vorerfasst" : "Prüfen"));
  const result = await env.DB.prepare(
    "INSERT INTO expenses (staff_id, license_plate, expense_date, category, merchant, gross_amount, vat_amount, liters, odometer_km, payment_method, reimbursable, reimbursement_amount, amazon_site, block_id, tour_reference, cost_center, receipt_number, status, receipt_file_name, receipt_object_key, receipt_content_type, recognition_status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Eingereicht', ?, ?, ?, ?, ?, ?, ?)",
  ).bind(staffId, licensePlate, expenseDate, category, String(form.get("merchant") || scanResult.merchant || ""), grossAmount, vatAmount, form.get("liters") ? Number(form.get("liters")) : null, form.get("odometerKm") ? Number(form.get("odometerKm")) : null, paymentMethod, reimbursable ? 1 : 0, reimbursementAmount, String(form.get("amazonSite") || ""), String(form.get("blockId") || ""), String(form.get("tourReference") || ""), String(form.get("costCenter") || ""), String(form.get("receiptNumber") || scanResult.documentNumber || ""), file.name, key, file.type, recognitionStatus, String(form.get("notes") || ""), now, now).run();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO notifications (role_scope, category, title, message, entity_type, entity_id, severity, created_at) VALUES ('accountant', 'expense', 'Neue Ausgabe zur Prüfung', ?, 'expense', ?, 'info', ?)").bind(`${licensePlate}: ${grossAmount.toFixed(2)} € · ${category}${reimbursable ? ` · Erstattung ${reimbursementAmount.toFixed(2)} €` : ""}`, String(result.meta.last_row_id), now),
    env.DB.prepare("INSERT INTO audit_log (user_id, action, entity_id, details, created_at) VALUES (?, 'uploadExpenseReceipt', ?, ?, ?)").bind(user.id, String(result.meta.last_row_id), JSON.stringify({ staffId, licensePlate, expenseDate, category, grossAmount, vatAmount, paymentMethod, reimbursable, reimbursementAmount, amazonSite: form.get("amazonSite"), blockId: form.get("blockId"), costCenter: form.get("costCenter"), recognitionStatus, scanResult }), now),
  ]);
  return Response.json({ ok: true, id: result.meta.last_row_id, recognitionStatus });
}
