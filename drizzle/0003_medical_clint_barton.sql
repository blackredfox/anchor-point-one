CREATE TABLE `twilio_delivery_statuses` (
	`sid` text PRIMARY KEY NOT NULL,
	`request_id` text,
	`message_id` integer,
	`status` text NOT NULL,
	`error_code` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `twilio_delivery_statuses_request_id_idx` ON `twilio_delivery_statuses` (`request_id`);--> statement-breakpoint
CREATE INDEX `twilio_delivery_statuses_message_id_idx` ON `twilio_delivery_statuses` (`message_id`);