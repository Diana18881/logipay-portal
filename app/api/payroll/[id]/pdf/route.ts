import { env } from "@logipay/env";
import { createPdf, drawPayslip } from "../../../../../lib/payslip";
import { requirePortalUser } from "../../../../../lib/auth";
import { ensureDomainDatabase } from "../../../../../lib/domain";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requirePortalUser(["management", "accountant", "driver"]);
  await ensureDomainDatabase();
  const { id } = await context.params;
  const row = await env.DB.prepare("SELECT p.*, s.full_name, s.user_id, s.company, s.location FROM payroll_calculations p JOIN staff s ON s.id=p.staff_id WHERE p.id=?").bind(id).first<Record<string, string | number | null>>();
  if (!row || (user.role === "driver" && row.user_id !== user.id && row.full_name !== user.fullName)) return new Response("Nicht gefunden", { status: 404 });
  const { pdf, fonts } = await createPdf(request);
  drawPayslip(pdf, fonts, row);
  await env.DB.prepare("INSERT INTO audit_log (user_id, action, entity_id, details, created_at) VALUES (?, 'downloadPayrollPdf', ?, ?, ?)").bind(user.id, id, JSON.stringify({ staffId: row.staff_id, period: row.period }), new Date().toISOString()).run();
  const bytes = await pdf.save();
  return new Response(bytes, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="Lohnabrechnung-${row.period}-${String(row.full_name).replace(/[^a-zA-Z0-9]+/g, "-")}.pdf"`, "Cache-Control": "private, no-store" } });
}
