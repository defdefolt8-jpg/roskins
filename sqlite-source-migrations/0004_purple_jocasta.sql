CREATE TABLE `plaza_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `plaza_audit_time` ON `plaza_audit` (`created_at`);--> statement-breakpoint
CREATE TABLE `plaza_bookmarks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`listing_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`listing_id`) REFERENCES `plaza_listings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plaza_bookmark_unique` ON `plaza_bookmarks` (`user_id`,`listing_id`);--> statement-breakpoint
CREATE INDEX `plaza_bookmark_user` ON `plaza_bookmarks` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `plaza_listing_moderation` (
	`listing_id` text PRIMARY KEY NOT NULL,
	`hidden` integer DEFAULT 0 NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `plaza_listings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `plaza_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`ref_id` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	`read_at` integer DEFAULT 0 NOT NULL,
	`push_state` integer DEFAULT 0 NOT NULL,
	`push_at` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `plaza_notification_user` ON `plaza_notifications` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `plaza_notification_delivery` ON `plaza_notifications` (`push_state`,`created_at`);--> statement-breakpoint
CREATE TABLE `plaza_push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`session_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_sent_at` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plaza_push_endpoint` ON `plaza_push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE INDEX `plaza_push_user` ON `plaza_push_subscriptions` (`user_id`);--> statement-breakpoint
CREATE TABLE `plaza_report_review` (
	`report_id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `plaza_reports`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `plaza_roblox_cache` (
	`username` text PRIMARY KEY NOT NULL,
	`roblox_id` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `plaza_roles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `plaza_searches` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`pet` text NOT NULL,
	`variant` text DEFAULT 'any' NOT NULL,
	`ready_only` integer DEFAULT 0 NOT NULL,
	`fly` integer DEFAULT -1 NOT NULL,
	`ride` integer DEFAULT -1 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `plaza_search_user` ON `plaza_searches` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `plaza_search_pet` ON `plaza_searches` (`pet`);--> statement-breakpoint
CREATE TABLE `plaza_user_moderation` (
	`user_id` text PRIMARY KEY NOT NULL,
	`banned` integer DEFAULT 0 NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE TRIGGER plaza_notify_new_offer AFTER INSERT ON plaza_offers BEGIN
 INSERT OR IGNORE INTO plaza_notifications (id,user_id,kind,ref_id,title,body,created_at)
 VALUES ('offer:'||NEW.id,NEW.to_id,'offer',NEW.id,'Новое предложение обмена','Игрок предложил обмен. Открой предложения, чтобы ответить.',NEW.created_at);
END;
--> statement-breakpoint
CREATE TRIGGER plaza_notify_message AFTER INSERT ON plaza_messages BEGIN
 INSERT OR IGNORE INTO plaza_notifications (id,user_id,kind,ref_id,title,body,created_at)
 SELECT 'message:'||NEW.id,CASE WHEN NEW.sender_id=o.from_id THEN o.to_id ELSE o.from_id END,'message',NEW.offer_id,'Новое сообщение','В обсуждении обмена появилось сообщение.',NEW.created_at
 FROM plaza_offers o WHERE o.id=NEW.offer_id;
END;
--> statement-breakpoint
CREATE TRIGGER plaza_notify_offer_status AFTER UPDATE OF status ON plaza_offers WHEN NEW.status!=OLD.status BEGIN
 INSERT OR IGNORE INTO plaza_notifications (id,user_id,kind,ref_id,title,body,created_at)
 SELECT 'status:'||NEW.id||':'||NEW.status||':from',NEW.from_id,'offer',NEW.id,'Статус обмена изменился',CASE NEW.status WHEN 'accepted' THEN 'Предложение принято. Можно договориться о встрече.' WHEN 'completed' THEN 'Оба участника подтвердили обмен.' WHEN 'declined' THEN 'Предложение отклонено.' ELSE 'Договорённость отменена.' END,NEW.updated_at;
 INSERT OR IGNORE INTO plaza_notifications (id,user_id,kind,ref_id,title,body,created_at)
 SELECT 'status:'||NEW.id||':'||NEW.status||':to',NEW.to_id,'offer',NEW.id,'Статус обмена изменился',CASE NEW.status WHEN 'accepted' THEN 'Предложение принято. Можно договориться о встрече.' WHEN 'completed' THEN 'Оба участника подтвердили обмен.' WHEN 'declined' THEN 'Предложение отклонено.' ELSE 'Договорённость отменена.' END,NEW.updated_at;
END;
--> statement-breakpoint
CREATE TRIGGER plaza_notify_saved_search AFTER INSERT ON plaza_listings WHEN NEW.status='active' BEGIN
 INSERT OR IGNORE INTO plaza_notifications (id,user_id,kind,ref_id,title,body,created_at)
 SELECT 'search:'||s.id||':'||NEW.id,s.user_id,'search',NEW.id,'Новый трейд по твоему поиску','Появилось объявление с нужным питомцем. Посмотри, что игрок хочет взамен.',CAST(strftime('%s','now') AS INTEGER)*1000
 FROM plaza_searches s WHERE s.user_id!=NEW.owner_id
 AND NEW.expires_at>CAST(strftime('%s','now') AS INTEGER)*1000
 AND (s.ready_only=0 OR NEW.ready_until>CAST(strftime('%s','now') AS INTEGER)*1000)
 AND NOT EXISTS (SELECT 1 FROM plaza_user_moderation m WHERE m.user_id IN (NEW.owner_id,s.user_id) AND m.banned=1)
 AND NOT EXISTS (SELECT 1 FROM plaza_listing_moderation m WHERE m.listing_id=NEW.id AND m.hidden=1)
 AND EXISTS (SELECT 1 FROM json_each(NEW.have) j WHERE json_extract(j.value,'$.pet')=s.pet
 AND (s.variant='any' OR json_extract(j.value,'$.variant')=s.variant)
 AND (s.fly=-1 OR json_extract(j.value,'$.fly')=s.fly)
 AND (s.ride=-1 OR json_extract(j.value,'$.ride')=s.ride));
END;
--> statement-breakpoint
CREATE TRIGGER plaza_notify_ready_search AFTER UPDATE OF ready_until ON plaza_listings WHEN NEW.status='active' BEGIN
 INSERT OR IGNORE INTO plaza_notifications (id,user_id,kind,ref_id,title,body,created_at)
 SELECT 'search:'||s.id||':'||NEW.id,s.user_id,'search',NEW.id,'Новый трейд по твоему поиску','Появилось объявление с нужным питомцем. Посмотри, что игрок хочет взамен.',CAST(strftime('%s','now') AS INTEGER)*1000
 FROM plaza_searches s WHERE s.user_id!=NEW.owner_id AND s.ready_only=1 AND NEW.ready_until>OLD.ready_until
 AND NEW.expires_at>CAST(strftime('%s','now') AS INTEGER)*1000
 AND (s.ready_only=0 OR NEW.ready_until>CAST(strftime('%s','now') AS INTEGER)*1000)
 AND NOT EXISTS (SELECT 1 FROM plaza_user_moderation m WHERE m.user_id IN (NEW.owner_id,s.user_id) AND m.banned=1)
 AND NOT EXISTS (SELECT 1 FROM plaza_listing_moderation m WHERE m.listing_id=NEW.id AND m.hidden=1)
 AND EXISTS (SELECT 1 FROM json_each(NEW.have) j WHERE json_extract(j.value,'$.pet')=s.pet
 AND (s.variant='any' OR json_extract(j.value,'$.variant')=s.variant)
 AND (s.fly=-1 OR json_extract(j.value,'$.fly')=s.fly)
 AND (s.ride=-1 OR json_extract(j.value,'$.ride')=s.ride));
END;
