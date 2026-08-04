ALTER TABLE `feed_items` ADD `last_seen_at` text;
--> statement-breakpoint
UPDATE `feed_items`
SET `last_seen_at` = COALESCE(`updated_at`, `created_at`, CURRENT_TIMESTAMP)
WHERE `last_seen_at` IS NULL;
