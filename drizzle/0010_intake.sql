CREATE TABLE `intake_calls` (
	`sid` text PRIMARY KEY NOT NULL,
	`phone` text,
	`created_at` integer NOT NULL,
	`prompt` text,
	`prompt_version` text,
	`answer` text,
	`confidence` real,
	`consented_at` integer,
	`token_hash` text,
	`expires_at` integer,
	`sms_reserved_at` integer,
	`empty_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `intake_calls_token_hash_unique` ON `intake_calls` (`token_hash`);--> statement-breakpoint
CREATE INDEX `intake_calls_phone_idx` ON `intake_calls` (`phone`,`created_at`);--> statement-breakpoint
CREATE TABLE `intake_form_submissions` (
	`submission_key` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`upload_token` text NOT NULL,
	`message_id` integer NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `service_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `intake_form_submissions_upload_token_unique` ON `intake_form_submissions` (`upload_token`);--> statement-breakpoint
CREATE TABLE `intake_message_events` (
	`sid` text PRIMARY KEY NOT NULL,
	`phone` text NOT NULL,
	`created_at` integer NOT NULL,
	`kind` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `intake_owner_notifications` (
	`request_id` text NOT NULL,
	`channel` text NOT NULL,
	`state` text NOT NULL,
	PRIMARY KEY(`request_id`, `channel`),
	FOREIGN KEY (`request_id`) REFERENCES `service_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `intake_sms_preferences` (
	`phone` text PRIMARY KEY NOT NULL,
	`opted_out` integer NOT NULL
);
