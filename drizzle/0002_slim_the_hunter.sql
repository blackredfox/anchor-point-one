CREATE TABLE `request_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`message_created_at` integer NOT NULL,
	`author_type` text NOT NULL,
	`object_key` text NOT NULL,
	`filename` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `service_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `request_attachments_request_id_idx` ON `request_attachments` (`request_id`);--> statement-breakpoint
CREATE INDEX `request_attachments_message_idx` ON `request_attachments` (`request_id`,`message_created_at`);