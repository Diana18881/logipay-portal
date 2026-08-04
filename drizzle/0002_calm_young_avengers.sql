CREATE TABLE `salary_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`staff_id` integer NOT NULL,
	`period` text NOT NULL,
	`file_name` text NOT NULL,
	`object_key` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`uploaded_by` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `salary_documents_object_key_unique` ON `salary_documents` (`object_key`);--> statement-breakpoint
CREATE TABLE `staff` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`full_name` text NOT NULL,
	`system_type` text,
	`compensation` text,
	`location` text,
	`company` text,
	`vacation` text,
	`status` text DEFAULT 'active' NOT NULL,
	`hired_at` text,
	`terminated_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `vehicles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`license_plate` text NOT NULL,
	`company` text,
	`location` text,
	`status` text DEFAULT 'active' NOT NULL,
	`assigned_staff_id` integer,
	`inspection_due` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`assigned_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vehicles_license_plate_unique` ON `vehicles` (`license_plate`);--> statement-breakpoint
CREATE TABLE `weekly_planning` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`calendar_week` integer NOT NULL,
	`company` text NOT NULL,
	`staff_id` integer,
	`driver_name` text,
	`location` text,
	`license_plate` text,
	`block_id` text,
	`status` text DEFAULT 'planned' NOT NULL,
	`comments` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
