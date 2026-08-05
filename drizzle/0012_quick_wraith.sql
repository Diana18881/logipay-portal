CREATE TABLE `truck_positions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tracker_id` integer NOT NULL,
	`license_plate` text NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`speed_kph` real DEFAULT 0 NOT NULL,
	`heading` real,
	`ignition` integer DEFAULT false NOT NULL,
	`odometer_km` real,
	`address` text,
	`source` text DEFAULT 'tracker' NOT NULL,
	`recorded_at` text NOT NULL,
	`received_at` text NOT NULL,
	FOREIGN KEY (`tracker_id`) REFERENCES `truck_trackers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_truck_positions_plate_recorded` ON `truck_positions` (`license_plate`,`recorded_at`);--> statement-breakpoint
CREATE INDEX `idx_truck_positions_tracker_recorded` ON `truck_positions` (`tracker_id`,`recorded_at`);--> statement-breakpoint
CREATE TABLE `truck_trackers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`license_plate` text NOT NULL,
	`device_id` text NOT NULL,
	`provider` text DEFAULT 'other' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`last_connected_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tracker_license_plate_unique` ON `truck_trackers` (`license_plate`);--> statement-breakpoint
CREATE UNIQUE INDEX `tracker_device_id_unique` ON `truck_trackers` (`device_id`);