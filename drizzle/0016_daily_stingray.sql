CREATE TABLE `payroll_periods` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`period` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`closed_by` integer,
	`closed_at` text,
	`reopened_by` integer,
	`reopened_at` text,
	`reopen_reason` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`closed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reopened_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payroll_periods_period_unique` ON `payroll_periods` (`period`);--> statement-breakpoint
CREATE UNIQUE INDEX `payroll_period_unique` ON `payroll_periods` (`period`);--> statement-breakpoint
CREATE TABLE `trip_message_reads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`message_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`read_at` text NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `trip_messages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trip_message_read_unique` ON `trip_message_reads` (`message_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_trip_message_reads_user` ON `trip_message_reads` (`user_id`,`read_at`);--> statement-breakpoint
CREATE TABLE `trip_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`trip_operation_id` integer NOT NULL,
	`sender_user_id` integer NOT NULL,
	`sender_role` text NOT NULL,
	`message_type` text DEFAULT 'text' NOT NULL,
	`body` text,
	`original_language` text DEFAULT 'de' NOT NULL,
	`translations_json` text DEFAULT '{}' NOT NULL,
	`file_name` text,
	`object_key` text,
	`content_type` text,
	`size_bytes` integer,
	`duration_seconds` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`trip_operation_id`) REFERENCES `trip_operations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sender_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trip_messages_object_key_unique` ON `trip_messages` (`object_key`);--> statement-breakpoint
CREATE INDEX `idx_trip_messages_operation_created` ON `trip_messages` (`trip_operation_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_trip_messages_sender_created` ON `trip_messages` (`sender_user_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `payroll_calculations` ADD `night_bonus` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `payroll_calculations` ADD `sunday_bonus` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `payroll_calculations` ADD `holiday_bonus` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `payroll_calculations` ADD `reimbursements` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `payroll_calculations` ADD `calculation_details` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `payroll_calculations` ADD `calculated_at` text;--> statement-breakpoint
ALTER TABLE `payroll_calculations` ADD `calculated_by` integer REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `payroll_calculations` ADD `locked_by` integer REFERENCES users(id);