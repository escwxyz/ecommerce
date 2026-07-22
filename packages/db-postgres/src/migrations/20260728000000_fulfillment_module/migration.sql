CREATE TABLE IF NOT EXISTS "fulfillment_provider" (
  "id" text PRIMARY KEY,
  "provider_key" text NOT NULL,
  "provider_record_id" text NOT NULL,
  "is_enabled" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "fulfillment_provider_key_idx"
  ON "fulfillment_provider" ("provider_key");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "fulfillment_set" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "metadata_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "shipping_profile" (
  "id" text PRIMARY KEY,
  "fulfillment_set_id" text NOT NULL REFERENCES "fulfillment_set"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "metadata_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "shipping_profile_set_idx"
  ON "shipping_profile" ("fulfillment_set_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "service_zone" (
  "id" text PRIMARY KEY,
  "fulfillment_set_id" text NOT NULL REFERENCES "fulfillment_set"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "country_codes_json" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "region_ids_json" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "metadata_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "service_zone_set_idx"
  ON "service_zone" ("fulfillment_set_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "shipping_option" (
  "id" text PRIMARY KEY,
  "fulfillment_set_id" text NOT NULL REFERENCES "fulfillment_set"("id") ON DELETE CASCADE,
  "profile_id" text NOT NULL REFERENCES "shipping_profile"("id") ON DELETE CASCADE,
  "service_zone_id" text NOT NULL REFERENCES "service_zone"("id") ON DELETE CASCADE,
  "provider_key" text NOT NULL,
  "provider_service_id" text NOT NULL,
  "name" text NOT NULL,
  "price_amount" text,
  "currency_code" text,
  "is_enabled" text NOT NULL,
  "metadata_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "shipping_option_set_idx"
  ON "shipping_option" ("fulfillment_set_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "shipping_option_provider_idx"
  ON "shipping_option" ("provider_key", "provider_service_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "fulfillment" (
  "id" text PRIMARY KEY,
  "idempotency_key" text NOT NULL,
  "order_id" text NOT NULL,
  "shipping_option_id" text NOT NULL REFERENCES "shipping_option"("id") ON DELETE RESTRICT,
  "provider_key" text NOT NULL,
  "provider_fulfillment_id" text,
  "status" text NOT NULL,
  "items_json" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "address_json" jsonb,
  "metadata_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "fulfillment_idempotency_idx"
  ON "fulfillment" ("idempotency_key");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "fulfillment_order_idx"
  ON "fulfillment" ("order_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "shipment" (
  "id" text PRIMARY KEY,
  "fulfillment_id" text NOT NULL REFERENCES "fulfillment"("id") ON DELETE CASCADE,
  "provider_shipment_id" text NOT NULL,
  "status" text NOT NULL,
  "carrier" text,
  "tracking_number" text,
  "tracking_url" text,
  "label_url" text,
  "metadata_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "shipment_fulfillment_idx"
  ON "shipment" ("fulfillment_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "return_shipment_link" (
  "id" text PRIMARY KEY,
  "fulfillment_id" text NOT NULL REFERENCES "fulfillment"("id") ON DELETE CASCADE,
  "shipment_id" text NOT NULL REFERENCES "shipment"("id") ON DELETE CASCADE,
  "return_id" text NOT NULL,
  "provider_return_id" text,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "return_shipment_fulfillment_idx"
  ON "return_shipment_link" ("fulfillment_id");
