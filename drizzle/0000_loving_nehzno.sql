CREATE TABLE `assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`therapist_id` text NOT NULL,
	`test_id` text NOT NULL,
	`stage` text NOT NULL,
	`answers` text NOT NULL,
	`result` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`therapist_id`) REFERENCES `therapists`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`therapist_id` text NOT NULL,
	`code` text NOT NULL,
	`full_name` text NOT NULL,
	`age` integer NOT NULL,
	`sex` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`findings` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`therapist_id`) REFERENCES `therapists`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clients_therapist_code_unique` ON `clients` (`therapist_id`,`code`);--> statement-breakpoint
CREATE TABLE `pin_attempts` (
	`key` text PRIMARY KEY NOT NULL,
	`failures` integer DEFAULT 0 NOT NULL,
	`locked_until` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `qeeg_files` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`therapist_id` text NOT NULL,
	`object_key` text NOT NULL,
	`filename` text NOT NULL,
	`bytes` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`therapist_id`) REFERENCES `therapists`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `therapists` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`specialty` text DEFAULT 'ფსიქოლოგი' NOT NULL,
	`owner_user_id` text,
	`pin_salt` text,
	`pin_hash` text,
	`created_at` text NOT NULL
);
