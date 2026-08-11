import { env } from "cloudflare:workers";
import { requirePortalUser } from "../../../lib/auth";
import { ensureDomainDatabase } from "../../../lib/domain";

const categories = new Set(["CMR", "Lieferschein", "Ladung", "Zustellung", "Unterschrift", "Sonstiges"]);

export async function POST(request: Request) {
  const user = await requirePortalUser(["management", "dispatcher", "driver"]);
  await ensureDomainDatabase();
  const form = await request.formData();
  const file = form.get("file");
  const tripOperationId = Number(form.get("tripOperationId") || 0);
  const category = String(form.get("category") || "");
  if (!(file instanceof File) || !tripOperationId || !categories.has(category))
    return Response.json({ error: "Einsatz, Dokumentart und Datei sind erforderlich" }, { status: 400 });
  if (!file.type.startsWith("image/") && file.type !== "application/pdf")
    return Response.json({ error: "Nur Foto oder PDF" }, { status: 400 });
  if (file.size > 15 * 1024 * 1024) return Response.json({ error: "Maximal 15 MB" }, { status: 400 });
  const trip = await env.DB.prepare("SELECT o.id, p.staff_id, p.driver_name, p.license_plate, s.user_id FROM trip_operations o JOIN weekly_planning p ON p.id=o.planning_id LEFT JOIN staff s ON s.id=p.staff_id WHERE o.id=?").bind(tripOperationId).first<{ id: number; staff_id: number | null; driver_name: string | null; license_plate: string | null; user_id: number | null }>();
  if (!trip) return Response.json({ error: "Einsatz nicht gefunden" }, { status: 404 });
  if (user.role === "driver" && trip.user_id !== user.id && trip.driver_name !== user.fullName)
    return Response.json({ error: "Dieser Einsatz ist Ihnen nicht zugeteilt" }, { status: 403 });
  const key = `einsatz/${tripOperationId}/${category}/${crypto.randomUUID()}`;
  await env.DOCUMENTS.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type }, customMetadata: { originalName: file.name } });
  const now = new Date().toISOString();
  const result = await env.DB.prepare("INSERT INTO trip_documents (trip_operation_id, staff_id, category, file_name, object_key, content_type, size_bytes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(tripOperationId, trip.staff_id, category, file.name, key, file.type, file.size, now).run();
  await env.DB.prepare("INSERT INTO audit_log (user_id, action, entity_id, details, created_at) VALUES (?, 'uploadTripDocument', ?, ?, ?)").bind(user.id, String(result.meta.last_row_id), JSON.stringify({ tripOperationId, category, licensePlate: trip.license_plate, fileName: file.name }), now).run();
  return Response.json({ ok: true });
}
