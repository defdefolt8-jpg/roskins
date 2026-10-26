ALTER TABLE `orders` ADD `fee_bps` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `commission_minor` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `seller_net_minor` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `promo_code` text;