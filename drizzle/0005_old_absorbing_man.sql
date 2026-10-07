CREATE TABLE `phone_conversations` (
	`phone_e164` text PRIMARY KEY NOT NULL,
	`active_request_id` text NOT NULL,
	`last_activity_at` integer NOT NULL,
	`last_ack_at` integer,
	FOREIGN KEY (`active_request_id`) REFERENCES `service_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `phone_conversations_request_id_idx` ON `phone_conversations` (`active_request_id`);--> statement-breakpoint
ALTER TABLE `request_preferences` ADD `city` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `request_preferences` ADD `postal_code` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `request_preferences` ADD `rv_type` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `request_preferences` ADD `source_channel` text DEFAULT 'web' NOT NULL;