-- PostgreSQL port of reviewed SQLite schema; no local user data or admin roles.
CREATE TABLE "favorites" (
	"user_id" text NOT NULL,
	"listing_id" text NOT NULL
);

CREATE TABLE "listings" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"game" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"price" bigint NOT NULL,
	"image" bigint NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" bigint NOT NULL
);

CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"sender_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" bigint NOT NULL
);

CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"listing_id" text NOT NULL,
	"buyer_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"item_name" text NOT NULL,
	"game" text NOT NULL,
	"price" bigint NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);

CREATE TABLE "profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"nickname" text NOT NULL,
	"email" text NOT NULL,
	"roblox" text DEFAULT '' NOT NULL,
	"created_at" bigint NOT NULL
);

CREATE TABLE "promo_codes" (
	"code" text PRIMARY KEY NOT NULL,
	"creator_label" text NOT NULL,
	"bonus_percent" bigint NOT NULL,
	"active" bigint DEFAULT 1 NOT NULL,
	"created_at" bigint NOT NULL
);

CREATE TABLE "promo_redemptions" (
	"user_id" text NOT NULL,
	"code" text NOT NULL,
	"created_at" bigint NOT NULL
);

CREATE TABLE "plaza_listings" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"have" text NOT NULL,
	"want" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL CHECK ("status" IN ('active','reserved','closed','completed')),
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"ready_until" bigint DEFAULT 0 NOT NULL
);

CREATE TABLE "plaza_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"offer_id" text NOT NULL,
	"sender_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" bigint NOT NULL
);

CREATE TABLE "plaza_offers" (
	"id" text PRIMARY KEY NOT NULL,
	"listing_id" text NOT NULL,
	"from_id" text NOT NULL,
	"to_id" text NOT NULL,
	"have" text NOT NULL,
	"want" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL CHECK ("status" IN ('pending','accepted','declined','cancelled','completed')),
	"from_confirmed" bigint DEFAULT 0 NOT NULL CHECK ("from_confirmed" IN (0,1)),
	"to_confirmed" bigint DEFAULT 0 NOT NULL CHECK ("to_confirmed" IN (0,1)),
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CHECK ("from_id" != "to_id")
);

CREATE TABLE "plaza_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"reporter_id" text NOT NULL,
	"listing_id" text,
	"offer_id" text,
	"reason" text NOT NULL,
	"created_at" bigint NOT NULL,
	CHECK ("listing_id" IS NOT NULL OR "offer_id" IS NOT NULL)
);

CREATE TABLE "roskins_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"login" text NOT NULL,
	"password_hash" text NOT NULL,
	"recovery_hash" text NOT NULL,
	"created_at" bigint NOT NULL
);

CREATE TABLE "roskins_auth_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" bigint NOT NULL,
	"expires_at" bigint NOT NULL
);

CREATE TABLE "roskins_sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL
);

CREATE TABLE "plaza_audit" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" bigint NOT NULL
);

CREATE TABLE "plaza_bookmarks" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"listing_id" text NOT NULL,
	"created_at" bigint NOT NULL
);

CREATE TABLE "plaza_listing_moderation" (
	"listing_id" text PRIMARY KEY NOT NULL,
	"hidden" bigint DEFAULT 0 NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" bigint NOT NULL
);

CREATE TABLE "plaza_notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"ref_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"created_at" bigint NOT NULL,
	"read_at" bigint DEFAULT 0 NOT NULL,
	"push_state" bigint DEFAULT 0 NOT NULL,
	"push_at" bigint DEFAULT 0 NOT NULL
);

CREATE TABLE "plaza_push_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"session_hash" text NOT NULL,
	"created_at" bigint NOT NULL,
	"last_sent_at" bigint DEFAULT 0 NOT NULL
);

CREATE TABLE "plaza_report_review" (
	"report_id" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" bigint NOT NULL
);

CREATE TABLE "plaza_roblox_cache" (
	"username" text PRIMARY KEY NOT NULL,
	"roblox_id" text NOT NULL,
	"expires_at" bigint NOT NULL
);

CREATE TABLE "plaza_roles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"created_at" bigint NOT NULL
);

CREATE TABLE "plaza_searches" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"pet" text NOT NULL,
	"variant" text DEFAULT 'any' NOT NULL,
	"ready_only" bigint DEFAULT 0 NOT NULL,
	"fly" bigint DEFAULT -1 NOT NULL,
	"ride" bigint DEFAULT -1 NOT NULL,
	"created_at" bigint NOT NULL
);

CREATE TABLE "plaza_user_moderation" (
	"user_id" text PRIMARY KEY NOT NULL,
	"banned" bigint DEFAULT 0 NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" bigint NOT NULL
);

CREATE TABLE "roskins_terms_acceptance" (
	"user_id" text NOT NULL,
	"version" text NOT NULL,
	"accepted_at" bigint NOT NULL
);

ALTER TABLE "orders" ADD "fee_bps" bigint;

ALTER TABLE "orders" ADD "commission_minor" bigint;

ALTER TABLE "orders" ADD "seller_net_minor" bigint;

ALTER TABLE "orders" ADD "promo_code" text;

CREATE UNIQUE INDEX "favorite_unique" ON "favorites" ("user_id","listing_id");

CREATE INDEX "listing_status" ON "listings" ("status");

CREATE INDEX "listing_seller" ON "listings" ("seller_id");

CREATE INDEX "message_order" ON "messages" ("order_id");

CREATE INDEX "order_buyer" ON "orders" ("buyer_id");

CREATE INDEX "order_seller" ON "orders" ("seller_id");

CREATE UNIQUE INDEX "profile_nickname" ON "profiles" ("nickname");

CREATE UNIQUE INDEX "redemption_once" ON "promo_redemptions" ("user_id");

CREATE INDEX "redemption_code" ON "promo_redemptions" ("code");

CREATE INDEX "plaza_listing_board" ON "plaza_listings" ("status","expires_at","created_at");

CREATE INDEX "plaza_listing_owner" ON "plaza_listings" ("owner_id","created_at");

CREATE INDEX "plaza_message_offer" ON "plaza_messages" ("offer_id","created_at");

CREATE INDEX "plaza_message_rate" ON "plaza_messages" ("sender_id","created_at");

CREATE INDEX "plaza_offer_from" ON "plaza_offers" ("from_id","updated_at");

CREATE INDEX "plaza_offer_to" ON "plaza_offers" ("to_id","updated_at");

CREATE INDEX "plaza_report_rate" ON "plaza_reports" ("reporter_id","created_at");

CREATE UNIQUE INDEX plaza_offer_duplicate ON plaza_offers(listing_id,from_id) WHERE status IN ('pending','accepted');

CREATE UNIQUE INDEX plaza_offer_one_accepted ON plaza_offers(listing_id) WHERE status='accepted';

CREATE UNIQUE INDEX "roskins_account_login" ON "roskins_accounts" ("login");

CREATE INDEX "roskins_auth_limit_expiry" ON "roskins_auth_limits" ("expires_at");

CREATE INDEX "roskins_session_user" ON "roskins_sessions" ("user_id");

CREATE INDEX "roskins_session_expiry" ON "roskins_sessions" ("expires_at");

CREATE INDEX "plaza_audit_time" ON "plaza_audit" ("created_at");

CREATE UNIQUE INDEX "plaza_bookmark_unique" ON "plaza_bookmarks" ("user_id","listing_id");

CREATE INDEX "plaza_bookmark_user" ON "plaza_bookmarks" ("user_id","created_at");

CREATE INDEX "plaza_notification_user" ON "plaza_notifications" ("user_id","created_at");

CREATE INDEX "plaza_notification_delivery" ON "plaza_notifications" ("push_state","created_at");

CREATE UNIQUE INDEX "plaza_push_endpoint" ON "plaza_push_subscriptions" ("endpoint");

CREATE INDEX "plaza_push_user" ON "plaza_push_subscriptions" ("user_id");

CREATE INDEX "plaza_search_user" ON "plaza_searches" ("user_id","created_at");

CREATE INDEX "plaza_search_pet" ON "plaza_searches" ("pet");

CREATE UNIQUE INDEX "roskins_terms_user_version" ON "roskins_terms_acceptance" ("user_id","version");

ALTER TABLE "favorites" ADD FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE "favorites" ADD FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE "listings" ADD FOREIGN KEY ("seller_id") REFERENCES "profiles"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE "messages" ADD FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE "messages" ADD FOREIGN KEY ("sender_id") REFERENCES "profiles"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE "orders" ADD FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE "orders" ADD FOREIGN KEY ("buyer_id") REFERENCES "profiles"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE "orders" ADD FOREIGN KEY ("seller_id") REFERENCES "profiles"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE "promo_redemptions" ADD FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE "promo_redemptions" ADD FOREIGN KEY ("code") REFERENCES "promo_codes"("code") ON UPDATE no action ON DELETE no action;

ALTER TABLE "plaza_listings" ADD FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE "plaza_messages" ADD FOREIGN KEY ("offer_id") REFERENCES "plaza_offers"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE "plaza_messages" ADD FOREIGN KEY ("sender_id") REFERENCES "profiles"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE "plaza_offers" ADD FOREIGN KEY ("listing_id") REFERENCES "plaza_listings"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE "plaza_offers" ADD FOREIGN KEY ("from_id") REFERENCES "profiles"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE "plaza_offers" ADD FOREIGN KEY ("to_id") REFERENCES "profiles"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE "plaza_reports" ADD FOREIGN KEY ("reporter_id") REFERENCES "profiles"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE "plaza_reports" ADD FOREIGN KEY ("listing_id") REFERENCES "plaza_listings"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE "plaza_reports" ADD FOREIGN KEY ("offer_id") REFERENCES "plaza_offers"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE "roskins_accounts" ADD FOREIGN KEY ("id") REFERENCES "profiles"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE "roskins_sessions" ADD FOREIGN KEY ("user_id") REFERENCES "roskins_accounts"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE "plaza_audit" ADD FOREIGN KEY ("actor_id") REFERENCES "profiles"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE "plaza_bookmarks" ADD FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE "plaza_bookmarks" ADD FOREIGN KEY ("listing_id") REFERENCES "plaza_listings"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE "plaza_listing_moderation" ADD FOREIGN KEY ("listing_id") REFERENCES "plaza_listings"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE "plaza_listing_moderation" ADD FOREIGN KEY ("updated_by") REFERENCES "profiles"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE "plaza_notifications" ADD FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE "plaza_push_subscriptions" ADD FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE "plaza_report_review" ADD FOREIGN KEY ("report_id") REFERENCES "plaza_reports"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE "plaza_report_review" ADD FOREIGN KEY ("updated_by") REFERENCES "profiles"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE "plaza_roles" ADD FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE "plaza_searches" ADD FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE "plaza_user_moderation" ADD FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE "plaza_user_moderation" ADD FOREIGN KEY ("updated_by") REFERENCES "profiles"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE "roskins_terms_acceptance" ADD FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON UPDATE no action ON DELETE no action;

CREATE FUNCTION plaza_offer_accepted_fn() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
IF NEW.status='accepted' AND OLD.status='pending' THEN
UPDATE plaza_listings SET status='reserved',ready_until=0 WHERE id=NEW.listing_id;
UPDATE plaza_offers SET status='declined',updated_at=NEW.updated_at WHERE listing_id=NEW.listing_id AND id!=NEW.id AND status='pending';
END IF;
RETURN NEW;
END;
$$;
CREATE TRIGGER plaza_offer_accepted AFTER UPDATE OF status ON plaza_offers FOR EACH ROW EXECUTE FUNCTION plaza_offer_accepted_fn();

CREATE FUNCTION plaza_offer_cancelled_fn() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
IF NEW.status='cancelled' AND OLD.status='accepted' THEN
UPDATE plaza_listings SET status='active',ready_until=0 WHERE id=NEW.listing_id AND status='reserved';
END IF;
RETURN NEW;
END;
$$;
CREATE TRIGGER plaza_offer_cancelled AFTER UPDATE OF status ON plaza_offers FOR EACH ROW EXECUTE FUNCTION plaza_offer_cancelled_fn();

CREATE FUNCTION plaza_offer_completed_fn() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
IF NEW.status='completed' AND OLD.status='accepted' THEN
UPDATE plaza_listings SET status='completed',ready_until=0 WHERE id=NEW.listing_id;
END IF;
RETURN NEW;
END;
$$;
CREATE TRIGGER plaza_offer_completed AFTER UPDATE OF status ON plaza_offers FOR EACH ROW EXECUTE FUNCTION plaza_offer_completed_fn();

CREATE FUNCTION plaza_listing_closed_fn() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
IF NEW.status='closed' THEN
UPDATE plaza_offers SET status='declined',updated_at=floor(extract(epoch FROM clock_timestamp())*1000)::bigint WHERE listing_id=NEW.id AND status='pending';
END IF;
RETURN NEW;
END;
$$;
CREATE TRIGGER plaza_listing_closed AFTER UPDATE OF status ON plaza_listings FOR EACH ROW EXECUTE FUNCTION plaza_listing_closed_fn();

CREATE FUNCTION plaza_notify_new_offer_fn() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
INSERT INTO plaza_notifications (id,user_id,kind,ref_id,title,body,created_at)
 VALUES ('offer:'||NEW.id,NEW.to_id,'offer',NEW.id,'Новое предложение обмена','Игрок предложил обмен. Открой предложения, чтобы ответить.',NEW.created_at) ON CONFLICT DO NOTHING;
RETURN NEW;
END;
$$;
CREATE TRIGGER plaza_notify_new_offer AFTER INSERT ON plaza_offers FOR EACH ROW EXECUTE FUNCTION plaza_notify_new_offer_fn();

CREATE FUNCTION plaza_notify_message_fn() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
INSERT INTO plaza_notifications (id,user_id,kind,ref_id,title,body,created_at)
 SELECT 'message:'||NEW.id,CASE WHEN NEW.sender_id=o.from_id THEN o.to_id ELSE o.from_id END,'message',NEW.offer_id,'Новое сообщение','В обсуждении обмена появилось сообщение.',NEW.created_at
 FROM plaza_offers o WHERE o.id=NEW.offer_id ON CONFLICT DO NOTHING;
RETURN NEW;
END;
$$;
CREATE TRIGGER plaza_notify_message AFTER INSERT ON plaza_messages FOR EACH ROW EXECUTE FUNCTION plaza_notify_message_fn();

CREATE FUNCTION plaza_notify_offer_status_fn() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
IF NEW.status!=OLD.status THEN
INSERT INTO plaza_notifications (id,user_id,kind,ref_id,title,body,created_at)
 SELECT 'status:'||NEW.id||':'||NEW.status||':from',NEW.from_id,'offer',NEW.id,'Статус обмена изменился',CASE NEW.status WHEN 'accepted' THEN 'Предложение принято. Можно договориться о встрече.' WHEN 'completed' THEN 'Оба участника подтвердили обмен.' WHEN 'declined' THEN 'Предложение отклонено.' ELSE 'Договорённость отменена.' END,NEW.updated_at ON CONFLICT DO NOTHING;
INSERT INTO plaza_notifications (id,user_id,kind,ref_id,title,body,created_at)
 SELECT 'status:'||NEW.id||':'||NEW.status||':to',NEW.to_id,'offer',NEW.id,'Статус обмена изменился',CASE NEW.status WHEN 'accepted' THEN 'Предложение принято. Можно договориться о встрече.' WHEN 'completed' THEN 'Оба участника подтвердили обмен.' WHEN 'declined' THEN 'Предложение отклонено.' ELSE 'Договорённость отменена.' END,NEW.updated_at ON CONFLICT DO NOTHING;
END IF;
RETURN NEW;
END;
$$;
CREATE TRIGGER plaza_notify_offer_status AFTER UPDATE OF status ON plaza_offers FOR EACH ROW EXECUTE FUNCTION plaza_notify_offer_status_fn();

CREATE FUNCTION plaza_notify_saved_search_fn() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
IF NEW.status='active' THEN
INSERT INTO plaza_notifications (id,user_id,kind,ref_id,title,body,created_at)
 SELECT 'search:'||s.id||':'||NEW.id,s.user_id,'search',NEW.id,'Новый трейд по твоему поиску','Появилось объявление с нужным питомцем. Посмотри, что игрок хочет взамен.',floor(extract(epoch FROM clock_timestamp())*1000)::bigint
 FROM plaza_searches s WHERE s.user_id!=NEW.owner_id
 AND NEW.expires_at>floor(extract(epoch FROM clock_timestamp())*1000)::bigint
 AND (s.ready_only=0 OR NEW.ready_until>floor(extract(epoch FROM clock_timestamp())*1000)::bigint)
 AND NOT EXISTS (SELECT 1 FROM plaza_user_moderation m WHERE m.user_id IN (NEW.owner_id,s.user_id) AND m.banned=1)
 AND NOT EXISTS (SELECT 1 FROM plaza_listing_moderation m WHERE m.listing_id=NEW.id AND m.hidden=1)
 AND EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.have::jsonb) j WHERE (j.value->>'pet')=s.pet
 AND (s.variant='any' OR (j.value->>'variant')=s.variant)
 AND (s.fly=-1 OR ((j.value->>'fly')::boolean)::integer=s.fly)
 AND (s.ride=-1 OR ((j.value->>'ride')::boolean)::integer=s.ride)) ON CONFLICT DO NOTHING;
END IF;
RETURN NEW;
END;
$$;
CREATE TRIGGER plaza_notify_saved_search AFTER INSERT ON plaza_listings FOR EACH ROW EXECUTE FUNCTION plaza_notify_saved_search_fn();

CREATE FUNCTION plaza_notify_ready_search_fn() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
IF NEW.status='active' THEN
INSERT INTO plaza_notifications (id,user_id,kind,ref_id,title,body,created_at)
 SELECT 'search:'||s.id||':'||NEW.id,s.user_id,'search',NEW.id,'Новый трейд по твоему поиску','Появилось объявление с нужным питомцем. Посмотри, что игрок хочет взамен.',floor(extract(epoch FROM clock_timestamp())*1000)::bigint
 FROM plaza_searches s WHERE s.user_id!=NEW.owner_id AND s.ready_only=1 AND NEW.ready_until>OLD.ready_until
 AND NEW.expires_at>floor(extract(epoch FROM clock_timestamp())*1000)::bigint
 AND (s.ready_only=0 OR NEW.ready_until>floor(extract(epoch FROM clock_timestamp())*1000)::bigint)
 AND NOT EXISTS (SELECT 1 FROM plaza_user_moderation m WHERE m.user_id IN (NEW.owner_id,s.user_id) AND m.banned=1)
 AND NOT EXISTS (SELECT 1 FROM plaza_listing_moderation m WHERE m.listing_id=NEW.id AND m.hidden=1)
 AND EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.have::jsonb) j WHERE (j.value->>'pet')=s.pet
 AND (s.variant='any' OR (j.value->>'variant')=s.variant)
 AND (s.fly=-1 OR ((j.value->>'fly')::boolean)::integer=s.fly)
 AND (s.ride=-1 OR ((j.value->>'ride')::boolean)::integer=s.ride)) ON CONFLICT DO NOTHING;
END IF;
RETURN NEW;
END;
$$;
CREATE TRIGGER plaza_notify_ready_search AFTER UPDATE OF ready_until ON plaza_listings FOR EACH ROW EXECUTE FUNCTION plaza_notify_ready_search_fn();
