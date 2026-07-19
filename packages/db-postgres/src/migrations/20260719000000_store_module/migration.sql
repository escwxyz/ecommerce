CREATE TABLE IF NOT EXISTS "store" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "default_currency_code" text NOT NULL,
  "supported_currency_codes_json" jsonb NOT NULL,
  "default_locale" text NOT NULL,
  "default_region_id" text,
  "default_sales_channel_id" text,
  "timezone" text NOT NULL,
  "metadata_json" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "store_updated_at_idx"
  ON "store" ("updated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "store_default_currency_idx"
  ON "store" ("default_currency_code");
