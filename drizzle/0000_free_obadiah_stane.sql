CREATE TABLE `request_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`request_id` text NOT NULL,
	`author_type` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `service_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `request_messages_request_id_idx` ON `request_messages` (`request_id`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_name` text NOT NULL,
	`email` text NOT NULL,
	`service_type` text NOT NULL,
	`rating` integer NOT NULL,
	`body` text NOT NULL,
	`owner_response` text,
	`owner_responded_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `reviews_created_at_idx` ON `reviews` (`created_at`);--> statement-breakpoint
CREATE TABLE `service_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`access_token` text NOT NULL,
	`customer_name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`address` text NOT NULL,
	`service_type` text NOT NULL,
	`description` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `service_requests_access_token_idx` ON `service_requests` (`access_token`);--> statement-breakpoint
CREATE INDEX `service_requests_updated_at_idx` ON `service_requests` (`updated_at`);