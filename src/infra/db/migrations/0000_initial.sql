CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password` text,
	`display_name` text,
	`picture` text,
	`roles` text NOT NULL,
	`suspended` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `UQ_user_email` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `password_reset_token` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`used` integer DEFAULT false NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `auth_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`auth_provider_id` text,
	`password_hash` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `provider_auth_provider_id_index` ON `auth_providers` (`provider`,`auth_provider_id`) WHERE "auth_providers"."auth_provider_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `user_provider_index` ON `auth_providers` (`user_id`,`provider`);--> statement-breakpoint
CREATE TABLE `invite` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`invite_code` text NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `UQ_invite_email` ON `invite` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `UQ_invite_invite_code` ON `invite` (`invite_code`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`entity_name` text NOT NULL,
	`entity_id` text NOT NULL,
	`old_value` text,
	`new_value` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_actor_id_index` ON `audit_log` (`actor_id`);--> statement-breakpoint
CREATE INDEX `audit_action_index` ON `audit_log` (`action`);--> statement-breakpoint
CREATE INDEX `audit_entity_name_index` ON `audit_log` (`entity_name`);--> statement-breakpoint
CREATE INDEX `audit_entity_id_index` ON `audit_log` (`entity_id`);--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`extension` text NOT NULL,
	`mimetype` text NOT NULL,
	`path` text NOT NULL,
	`size` integer,
	`user_id` text NOT NULL,
	`width` integer,
	`height` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `UQ_file_path` ON `files` (`path`);