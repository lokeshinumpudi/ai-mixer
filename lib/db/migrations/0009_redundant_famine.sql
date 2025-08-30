CREATE TABLE IF NOT EXISTS "PaymentEvent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paymentId" varchar(64) NOT NULL,
	"orderId" varchar(64),
	"userId" uuid NOT NULL,
	"eventType" varchar(32) NOT NULL,
	"status" varchar(32) NOT NULL,
	"amountPaise" integer NOT NULL,
	"currency" varchar(8) DEFAULT 'INR' NOT NULL,
	"method" varchar(32),
	"errorCode" varchar(64),
	"errorDescription" text,
	"metadata" json,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Refund" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"refundId" varchar(64) NOT NULL,
	"paymentId" varchar(64) NOT NULL,
	"userId" uuid NOT NULL,
	"amountPaise" integer NOT NULL,
	"currency" varchar(8) DEFAULT 'INR' NOT NULL,
	"status" varchar(32) NOT NULL,
	"reason" varchar(128),
	"errorCode" varchar(64),
	"razorpayCreatedAt" timestamp,
	"processedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Refund_refundId_unique" UNIQUE("refundId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ServiceDowntime" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"downtimeId" varchar(64) NOT NULL,
	"method" varchar(32) NOT NULL,
	"status" varchar(32) NOT NULL,
	"severity" varchar(16) NOT NULL,
	"instrument" json,
	"startedAt" timestamp,
	"resolvedAt" timestamp,
	"scheduled" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ServiceDowntime_downtimeId_unique" UNIQUE("downtimeId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "UserNotification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"type" varchar(32) NOT NULL,
	"title" varchar(128) NOT NULL,
	"message" text NOT NULL,
	"metadata" json,
	"read" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Refund" ADD CONSTRAINT "Refund_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserNotification" ADD CONSTRAINT "UserNotification_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
