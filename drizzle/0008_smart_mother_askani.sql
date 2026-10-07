ALTER TABLE `sms_consents` ADD `consent_method` text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE `sms_consents` ADD `consent_call_sid` text;