import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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

export const voiceMessages = sqliteTable("voice_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  staffId: integer("staff_id").notNull().references(() => staff.id),
  userId: integer("user_id").notNull().references(() => users.id),
  licensePlate: text("license_plate"),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  fileName: text("file_name").notNull(),
  objectKey: text("object_key").notNull().unique(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  note: text("note"),
  status: text("status").notNull().default("Neu"),
  listenedBy: integer("listened_by").references(() => users.id),
  listenedAt: text("listened_at"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("idx_voice_messages_status_created").on(table.status, table.createdAt),
  index("idx_voice_messages_staff_created").on(table.staffId, table.createdAt),
]);

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
  nightBonus: real("night_bonus").notNull().default(0),
  sundayBonus: real("sunday_bonus").notNull().default(0),
  holidayBonus: real("holiday_bonus").notNull().default(0),
  reimbursements: real("reimbursements").notNull().default(0),
  deductions: real("deductions").notNull().default(0),
  netAmount: real("net_amount").notNull().default(0),
  paymentStatus: text("payment_status").notNull().default("draft"),
  calculationDetails: text("calculation_details").notNull().default("{}"),
  calculatedAt: text("calculated_at"),
  calculatedBy: integer("calculated_by").references(() => users.id),
  lockedAt: text("locked_at"),
  lockedBy: integer("locked_by").references(() => users.id),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("payroll_staff_period_unique").on(table.staffId, table.period)]);

export const payrollPeriods = sqliteTable("payroll_periods", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  period: text("period").notNull().unique(),
  status: text("status").notNull().default("open"),
  closedBy: integer("closed_by").references(() => users.id),
  closedAt: text("closed_at"),
  reopenedBy: integer("reopened_by").references(() => users.id),
  reopenedAt: text("reopened_at"),
  reopenReason: text("reopen_reason"),
  updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("payroll_period_unique").on(table.period)]);

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

export const truckTrackers = sqliteTable("truck_trackers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  licensePlate: text("license_plate").notNull(),
  deviceId: text("device_id").notNull(),
  provider: text("provider").notNull().default("other"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  lastConnectedAt: text("last_connected_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("tracker_license_plate_unique").on(table.licensePlate),
  uniqueIndex("tracker_device_id_unique").on(table.deviceId),
]);

export const truckPositions = sqliteTable("truck_positions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  trackerId: integer("tracker_id").notNull().references(() => truckTrackers.id),
  licensePlate: text("license_plate").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  speedKph: real("speed_kph").notNull().default(0),
  heading: real("heading"),
  ignition: integer("ignition", { mode: "boolean" }).notNull().default(false),
  odometerKm: real("odometer_km"),
  address: text("address"),
  source: text("source").notNull().default("tracker"),
  recordedAt: text("recorded_at").notNull(),
  receivedAt: text("received_at").notNull(),
}, (table) => [
  index("idx_truck_positions_plate_recorded").on(table.licensePlate, table.recordedAt),
  index("idx_truck_positions_tracker_recorded").on(table.trackerId, table.recordedAt),
]);

export const tachographRecords = sqliteTable("tachograph_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  staffId: integer("staff_id").notNull().references(() => staff.id),
  licensePlate: text("license_plate").notNull(),
  recordDate: text("record_date").notNull(),
  drivingMinutes: integer("driving_minutes").notNull().default(0),
  restMinutes: integer("rest_minutes").notNull().default(0),
  remainingMinutes: integer("remaining_minutes").notNull().default(540),
  infringement: text("infringement"),
  source: text("source").notNull().default("manual"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("idx_tachograph_staff_date").on(table.staffId, table.recordDate)]);

export const tripOperations = sqliteTable("trip_operations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  planningId: integer("planning_id").notNull().references(() => weeklyPlanning.id),
  status: text("status").notNull().default("Geplant"),
  pickupAddress: text("pickup_address"),
  deliveryAddress: text("delivery_address"),
  eta: text("eta"),
  delayReason: text("delay_reason"),
  recipientName: text("recipient_name"),
  signatureName: text("signature_name"),
  startedAt: text("started_at"),
  loadedAt: text("loaded_at"),
  deliveredAt: text("delivered_at"),
  updatedBy: integer("updated_by").notNull().references(() => users.id),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("trip_operations_planning_unique").on(table.planningId), index("idx_trip_operations_status_eta").on(table.status, table.eta)]);

export const planningDepartureConfirmations = sqliteTable("planning_departure_confirmations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  planningId: integer("planning_id").notNull().references(() => weeklyPlanning.id),
  shiftDate: text("shift_date").notNull(),
  confirmedAt: text("confirmed_at").notNull(),
  confirmedBy: integer("confirmed_by").notNull().references(() => users.id),
  createdAt: text("created_at").notNull(),
}, (table) => [uniqueIndex("planning_departure_unique").on(table.planningId, table.shiftDate)]);

export const tripDocuments = sqliteTable("trip_documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tripOperationId: integer("trip_operation_id").notNull().references(() => tripOperations.id),
  staffId: integer("staff_id").references(() => staff.id),
  category: text("category").notNull(),
  fileName: text("file_name").notNull(),
  objectKey: text("object_key").notNull().unique(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("idx_trip_documents_trip").on(table.tripOperationId, table.category)]);

export const tripMessages = sqliteTable("trip_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tripOperationId: integer("trip_operation_id").notNull().references(() => tripOperations.id),
  senderUserId: integer("sender_user_id").notNull().references(() => users.id),
  senderRole: text("sender_role").notNull(),
  messageType: text("message_type").notNull().default("text"),
  body: text("body"),
  originalLanguage: text("original_language").notNull().default("de"),
  translationsJson: text("translations_json").notNull().default("{}"),
  fileName: text("file_name"),
  objectKey: text("object_key").unique(),
  contentType: text("content_type"),
  sizeBytes: integer("size_bytes"),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("idx_trip_messages_operation_created").on(table.tripOperationId, table.createdAt),
  index("idx_trip_messages_sender_created").on(table.senderUserId, table.createdAt),
]);

export const tripMessageReads = sqliteTable("trip_message_reads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  messageId: integer("message_id").notNull().references(() => tripMessages.id),
  userId: integer("user_id").notNull().references(() => users.id),
  readAt: text("read_at").notNull(),
}, (table) => [
  uniqueIndex("trip_message_read_unique").on(table.messageId, table.userId),
  index("idx_trip_message_reads_user").on(table.userId, table.readAt),
]);

export const expenses = sqliteTable("expenses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  staffId: integer("staff_id").notNull().references(() => staff.id),
  licensePlate: text("license_plate").notNull(),
  expenseDate: text("expense_date").notNull(),
  category: text("category").notNull(),
  merchant: text("merchant"),
  grossAmount: real("gross_amount").notNull().default(0),
  vatAmount: real("vat_amount").notNull().default(0),
  liters: real("liters"),
  odometerKm: real("odometer_km"),
  paymentMethod: text("payment_method").notNull().default("Privatauslage"),
  reimbursable: integer("reimbursable").notNull().default(1),
  reimbursementAmount: real("reimbursement_amount").notNull().default(0),
  amazonSite: text("amazon_site"),
  blockId: text("block_id"),
  tourReference: text("tour_reference"),
  costCenter: text("cost_center"),
  receiptNumber: text("receipt_number"),
  status: text("status").notNull().default("Eingereicht"),
  receiptFileName: text("receipt_file_name"),
  receiptObjectKey: text("receipt_object_key").unique(),
  receiptContentType: text("receipt_content_type"),
  recognitionStatus: text("recognition_status").notNull().default("Prüfen"),
  paymentReference: text("payment_reference"),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: text("reviewed_at"),
  paidAt: text("paid_at"),
  rejectionReason: text("rejection_reason"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("idx_expenses_date_status").on(table.expenseDate, table.status), index("idx_expenses_staff_date").on(table.staffId, table.expenseDate), index("idx_expenses_reimbursement_status").on(table.reimbursable, table.status, table.paidAt)]);

export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").references(() => users.id),
  roleScope: text("role_scope"),
  category: text("category").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  severity: text("severity").notNull().default("info"),
  readAt: text("read_at"),
  createdAt: text("created_at").notNull(),
}, (table) => [index("idx_notifications_scope_read").on(table.roleScope, table.readAt), index("idx_notifications_user_read").on(table.userId, table.readAt)]);

export const vehicleChecklists = sqliteTable("vehicle_checklists", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  staffId: integer("staff_id").notNull().references(() => staff.id),
  planningId: integer("planning_id").references(() => weeklyPlanning.id),
  licensePlate: text("license_plate").notNull(),
  phase: text("phase").notNull(),
  checksJson: text("checks_json").notNull(),
  damageNotes: text("damage_notes"),
  status: text("status").notNull().default("OK"),
  createdAt: text("created_at").notNull(),
}, (table) => [index("idx_vehicle_checklists_plate_created").on(table.licensePlate, table.createdAt)]);
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

export const vehicleComments = sqliteTable("vehicle_comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  licensePlate: text("license_plate").notNull(),
  authorUserId: integer("author_user_id").notNull().references(() => users.id),
  authorName: text("author_name").notNull(),
  comment: text("comment").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("idx_vehicle_comments_plate_created").on(table.licensePlate, table.createdAt)]);

export const vehicleFuelCodes = sqliteTable("vehicle_fuel_codes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  licensePlate: text("license_plate").notNull(),
  fuelType: text("fuel_type", { enum: ["diesel", "adblue"] }).notNull(),
  codeValue: text("code_value").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  updatedBy: integer("updated_by").notNull().references(() => users.id),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("vehicle_fuel_code_plate_type_unique").on(table.licensePlate, table.fuelType)]);

export const fuelStops = sqliteTable("fuel_stops", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  staffId: integer("staff_id").notNull().references(() => staff.id),
  licensePlate: text("license_plate").notNull(),
  station: text("station").notNull(),
  refueledAt: text("refueled_at").notNull(),
  odometerKm: real("odometer_km").notNull(),
  dieselLiters: real("diesel_liters").notNull().default(0),
  adblueLiters: real("adblue_liters").notNull().default(0),
  grossAmount: real("gross_amount").notNull().default(0),
  status: text("status").notNull().default("Eingereicht"),
  stationFileName: text("station_file_name").notNull(),
  stationObjectKey: text("station_object_key").notNull().unique(),
  stationContentType: text("station_content_type").notNull(),
  dieselFileName: text("diesel_file_name").notNull(),
  dieselObjectKey: text("diesel_object_key").notNull().unique(),
  dieselContentType: text("diesel_content_type").notNull(),
  adblueFileName: text("adblue_file_name").notNull(),
  adblueObjectKey: text("adblue_object_key").notNull().unique(),
  adblueContentType: text("adblue_content_type").notNull(),
  receiptFileName: text("receipt_file_name").notNull(),
  receiptObjectKey: text("receipt_object_key").notNull().unique(),
  receiptContentType: text("receipt_content_type").notNull(),
  expenseId: integer("expense_id").references(() => expenses.id),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("idx_fuel_stops_plate_date").on(table.licensePlate, table.refueledAt),
  index("idx_fuel_stops_staff_date").on(table.staffId, table.refueledAt),
]);

export const driverPerformanceEvents = sqliteTable("driver_performance_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  staffId: integer("staff_id").notNull().references(() => staff.id),
  eventDate: text("event_date").notNull(),
  eventType: text("event_type", {
    enum: ["rating", "late", "no_show", "accident", "positive", "comment"],
  }).notNull(),
  rating: integer("rating"),
  scoreDelta: integer("score_delta").notNull().default(0),
  minutesLate: integer("minutes_late").notNull().default(0),
  notes: text("notes"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdByName: text("created_by_name").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("idx_driver_performance_staff_date").on(table.staffId, table.eventDate),
  index("idx_driver_performance_type_date").on(table.eventType, table.eventDate),
]);
