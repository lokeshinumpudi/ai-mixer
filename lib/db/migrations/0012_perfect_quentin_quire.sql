ALTER TABLE "CompareResult" ADD COLUMN "serverStartedAt" timestamp;--> statement-breakpoint
ALTER TABLE "CompareResult" ADD COLUMN "serverCompletedAt" timestamp;--> statement-breakpoint
ALTER TABLE "CompareResult" ADD COLUMN "inferenceTimeMs" integer;