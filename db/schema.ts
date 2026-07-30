import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  role: text("role", { enum: ["management", "accountant", "dispatcher", "driver"] }).notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const employees = sqliteTable("employees", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").references(() => users.id),
  employeeCode: text("employee_code").notNull().unique(),
  position: text("position").notNull(),
  vehicleCode: text("vehicle_code"),
  baseSalary: integer("base_salary").notNull(),
});

export const payrollRecords = sqliteTable("payroll_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  employeeId: integer("employee_id").notNull().references(() => employees.id),
  period: text("period").notNull(),
  baseAmount: integer("base_amount").notNull(),
  tripAmount: integer("trip_amount").notNull().default(0),
  allowanceAmount: integer("allowance_amount").notNull().default(0),
  deductionAmount: integer("deduction_amount").notNull().default(0),
  totalAmount: integer("total_amount").notNull(),
  status: text("status", { enum: ["draft", "review", "approved", "paid"] }).notNull().default("draft"),
  updatedAt: text("updated_at").notNull(),
});

export const trips = sqliteTable("trips", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tripCode: text("trip_code").notNull().unique(),
  employeeId: integer("employee_id").notNull().references(() => employees.id),
  origin: text("origin").notNull(),
  destination: text("destination").notNull(),
  distanceKm: real("distance_km").notNull(),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at"),
  status: text("status", { enum: ["assigned", "in_transit", "completed"] }).notNull(),
  bonusAmount: integer("bonus_amount").notNull().default(0),
});
