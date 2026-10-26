CREATE TABLE `plaza_listings` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`have` text NOT NULL,
	`want` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL CHECK (`status` IN ('active','reserved','closed','completed')),
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`ready_until` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `plaza_listing_board` ON `plaza_listings` (`status`,`expires_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `plaza_listing_owner` ON `plaza_listings` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `plaza_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`offer_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`offer_id`) REFERENCES `plaza_offers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sender_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `plaza_message_offer` ON `plaza_messages` (`offer_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `plaza_message_rate` ON `plaza_messages` (`sender_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `plaza_offers` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text NOT NULL,
	`from_id` text NOT NULL,
	`to_id` text NOT NULL,
	`have` text NOT NULL,
	`want` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL CHECK (`status` IN ('pending','accepted','declined','cancelled','completed')),
	`from_confirmed` integer DEFAULT 0 NOT NULL CHECK (`from_confirmed` IN (0,1)),
	`to_confirmed` integer DEFAULT 0 NOT NULL CHECK (`to_confirmed` IN (0,1)),
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `plaza_listings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action,
	CHECK (`from_id` != `to_id`)
);
--> statement-breakpoint
CREATE INDEX `plaza_offer_from` ON `plaza_offers` (`from_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `plaza_offer_to` ON `plaza_offers` (`to_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `plaza_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`reporter_id` text NOT NULL,
	`listing_id` text,
	`offer_id` text,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`reporter_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`listing_id`) REFERENCES `plaza_listings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`offer_id`) REFERENCES `plaza_offers`(`id`) ON UPDATE no action ON DELETE no action,
	CHECK (`listing_id` IS NOT NULL OR `offer_id` IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX `plaza_report_rate` ON `plaza_reports` (`reporter_id`,`created_at`);
--> statement-breakpoint
-- Manually maintained constraints/indexes/triggers supplement generated schema metadata.
CREATE UNIQUE INDEX plaza_offer_duplicate ON plaza_offers(listing_id,from_id) WHERE status IN ('pending','accepted');
--> statement-breakpoint
CREATE UNIQUE INDEX plaza_offer_one_accepted ON plaza_offers(listing_id) WHERE status='accepted';
--> statement-breakpoint
CREATE TRIGGER plaza_offer_accepted AFTER UPDATE OF status ON plaza_offers
WHEN NEW.status='accepted' AND OLD.status='pending'
BEGIN
  UPDATE plaza_listings SET status='reserved',ready_until=0 WHERE id=NEW.listing_id;
  UPDATE plaza_offers SET status='declined',updated_at=NEW.updated_at WHERE listing_id=NEW.listing_id AND id!=NEW.id AND status='pending';
END;
--> statement-breakpoint
CREATE TRIGGER plaza_offer_cancelled AFTER UPDATE OF status ON plaza_offers
WHEN NEW.status='cancelled' AND OLD.status='accepted'
BEGIN
  UPDATE plaza_listings SET status='active',ready_until=0 WHERE id=NEW.listing_id AND status='reserved';
END;
--> statement-breakpoint
CREATE TRIGGER plaza_offer_completed AFTER UPDATE OF status ON plaza_offers
WHEN NEW.status='completed' AND OLD.status='accepted'
BEGIN
  UPDATE plaza_listings SET status='completed',ready_until=0 WHERE id=NEW.listing_id;
END;
--> statement-breakpoint
CREATE TRIGGER plaza_listing_closed AFTER UPDATE OF status ON plaza_listings
WHEN NEW.status='closed'
BEGIN
  UPDATE plaza_offers SET status='declined',updated_at=CAST(strftime('%s','now') AS INTEGER)*1000 WHERE listing_id=NEW.id AND status='pending';
END;
