CREATE TABLE `fuel_stops` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`staff_id` integer NOT NULL,
	`license_plate` text NOT NULL,
	`station` text NOT NULL,
	`refueled_at` text NOT NULL,
	`odometer_km` real NOT NULL,
	`diesel_liters` real DEFAULT 0 NOT NULL,
	`adblue_liters` real DEFAULT 0 NOT NULL,
	`gross_amount` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'Eingereicht' NOT NULL,
	`station_file_name` text NOT NULL,
	`station_object_key` text NOT NULL,
	`station_content_type` text NOT NULL,
	`diesel_file_name` text NOT NULL,
	`diesel_object_key` text NOT NULL,
	`diesel_content_type` text NOT NULL,
	`adblue_file_name` text NOT NULL,
	`adblue_object_key` text NOT NULL,
	`adblue_content_type` text NOT NULL,
	`receipt_file_name` text NOT NULL,
	`receipt_object_key` text NOT NULL,
	`receipt_content_type` text NOT NULL,
	`expense_id` integer,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`expense_id`) REFERENCES `expenses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fuel_stops_station_object_key_unique` ON `fuel_stops` (`station_object_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `fuel_stops_diesel_object_key_unique` ON `fuel_stops` (`diesel_object_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `fuel_stops_adblue_object_key_unique` ON `fuel_stops` (`adblue_object_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `fuel_stops_receipt_object_key_unique` ON `fuel_stops` (`receipt_object_key`);--> statement-breakpoint
CREATE INDEX `idx_fuel_stops_plate_date` ON `fuel_stops` (`license_plate`,`refueled_at`);--> statement-breakpoint
CREATE INDEX `idx_fuel_stops_staff_date` ON `fuel_stops` (`staff_id`,`refueled_at`);--> statement-breakpoint
CREATE TABLE `vehicle_comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`license_plate` text NOT NULL,
	`author_user_id` integer NOT NULL,
	`author_name` text NOT NULL,
	`comment` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_vehicle_comments_plate_created` ON `vehicle_comments` (`license_plate`,`created_at`);--> statement-breakpoint
CREATE TABLE `vehicle_fuel_codes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`license_plate` text NOT NULL,
	`fuel_type` text NOT NULL,
	`code_value` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`updated_by` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vehicle_fuel_code_plate_type_unique` ON `vehicle_fuel_codes` (`license_plate`,`fuel_type`);