ALTER TABLE `expenses` ADD `payment_method` text DEFAULT 'Privatauslage' NOT NULL;--> statement-breakpoint
ALTER TABLE `expenses` ADD `reimbursable` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `expenses` ADD `reimbursement_amount` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `expenses` ADD `amazon_site` text;--> statement-breakpoint
ALTER TABLE `expenses` ADD `block_id` text;--> statement-breakpoint
ALTER TABLE `expenses` ADD `tour_reference` text;--> statement-breakpoint
ALTER TABLE `expenses` ADD `cost_center` text;--> statement-breakpoint
ALTER TABLE `expenses` ADD `receipt_number` text;--> statement-breakpoint
ALTER TABLE `expenses` ADD `payment_reference` text;--> statement-breakpoint
ALTER TABLE `expenses` ADD `reviewed_by` integer REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `expenses` ADD `reviewed_at` text;--> statement-breakpoint
ALTER TABLE `expenses` ADD `paid_at` text;--> statement-breakpoint
ALTER TABLE `expenses` ADD `rejection_reason` text;--> statement-breakpoint
CREATE INDEX `idx_expenses_reimbursement_status` ON `expenses` (`reimbursable`,`status`,`paid_at`);