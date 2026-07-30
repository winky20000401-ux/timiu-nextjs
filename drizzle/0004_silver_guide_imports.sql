CREATE TABLE `guide_import_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`source_type` text DEFAULT 'manifest_csv' NOT NULL,
	`package_location` text DEFAULT '' NOT NULL,
	`manifest_filename` text DEFAULT '' NOT NULL,
	`default_status` text DEFAULT 'review' NOT NULL,
	`status` text DEFAULT 'created' NOT NULL,
	`total_items` integer DEFAULT 0 NOT NULL,
	`processed_items` integer DEFAULT 0 NOT NULL,
	`created_articles` integer DEFAULT 0 NOT NULL,
	`duplicate_items` integer DEFAULT 0 NOT NULL,
	`failed_items` integer DEFAULT 0 NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_by_email` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`started_at` text,
	`finished_at` text
);
--> statement-breakpoint
CREATE INDEX `guide_import_jobs_status_idx` ON `guide_import_jobs` (`status`);--> statement-breakpoint
CREATE INDEX `guide_import_jobs_created_idx` ON `guide_import_jobs` (`created_at`);--> statement-breakpoint
CREATE TABLE `guide_import_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` integer NOT NULL,
	`external_id` text DEFAULT '' NOT NULL,
	`title` text NOT NULL,
	`game_name` text DEFAULT '' NOT NULL,
	`tags` text DEFAULT '' NOT NULL,
	`content_file` text DEFAULT '' NOT NULL,
	`cover_image` text DEFAULT '' NOT NULL,
	`source_note` text DEFAULT '' NOT NULL,
	`copyright_note` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`article_id` integer,
	`error_message` text DEFAULT '' NOT NULL,
	`raw_metadata` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `guide_import_jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `guide_import_items_job_idx` ON `guide_import_items` (`job_id`);--> statement-breakpoint
CREATE INDEX `guide_import_items_status_idx` ON `guide_import_items` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `guide_import_items_job_external_unique` ON `guide_import_items` (`job_id`,`external_id`);
