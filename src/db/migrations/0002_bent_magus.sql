CREATE TABLE `recipe_items` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_id` text NOT NULL,
	`product_id` text,
	`name` text NOT NULL,
	`quantity` real DEFAULT 1 NOT NULL,
	`unit` text DEFAULT 'stueck' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `recipes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`note` text,
	`is_builtin` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `weekly_plan` (
	`recipe_id` text PRIMARY KEY NOT NULL,
	`added_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade
);
