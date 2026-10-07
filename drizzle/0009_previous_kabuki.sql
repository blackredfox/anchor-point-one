ALTER TABLE `service_requests` ADD `owner_read_at` integer;--> statement-breakpoint
UPDATE `service_requests` SET `owner_read_at`=`updated_at`;--> statement-breakpoint
ALTER TABLE `service_requests` ADD `is_important` integer DEFAULT 0 NOT NULL;
