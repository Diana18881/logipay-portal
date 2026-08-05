CREATE TABLE `vehicle_files` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`staff_id` integer,
	`license_plate` text NOT NULL,
	`category` text NOT NULL,
	`file_name` text NOT NULL,
	`object_key` text NOT NULL,
	`content_type` text NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vehicle_files_object_key_unique` ON `vehicle_files` (`object_key`);