ALTER TABLE `automation_jobs` ADD `input_tokens` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `automation_jobs` ADD `output_tokens` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `automation_jobs` ADD `total_tokens` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `automation_jobs` ADD `estimated_cost_microusd` integer DEFAULT 0 NOT NULL;