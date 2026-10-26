CREATE TABLE `roskins_terms_acceptance` (
	`user_id` text NOT NULL,
	`version` text NOT NULL,
	`accepted_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `roskins_terms_user_version` ON `roskins_terms_acceptance` (`user_id`,`version`);