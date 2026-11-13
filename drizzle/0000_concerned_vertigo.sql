CREATE TABLE `consultation_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`author_key` text NOT NULL,
	`alias` text NOT NULL,
	`model` text,
	`body` text NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `comments_published_date` ON `consultation_comments` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `comments_author_date` ON `consultation_comments` (`author_key`,`created_at`);--> statement-breakpoint
CREATE TABLE `consultation_votes` (
	`voter_key` text PRIMARY KEY NOT NULL,
	`model` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
