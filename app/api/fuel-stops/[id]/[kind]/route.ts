import { env } from "@logipay/env";
import { requirePortalUser } from "../../../../../lib/auth";
import { ensureDomainDatabase } from "../../../../../lib/domain";

const columns = {
  station: ["station_object_key", "station_content_type", "station_file_name"],
  diesel: ["diesel_object_key", "diesel_content_type", "diesel_file_name"],
  adblue: ["adblue_object_key", "adblue_content_type", "adblue_file_name"],
  receipt: ["receipt_object_key", "receipt_content_type", "receipt_file_name"],
} as const;

export async function GET(_: Request, context: { params: Promise<{ id: string; kind: string }> }) {
  const user = await requirePortalUser(["management", "accountant", "dispatcher", "driver"]);
  await ensureDomainDatabase();
  const { id, kind } = await context.params;
  const selection = columns[kind as keyof typeof columns];
  if (!selection) return new Response("Not found", { status: 404 });
  const row = await env.DB.prepare("SELECT * FROM fuel_stops WHERE id=?").bind(id).first<Record<string, string | number>>();
  if (!row) return new Response("Not found", { status: 404 });
  if (user.role === "driver") {
    const staff = await env.DB.prepare("SELECT id FROM staff WHERE user_id=?").bind(user.id).first<{ id: number }>();
    if (Number(row.staff_id) !== staff?.id) return new Response("Forbidden", { status: 403 });
  }
  const object = await env.DOCUMENTS.get(String(row[selection[0]]));
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, { headers: {
    "Content-Type": String(row[selection[1]]),
    "Cache-Control": "private, no-store",
    "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(String(row[selection[2]]))}`,
  } });
}
