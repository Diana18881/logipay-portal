CREATE TABLE `expenses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`staff_id` integer NOT NULL,
	`license_plate` text NOT NULL,
	`expense_date` text NOT NULL,
	`category` text NOT NULL,
	`merchant` text,
	`gross_amount` real DEFAULT 0 NOT NULL,
	`vat_amount` real DEFAULT 0 NOT NULL,
	`liters` real,
	`odometer_km` real,
	`status` text DEFAULT 'Eingereicht' NOT NULL,
	`receipt_file_name` text,
	`receipt_object_key` text,
	`receipt_content_type` text,
	`recognition_status` text DEFAULT 'Prüfen' NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `expenses_receipt_object_key_unique` ON `expenses` (`receipt_object_key`);--> statement-breakpoint
CREATE INDEX `idx_expenses_date_status` ON `expenses` (`expense_date`,`status`);--> statement-breakpoint
CREATE INDEX `idx_expenses_staff_date` ON `expenses` (`staff_id`,`expense_date`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`role_scope` text,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`severity` text DEFAULT 'info' NOT NULL,
	`read_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_notifications_scope_read` ON `notifications` (`role_scope`,`read_at`);--> statement-breakpoint
CREATE INDEX `idx_notifications_user_read` ON `notifications` (`user_id`,`read_at`);--> statement-breakpoint
CREATE TABLE `tachograph_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`staff_id` integer NOT NULL,
	`license_plate` text NOT NULL,
	`record_date` text NOT NULL,
	`driving_minutes` integer DEFAULT 0 NOT NULL,
	`rest_minutes` integer DEFAULT 0 NOT NULL,
	`remaining_minutes` integer DEFAULT 540 NOT NULL,
	`infringement` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_tachograph_staff_date` ON `tachograph_records` (`staff_id`,`record_date`);--> statement-breakpoint
CREATE TABLE `trip_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`trip_operation_id` integer NOT NULL,
	`staff_id` integer,
	`category` text NOT NULL,
	`file_name` text NOT NULL,
	`object_key` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`trip_operation_id`) REFERENCES `trip_operations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trip_documents_object_key_unique` ON `trip_documents` (`object_key`);--> statement-breakpoint
CREATE INDEX `idx_trip_documents_trip` ON `trip_documents` (`trip_operation_id`,`category`);--> statement-breakpoint
CREATE TABLE `trip_operations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`planning_id` integer NOT NULL,
	`status` text DEFAULT 'Geplant' NOT NULL,
	`pickup_address` text,
	`delivery_address` text,
	`eta` text,
	`delay_reason` text,
	`recipient_name` text,
	`signature_name` text,
	`started_at` text,
	`loaded_at` text,
	`delivered_at` text,
	`updated_by` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`planning_id`) REFERENCES `weekly_planning`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trip_operations_planning_unique` ON `trip_operations` (`planning_id`);--> statement-breakpoint
CREATE INDEX `idx_trip_operations_status_eta` ON `trip_operations` (`status`,`eta`);--> statement-breakpoint
CREATE TABLE `vehicle_checklists` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`staff_id` integer NOT NULL,
	`planning_id` integer,
	`license_plate` text NOT NULL,
	`phase` text NOT NULL,
	`checks_json` text NOT NULL,
	`damage_notes` text,
	`status` text DEFAULT 'OK' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`planning_id`) REFERENCES `weekly_planning`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_vehicle_checklists_plate_created` ON `vehicle_checklists` (`license_plate`,`created_at`);