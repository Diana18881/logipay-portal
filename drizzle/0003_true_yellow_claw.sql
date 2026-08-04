CREATE TABLE `driver_concerns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`period` text NOT NULL,
	`company` text NOT NULL,
	`base` text,
	`truck_number` text,
	`item_name` text NOT NULL,
	`purchase_status` text,
	`completion_status` text DEFAULT 'Not delivered' NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
