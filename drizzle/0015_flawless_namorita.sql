CREATE TABLE `voice_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`staff_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`license_plate` text,
	`duration_seconds` integer DEFAULT 0 NOT NULL,
	`file_name` text NOT NULL,
	`object_key` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`note` text,
	`status` text DEFAULT 'Neu' NOT NULL,
	`listened_by` integer,
	`listened_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`listened_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `voice_messages_object_key_unique` ON `voice_messages` (`object_key`);--> statement-breakpoint
CREATE INDEX `idx_voice_messages_status_created` ON `voice_messages` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_voice_messages_staff_created` ON `voice_messages` (`staff_id`,`created_at`);