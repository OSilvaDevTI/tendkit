CREATE TABLE `support_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text,
	`ticket_id` text,
	`uploaded_by` text,
	`filename` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`storage_key` text NOT NULL,
	`content_id` text,
	`inline` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `support_messages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `support_attachments_message_idx` ON `support_attachments` (`message_id`);--> statement-breakpoint
CREATE TABLE `support_channel_state` (
	`channel_id` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`last_error` text,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `support_contact_identities` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text NOT NULL,
	`kind` text NOT NULL,
	`value` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `support_contacts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `support_contact_identities_contact_idx` ON `support_contact_identities` (`contact_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `support_contact_identities_kind_value` ON `support_contact_identities` (`kind`,`value`);--> statement-breakpoint
CREATE TABLE `support_contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`customer_id` text,
	`user_id` text,
	`locale` text,
	`blocked_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `support_contacts_customer_idx` ON `support_contacts` (`customer_id`);--> statement-breakpoint
CREATE INDEX `support_contacts_user_idx` ON `support_contacts` (`user_id`);--> statement-breakpoint
CREATE TABLE `support_events` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket_id` text NOT NULL,
	`type` text NOT NULL,
	`actor_id` text,
	`data` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `support_events_ticket_idx` ON `support_events` (`ticket_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `support_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket_id` text NOT NULL,
	`kind` text NOT NULL,
	`channel_id` text,
	`author_id` text,
	`from` text,
	`to` text DEFAULT '[]' NOT NULL,
	`cc` text DEFAULT '[]' NOT NULL,
	`subject` text,
	`text` text NOT NULL,
	`full_text` text,
	`html` text,
	`rfc_message_id` text,
	`in_reply_to` text,
	`references` text DEFAULT '[]' NOT NULL,
	`provider_message_id` text,
	`delivery_status` text,
	`delivery_error` text,
	`auto` integer DEFAULT false NOT NULL,
	`source` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `support_messages_ticket_idx` ON `support_messages` (`ticket_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `support_messages_rfc_idx` ON `support_messages` (`rfc_message_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `support_messages_provider_id` ON `support_messages` (`channel_id`,`provider_message_id`);--> statement-breakpoint
CREATE TABLE `support_reads` (
	`ticket_id` text NOT NULL,
	`reader_id` text NOT NULL,
	`read_at` integer NOT NULL,
	PRIMARY KEY(`ticket_id`, `reader_id`),
	FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `support_tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`number` integer NOT NULL,
	`channel_id` text NOT NULL,
	`subject` text,
	`status` text NOT NULL,
	`contact_id` text NOT NULL,
	`customer_id` text,
	`assignee_id` text,
	`reply_token` text NOT NULL,
	`provider_thread_id` text,
	`waiting_since` integer,
	`last_message_at` integer NOT NULL,
	`last_inbound_at` integer,
	`last_outbound_at` integer,
	`solved_at` integer,
	`preview` text,
	`preview_kind` text,
	`preview_author_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `support_contacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `support_tickets_status_waiting_idx` ON `support_tickets` (`status`,`waiting_since`);--> statement-breakpoint
CREATE INDEX `support_tickets_status_recent_idx` ON `support_tickets` (`status`,`last_message_at`);--> statement-breakpoint
CREATE INDEX `support_tickets_customer_idx` ON `support_tickets` (`customer_id`,`last_message_at`);--> statement-breakpoint
CREATE INDEX `support_tickets_contact_idx` ON `support_tickets` (`contact_id`,`channel_id`);--> statement-breakpoint
CREATE INDEX `support_tickets_thread_idx` ON `support_tickets` (`channel_id`,`provider_thread_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `support_tickets_number` ON `support_tickets` (`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `support_tickets_reply_token` ON `support_tickets` (`reply_token`);