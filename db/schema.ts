import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  role: text("role", {
    enum: ["management", "accountant", "dispatcher", "driver"],
  }).notNull(),
  passwordHash: text("password_hash").notNull(),
  mustChangePassword: integer("must_change_password", { mode: "boolean" })
    .notNull()
    .default(true),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: text("locked_until"),
  twoFactorSecret: text("two_factor_secret"),
  twoFactorEnabled: integer("two_factor_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
});

export const sessions = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
  lastSeenAt: text("last_seen_at").notNull(),
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
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id),
  period: text("period").notNull(),
  baseAmount: integer("base_amount").notNull(),
  tripAmount: integer("trip_amount").notNull().default(0),
  allowanceAmount: integer("allowance_amount").notNull().default(0),
  deductionAmount: integer("deduction_amount").notNull().default(0),
  totalAmount: integer("total_amount").notNull(),
  status: text("status", { enum: ["draft", "review", "approved", "paid"] })
    .notNull()
    .default("draft"),
  updatedAt: text("updated_at").notNull(),
});

export const trips = sqliteTable("trips", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tripCode: text("trip_code").notNull().unique(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id),
  origin: text("origin").notNull(),
  destination: text("destination").notNull(),
  distanceKm: real("distance_km").notNull(),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at"),
  status: text("status", {
    enum: ["assigned", "in_transit", "completed"],
  }).notNull(),
  bonusAmount: integer("bonus_amount").notNull().default(0),
});

export const staff = sqliteTable("staff", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").references(() => users.id),
  fullName: text("full_name").notNull(),
  systemType: text("system_type"),
  compensation: text("compensation"),
  location: text("location"),
  company: text("company"),
  vacation: text("vacation"),
  status: text("status", { enum: ["active", "archived"] })
    .notNull()
    .default("active"),
  hiredAt: text("hired_at"),
  terminatedAt: text("terminated_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const vehicles = sqliteTable("vehicles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  licensePlate: text("license_plate").notNull().unique(),
  company: text("company"),
  location: text("location"),
  status: text("status", { enum: ["active", "workshop", "reserve"] })
    .notNull()
    .default("active"),
  assignedStaffId: integer("assigned_staff_id").references(() => staff.id),
  inspectionDue: text("inspection_due"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const weeklyPlanning = sqliteTable("weekly_planning", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  planningYear: integer("planning_year").notNull().default(2026),
  calendarWeek: integer("calendar_week").notNull(),
  company: text("company").notNull(),
  staffId: integer("staff_id").references(() => staff.id),
  driverName: text("driver_name"),
  location: text("location"),
  licensePlate: text("license_plate"),
  workDays: text("work_days").notNull().default("1,2,3,4,5,6,7"),
  startTime: text("start_time").notNull().default("06:00"),
  blockId: text("block_id"),
  status: text("status").notNull().default("planned"),
  comments: text("comments"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const salaryDocuments = sqliteTable("salary_documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  staffId: integer("staff_id")
    .notNull()
    .references(() => staff.id),
  period: text("period").notNull(),
  fileName: text("file_name").notNull(),
  objectKey: text("object_key").notNull().unique(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  uploadedBy: integer("uploaded_by")
    .notNull()
    .references(() => users.id),
  createdAt: text("created_at").notNull(),
});

export const driverConcerns = sqliteTable("driver_concerns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  staffId: integer("staff_id").references(() => staff.id),
  period: text("period").notNull(),
  company: text("company").notNull(),
  base: text("base"),
  truckNumber: text("truck_number"),
  itemName: text("item_name").notNull(),
  purchaseStatus: text("purchase_status"),
  completionStatus: text("completion_status").notNull().default("Neu"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  action: text("action").notNull(),
  entityId: text("entity_id"),
  details: text("details"),
  createdAt: text("created_at").notNull(),
});

export const loginAudit = sqliteTable("login_audit", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").references(() => users.id),
  email: text("email").notNull(),
  success: integer("success", { mode: "boolean" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: text("created_at").notNull(),
});

export const passwordResetRequests = sqliteTable("password_reset_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull(),
  status: text("status").notNull().default("open"),
  createdAt: text("created_at").notNull(),
  resolvedAt: text("resolved_at"),
});

export const employeeDocuments = sqliteTable("employee_documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  staffId: integer("staff_id").notNull().references(() => staff.id),
  category: text("category").notNull(),
  fileName: text("file_name").notNull(),
  objectKey: text("object_key").notNull().unique(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  expiresAt: text("expires_at"),
  uploadedBy: integer("uploaded_by").notNull().references(() => users.id),
  createdAt: text("created_at").notNull(),
});

export const payrollCalculations = sqliteTable("payroll_calculations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  staffId: integer("staff_id").notNull().references(() => staff.id),
  period: text("period").notNull(),
  baseSalary: real("base_salary").notNull().default(0),
  tourCount: integer("tour_count").notNull().default(0),
  bonuses: real("bonuses").notNull().default(0),
  expenses: real("expenses").notNull().default(0),
  deductions: real("deductions").notNull().default(0),
  netAmount: real("net_amount").notNull().default(0),
  paymentStatus: text("payment_status").notNull().default("draft"),
  lockedAt: text("locked_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("payroll_staff_period_unique").on(table.staffId, table.period)]);

export const vehicleMaintenance = sqliteTable("vehicle_maintenance", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  licensePlate: text("license_plate").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  cost: real("cost").notNull().default(0),
  status: text("status").notNull().default("Gemeldet"),
  responsible: text("responsible"),
  dueDate: text("due_date"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
export const vehicleFiles = sqliteTable("vehicle_files", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  staffId: integer("staff_id").references(() => staff.id),
  licensePlate: text("license_plate").notNull(),
  category: text("category").notNull(),
  fileName: text("file_name").notNull(),
  objectKey: text("object_key").notNull().unique(),
  contentType: text("content_type").notNull(),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});
