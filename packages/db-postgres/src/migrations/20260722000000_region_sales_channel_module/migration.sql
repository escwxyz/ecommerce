CREATE TABLE IF NOT EXISTS "region" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "currency_code" text NOT NULL,
  "tax_provider_id" text,
  "payment_provider_ids_json" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "fulfillment_option_ids_json" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "metadata_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

CREATE INDEX IF NOT EXISTS "region_currency_idx"
  ON "region" ("currency_code");

CREATE INDEX IF NOT EXISTS "region_created_at_idx"
  ON "region" ("created_at");

CREATE TABLE IF NOT EXISTS "region_country" (
  "region_id" text NOT NULL REFERENCES "region"("id") ON DELETE CASCADE,
  "country_code" text NOT NULL,
  PRIMARY KEY ("region_id", "country_code")
);

CREATE INDEX IF NOT EXISTS "region_country_region_idx"
  ON "region_country" ("region_id");

CREATE TABLE IF NOT EXISTS "sales_channel" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "description" text,
  "status" text NOT NULL,
  "metadata_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

CREATE INDEX IF NOT EXISTS "sales_channel_created_at_idx"
  ON "sales_channel" ("created_at");

CREATE INDEX IF NOT EXISTS "sales_channel_status_idx"
  ON "sales_channel" ("status");

CREATE TABLE IF NOT EXISTS "sales_channel_product" (
  "sales_channel_id" text NOT NULL REFERENCES "sales_channel"("id") ON DELETE CASCADE,
  "product_id" text NOT NULL,
  PRIMARY KEY ("sales_channel_id", "product_id")
);

CREATE INDEX IF NOT EXISTS "sales_channel_product_channel_idx"
  ON "sales_channel_product" ("sales_channel_id");
