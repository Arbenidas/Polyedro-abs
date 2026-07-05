CREATE TABLE "campaign_briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"campaign_id" uuid,
	"language" "language" DEFAULT 'es' NOT NULL,
	"source" text DEFAULT 'microphone' NOT NULL,
	"provider" text DEFAULT 'openai' NOT NULL,
	"model" text NOT NULL,
	"text" text NOT NULL,
	"audio_mime_type" text,
	"audio_size_bytes" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaign_briefs" ADD CONSTRAINT "campaign_briefs_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_briefs" ADD CONSTRAINT "campaign_briefs_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaign_briefs_brand_id_idx" ON "campaign_briefs" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "campaign_briefs_campaign_id_idx" ON "campaign_briefs" USING btree ("campaign_id");