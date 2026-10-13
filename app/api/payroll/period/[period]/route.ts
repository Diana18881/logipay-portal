import { env } from "@logipay/env";
import { requirePortalUser } from "../../../../../lib/auth";
import { ensureDomainDatabase } from "../../../../../lib/domain";
import { createPdf, drawPayslip, type PayslipRow } from "../../../../../lib/payslip";

/** One PDF with a payslip page for every employee of the month. */
export async function GET(request: Request, context: { params: Promise<{ period: string }> }) {
  const user = await requirePortalUser(["management", "accountant"]);
  await ensureDomainDatabase();
  const { period } = await context.params;
  if (!/^\d{4}-\d{2}$/.test(period)) return new Response("Ungültiger Monat", { status: 400 });
  const rows = (await env.DB.prepare("SELECT p.*, s.full_name, s.company, s.location FROM payroll_calculations p JOIN staff s ON s.id=p.staff_id WHERE p.period=? ORDER BY s.full_name").bind(period).all<PayslipRow>()).results;
  if (!rows.length) return new Response("Keine Abrechnungen in diesem Monat", { status: 404 });
  const { pdf, fonts } = await createPdf(request);
  for (const row of rows) drawPayslip(pdf, fonts, row);
  await env.DB.prepare("INSERT INTO audit_log (user_id, action, entity_id, details, created_at) VALUES (?, 'downloadPayrollBulkPdf', ?, ?, ?)").bind(user.id, period, JSON.stringify({ count: rows.length }), new Date().toISOString()).run();
  return new Response(await pdf.save(), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="Lohnabrechnungen-${period}.pdf"`, "Cache-Control": "private, no-store" } });
}
