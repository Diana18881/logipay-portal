CREATE TABLE `driver_performance_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`staff_id` integer NOT NULL,
	`event_date` text NOT NULL,
	`event_type` text NOT NULL,
	`rating` integer,
	`score_delta` integer DEFAULT 0 NOT NULL,
	`minutes_late` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`created_by` integer NOT NULL,
	`created_by_name` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_driver_performance_staff_date` ON `driver_performance_events` (`staff_id`,`event_date`);--> statement-breakpoint
CREATE INDEX `idx_driver_performance_type_date` ON `driver_performance_events` (`event_type`,`event_date`);