import { env } from "@logipay/env";
import { requirePortalUser } from "../../../../lib/auth";
import { buildLodasFile, datevFields, loadDatevSettings, saveDatevSettings } from "../../../../lib/datev";
import { ensureDomainDatabase } from "../../../../lib/domain";

// DATEV expects ANSI (Windows-1252); characters outside Latin-1 become "?".
function latin1(text: string) {
  return Uint8Array.from(text, (character) => (character.charCodeAt(0) < 256 ? character.charCodeAt(0) : 63));
}

export async function GET(request: Request) {
  const user = await requirePortalUser(["management", "accountant"]);
  await ensureDomainDatabase();
  const period = new URL(request.url).searchParams.get("period") || "";
  if (!period) return Response.json({ settings: await loadDatevSettings(), fields: datevFields });
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return Response.json({ error: "Monat im Format JJJJ-MM angeben" }, { status: 400 });
  try {
    const file = await buildLodasFile(period);
    if (!file.records) return Response.json({ error: "Für diesen Monat gibt es noch keine Lohnwerte" }, { status: 404 });
    await env.DB.prepare("INSERT INTO audit_log (user_id, action, entity_id, details, created_at) VALUES (?, 'datevExport', ?, ?, ?)")
      .bind(user.id, period, JSON.stringify({ employees: file.employees, records: file.records }), new Date().toISOString()).run();
    return new Response(latin1(file.content), {
      headers: {
        "Content-Type": "text/plain; charset=windows-1252",
        "Content-Disposition": `attachment; filename="LODAS-Bewegungsdaten-${period}.txt"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Export fehlgeschlagen" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const user = await requirePortalUser(["management", "accountant"]);
  await ensureDomainDatabase();
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  try {
    await saveDatevSettings(body as Parameters<typeof saveDatevSettings>[0]);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Speichern fehlgeschlagen" }, { status: 400 });
  }
  await env.DB.prepare("INSERT INTO audit_log (user_id, action, entity_id, details, created_at) VALUES (?, 'saveDatevSettings', NULL, '{}', ?)").bind(user.id, new Date().toISOString()).run();
  return Response.json({ settings: await loadDatevSettings() });
}
