CREATE TABLE IF NOT EXISTS "cart" (
  "id" text PRIMARY KEY NOT NULL,
  "customer_id" text,
  "email" text,
  "region_id" text,
  "sales_channel_id" text,
  "currency_code" text NOT NULL,
  "shipping_option_id" text,
  "payment_collection_id" text,
  "billing_address_json" jsonb,
  "shipping_address_json" jsonb,
  "totals_json" jsonb NOT NULL,
  "metadata_json" jsonb NOT NULL,
  "status" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cart_created_at_idx" ON "cart" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cart_customer_idx" ON "cart" USING btree ("customer_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cart_status_idx" ON "cart" USING btree ("status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cart_line_item" (
  "id" text PRIMARY KEY NOT NULL,
  "cart_id" text NOT NULL REFERENCES "cart"("id") ON DELETE cascade,
  "product_id" text NOT NULL,
  "variant_id" text NOT NULL,
  "title" text NOT NULL,
  "quantity" integer NOT NULL,
  "unit_price" integer NOT NULL,
  "metadata_json" jsonb NOT NULL,
  "idempotency_key" text,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cart_line_item_cart_idx" ON "cart_line_item" USING btree ("cart_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cart_line_item_idempotency_idx" ON "cart_line_item" USING btree ("idempotency_key");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cart_adjustment" (
  "id" text PRIMARY KEY NOT NULL,
  "cart_id" text NOT NULL REFERENCES "cart"("id") ON DELETE cascade,
  "line_item_id" text REFERENCES "cart_line_item"("id") ON DELETE set null,
  "type" text NOT NULL,
  "source" text NOT NULL,
  "amount" integer NOT NULL,
  "metadata_json" jsonb NOT NULL,
  "idempotency_key" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cart_adjustment_cart_idx" ON "cart_adjustment" USING btree ("cart_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cart_adjustment_idempotency_idx" ON "cart_adjustment" USING btree ("idempotency_key");
