CREATE TABLE `admin_login_codes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`code_hash` text NOT NULL,
	`request_ip_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`consumed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_login_codes_email_created_idx` ON `admin_login_codes` (`email`,`created_at`);--> statement-breakpoint
CREATE INDEX `admin_login_codes_ip_created_idx` ON `admin_login_codes` (`request_ip_hash`,`created_at`);--> statement-breakpoint
CREATE TABLE `admin_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`expires_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_sessions_email_idx` ON `admin_sessions` (`email`);--> statement-breakpoint
CREATE INDEX `admin_sessions_expires_idx` ON `admin_sessions` (`expires_at`);