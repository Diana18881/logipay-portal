PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_driver_concerns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`staff_id` integer,
	`period` text NOT NULL,
	`company` text NOT NULL,
	`base` text,
	`truck_number` text,
	`item_name` text NOT NULL,
	`purchase_status` text,
	`completion_status` text DEFAULT 'Neu' NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_driver_concerns`("id", "staff_id", "period", "company", "base", "truck_number", "item_name", "purchase_status", "completion_status", "notes", "created_at", "updated_at") SELECT "id", "staff_id", "period", "company", "base", "truck_number", "item_name", "purchase_status", "completion_status", "notes", "created_at", "updated_at" FROM `driver_concerns`;--> statement-breakpoint
DROP TABLE `driver_concerns`;--> statement-breakpoint
ALTER TABLE `__new_driver_concerns` RENAME TO `driver_concerns`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `weekly_planning` ADD `start_time` text DEFAULT '06:00' NOT NULL;