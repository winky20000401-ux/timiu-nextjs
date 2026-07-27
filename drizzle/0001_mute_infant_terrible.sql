DROP INDEX `feed_items_fingerprint_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `feed_items_fingerprint_unique` ON `feed_items` (`fingerprint`);