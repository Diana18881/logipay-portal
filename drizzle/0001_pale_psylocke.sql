CREATE TABLE `sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
ALTER TABLE `users` ADD `password_hash` text NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `must_change_password` integer DEFAULT true NOT NULL;--> statement-breakpoint
INSERT INTO `users` (`email`, `full_name`, `role`, `password_hash`, `must_change_password`, `active`) VALUES
('director@logipay.demo', 'Lirim Krasnici', 'management', 'pbkdf2_sha256$210000$DWGodkYNPzMpQKdqkvsM8w==$40SLjYyIO9PnETVOu8TfPtK60JlhDUOidG/xqqHJzjs=', 1, 1),
('accounting@logipay.demo', 'Елена Волкова', 'accountant', 'pbkdf2_sha256$210000$H0SJBqBEUEQ+dayMOW5YqA==$oP2MVO5ym0TIV4kveKq5jdoRgp9iYzAibCQPzWyYck0=', 1, 1),
('dispatcher@logipay.demo', 'Ирина Соколова', 'dispatcher', 'pbkdf2_sha256$210000$80XB8VADHtpNRi9e/95H8w==$15+DDBe39mSXGTlie1/yOO0fR0s5TkpZ8dfm+yxCLrE=', 1, 1),
('driver@logipay.demo', 'Михаил Козлов', 'driver', 'pbkdf2_sha256$210000$D+OAHkFUpdqX4iCAtILvvQ==$aev3aSc/SShRVrdjU0NUAeib2zhI0S6pwW060QpDFg0=', 1, 1);--> statement-breakpoint
INSERT INTO `employees` (`user_id`, `employee_code`, `position`, `vehicle_code`, `base_salary`) VALUES
((SELECT id FROM users WHERE email = 'director@logipay.demo'), 'EMP-001', 'Операционный директор', NULL, 220000),
((SELECT id FROM users WHERE email = 'accounting@logipay.demo'), 'EMP-002', 'Главный бухгалтер', NULL, 165000),
((SELECT id FROM users WHERE email = 'dispatcher@logipay.demo'), 'EMP-003', 'Старший диспетчер', NULL, 112500),
((SELECT id FROM users WHERE email = 'driver@logipay.demo'), 'DRV-184', 'Водитель', 'TRK-184', 78000);--> statement-breakpoint
INSERT INTO `payroll_records` (`employee_id`, `period`, `base_amount`, `trip_amount`, `allowance_amount`, `deduction_amount`, `total_amount`, `status`, `updated_at`) VALUES
((SELECT id FROM employees WHERE employee_code = 'EMP-001'), '2026-07', 220000, 0, 12000, 34000, 198000, 'approved', '2026-07-30T07:42:00.000Z'),
((SELECT id FROM employees WHERE employee_code = 'EMP-002'), '2026-07', 165000, 0, 6000, 24500, 146500, 'approved', '2026-07-30T07:38:00.000Z'),
((SELECT id FROM employees WHERE employee_code = 'EMP-003'), '2026-07', 112500, 0, 7200, 14500, 105200, 'approved', '2026-07-30T07:31:00.000Z'),
((SELECT id FROM employees WHERE employee_code = 'DRV-184'), '2026-07', 78000, 64200, 9600, 3400, 148400, 'approved', '2026-07-30T07:26:00.000Z');--> statement-breakpoint
INSERT INTO `trips` (`trip_code`, `employee_id`, `origin`, `destination`, `distance_km`, `starts_at`, `ends_at`, `status`, `bonus_amount`) VALUES
('R-2841', (SELECT id FROM employees WHERE employee_code = 'DRV-184'), 'Берлин', 'Варшава', 574, '2026-07-28T05:00:00.000Z', '2026-07-30T17:20:00.000Z', 'completed', 18400),
('R-2827', (SELECT id FROM employees WHERE employee_code = 'DRV-184'), 'Гамбург', 'Прага', 643, '2026-07-22T04:30:00.000Z', '2026-07-24T19:10:00.000Z', 'completed', 16900);
