CREATE TABLE `request_preferences` (
	`request_id` text PRIMARY KEY NOT NULL,
	`submission_key` text NOT NULL,
	`preferred_contact_method` text NOT NULL,
	`rv_details` text NOT NULL,
	`equipment_model` text NOT NULL,
	`appointment_preference` text NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `service_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `request_preferences_submission_key_idx` ON `request_preferences` (`submission_key`);