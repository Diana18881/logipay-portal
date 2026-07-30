import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { employees, payrollRecords, users } from "../../../db/schema";
import { requirePortalUser } from "../../../lib/auth";

export async function GET(request: Request) {
  const user = await requirePortalUser(["management", "accountant", "driver"]);
  const url = new URL(request.url);
  const period = url.searchParams.get("period") ?? "2026-07";
  const db = getDb();

  const rows = await db
    .select({
      id: payrollRecords.id,
      employee: users.fullName,
      position: employees.position,
      period: payrollRecords.period,
      totalAmount: payrollRecords.totalAmount,
      status: payrollRecords.status,
      updatedAt: payrollRecords.updatedAt,
    })
    .from(payrollRecords)
    .innerJoin(employees, eq(payrollRecords.employeeId, employees.id))
    .innerJoin(users, eq(employees.userId, users.id))
    .where(eq(payrollRecords.period, period))
    .orderBy(desc(payrollRecords.updatedAt));

  const payroll = user.role === "driver"
    ? rows.filter((row) => row.employee === user.fullName)
    : rows;
  return Response.json({ viewer: user.email, period, payroll });
}
