CREATE TABLE IF NOT EXISTS "CompareResult" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"runId" uuid NOT NULL,
	"modelId" varchar(64) NOT NULL,
	"status" varchar(32) DEFAULT 'running' NOT NULL,
	"content" text DEFAULT '',
	"usage" json,
	"error" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"completedAt" timestamp,
	CONSTRAINT "CompareResult_runId_modelId_pk" PRIMARY KEY("runId","modelId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "CompareRun" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"chatId" uuid NOT NULL,
	"prompt" text NOT NULL,
	"modelIds" json NOT NULL,
	"status" varchar(32) DEFAULT 'running' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "CompareResult" ADD CONSTRAINT "CompareResult_runId_CompareRun_id_fk" FOREIGN KEY ("runId") REFERENCES "public"."CompareRun"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "CompareRun" ADD CONSTRAINT "CompareRun_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "CompareRun" ADD CONSTRAINT "CompareRun_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
