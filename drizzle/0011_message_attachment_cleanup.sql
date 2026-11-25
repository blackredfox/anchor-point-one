CREATE TABLE `attachment_cleanup_queue` (
	`attachment_id` text PRIMARY KEY NOT NULL,
	`object_key` text NOT NULL,
	`filename` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`queued_at` integer NOT NULL
);
