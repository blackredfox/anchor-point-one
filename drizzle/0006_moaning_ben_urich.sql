CREATE TABLE `twilio_voice_calls` (
	`call_sid` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`from_phone` text NOT NULL,
	`recording_sid` text,
	`recording_status` text DEFAULT 'pending' NOT NULL,
	`recording_attachment_id` text,
	`transcription_text` text,
	`notification_sent_at` integer,
	`transcription_notified_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `service_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `twilio_voice_calls_request_id_idx` ON `twilio_voice_calls` (`request_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `twilio_voice_calls_recording_sid_idx` ON `twilio_voice_calls` (`recording_sid`);