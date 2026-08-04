CREATE TABLE "promotion_campaign" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "metadata_json" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promotion_promotion" (
  "id" text PRIMARY KEY NOT NULL,
  "campaign_id" text,
  "code" text,
  "title" text NOT NULL,
  "status" text NOT NULL,
  "application_method_json" jsonb NOT NULL,
  "starts_at" timestamp with time zone,
  "ends_at" timestamp with time zone,
  "metadata_json" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promotion_rule" (
  "id" text PRIMARY KEY NOT NULL,
  "promotion_id" text NOT NULL,
  "attribute" text NOT NULL,
  "value" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promotion_usage_limit" (
  "id" text PRIMARY KEY NOT NULL,
  "promotion_id" text NOT NULL,
  "scope" text NOT NULL,
  "limit_value" integer NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promotion_redemption" (
  "id" text PRIMARY KEY NOT NULL,
  "promotion_id" text NOT NULL,
  "cart_id" text NOT NULL,
  "adjustment_ids_json" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "promotion_promotion" ADD CONSTRAINT "promotion_promotion_campaign_id_promotion_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "promotion_campaign"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "promotion_rule" ADD CONSTRAINT "promotion_rule_promotion_id_promotion_promotion_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "promotion_promotion"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "promotion_usage_limit" ADD CONSTRAINT "promotion_usage_limit_promotion_id_promotion_promotion_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "promotion_promotion"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "promotion_redemption" ADD CONSTRAINT "promotion_redemption_promotion_id_promotion_promotion_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "promotion_promotion"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "promotion_campaign_created_at_idx" ON "promotion_campaign" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX "promotion_campaign_idx" ON "promotion_promotion" USING btree ("campaign_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "promotion_code_idx" ON "promotion_promotion" USING btree ("code");
--> statement-breakpoint
CREATE INDEX "promotion_created_at_idx" ON "promotion_promotion" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX "promotion_status_idx" ON "promotion_promotion" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "promotion_rule_promotion_idx" ON "promotion_rule" USING btree ("promotion_id");
--> statement-breakpoint
CREATE INDEX "promotion_usage_limit_promotion_idx" ON "promotion_usage_limit" USING btree ("promotion_id");
--> statement-breakpoint
CREATE INDEX "promotion_redemption_promotion_idx" ON "promotion_redemption" USING btree ("promotion_id");
