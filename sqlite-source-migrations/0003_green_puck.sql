CREATE TABLE `roskins_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`login` text NOT NULL,
	`password_hash` text NOT NULL,
	`recovery_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `roskins_account_login` ON `roskins_accounts` (`login`);--> statement-breakpoint
CREATE TABLE `roskins_auth_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `roskins_auth_limit_expiry` ON `roskins_auth_limits` (`expires_at`);--> statement-breakpoint
CREATE TABLE `roskins_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `roskins_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `roskins_session_user` ON `roskins_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `roskins_session_expiry` ON `roskins_sessions` (`expires_at`);