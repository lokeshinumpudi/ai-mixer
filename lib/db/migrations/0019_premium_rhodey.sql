CREATE TABLE IF NOT EXISTS "ModelCache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"models" json NOT NULL,
	"lastRefreshedAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"refreshError" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Chat" DROP CONSTRAINT "Chat_sharedBy_User_id_fk";
--> statement-breakpoint
ALTER TABLE "Chat" DROP COLUMN IF EXISTS "shareToken";--> statement-breakpoint
ALTER TABLE "Chat" DROP COLUMN IF EXISTS "sharedAt";--> statement-breakpoint
ALTER TABLE "Chat" DROP COLUMN IF EXISTS "sharedBy";