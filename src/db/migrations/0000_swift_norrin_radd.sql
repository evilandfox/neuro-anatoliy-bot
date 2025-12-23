-- Sessions table for tracking user conversations
CREATE TABLE IF NOT EXISTS `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	`last_message_at` integer NOT NULL,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
-- Messages table for storing chat history
CREATE TABLE IF NOT EXISTS `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
-- Notebooks table for storing user context between sessions
CREATE TABLE IF NOT EXISTS `notebooks` (
	`user_id` integer PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
-- Create index on sessions for faster lookup by user_id
CREATE INDEX IF NOT EXISTS `sessions_user_id_idx` ON `sessions`(`user_id`);
--> statement-breakpoint
-- Create index on messages for faster lookup by session_id
CREATE INDEX IF NOT EXISTS `messages_session_id_idx` ON `messages`(`session_id`);
