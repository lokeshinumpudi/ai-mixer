ALTER TABLE "CompareResult" ADD COLUMN "reasoning" text DEFAULT '';--> statement-breakpoint
ALTER TABLE "Chat" DROP COLUMN IF EXISTS "mode";