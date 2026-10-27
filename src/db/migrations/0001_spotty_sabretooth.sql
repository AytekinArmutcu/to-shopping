CREATE TABLE `pantry` (
	`product_id` text PRIMARY KEY NOT NULL,
	`added_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
