CREATE TABLE `sms_consents` (
	`request_id` text PRIMARY KEY NOT NULL,
	`phone_e164` text NOT NULL,
	`consented_at` integer NOT NULL,
	`consent_version` text NOT NULL,
	`opted_out_at` integer,
	FOREIGN KEY (`request_id`) REFERENCES `service_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sms_consents_phone_e164_idx` ON `sms_consents` (`phone_e164`);--> statement-breakpoint
CREATE TABLE `twilio_message_events` (
	`sid` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`direction` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `service_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `twilio_message_events_request_id_idx` ON `twilio_message_events` (`request_id`);