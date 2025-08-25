ALTER TABLE "Chat" ADD COLUMN "isCompareMode" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "Chat" ADD COLUMN "selectedModels" json;--> statement-breakpoint
ALTER TABLE "Message_v2" ADD COLUMN "modelId" varchar;--> statement-breakpoint
ALTER TABLE "Message_v2" ADD COLUMN "tokenUsage" json;