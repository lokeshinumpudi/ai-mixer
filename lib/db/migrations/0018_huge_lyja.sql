ALTER TABLE "Chat" ADD COLUMN "shareToken" varchar(64);--> statement-breakpoint
ALTER TABLE "Chat" ADD COLUMN "sharedAt" timestamp;--> statement-breakpoint
ALTER TABLE "Chat" ADD COLUMN "sharedBy" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Chat" ADD CONSTRAINT "Chat_sharedBy_User_id_fk" FOREIGN KEY ("sharedBy") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
