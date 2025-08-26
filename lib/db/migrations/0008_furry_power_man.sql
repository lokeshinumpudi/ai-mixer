CREATE TABLE IF NOT EXISTS "UsageMonthly" (
	"userId" uuid NOT NULL,
	"month" date NOT NULL,
	"messages" integer DEFAULT 0 NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "UsageMonthly_userId_month_pk" PRIMARY KEY("userId","month")
);
--> statement-breakpoint
ALTER TABLE "UsageDaily" ADD COLUMN "messages" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UsageMonthly" ADD CONSTRAINT "UsageMonthly_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
