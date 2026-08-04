CREATE TABLE IF NOT EXISTS "order_record" (
  "id" text PRIMARY KEY NOT NULL,
  "cart_id" text NOT NULL,
  "customer_id" text,
  "email" text,
  "status" text NOT NULL,
  "currency_code" text NOT NULL,
  "totals_json" jsonb NOT NULL,
  "billing_address_json" jsonb,
  "shipping_address_json" jsonb,
  "payment_references_json" jsonb NOT NULL,
  "fulfillment_references_json" jsonb NOT NULL,
  "metadata_json" jsonb NOT NULL,
  "idempotency_key" text NOT NULL,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_cart_id_idx" ON "order_record" USING btree ("cart_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_customer_id_idx" ON "order_record" USING btree ("customer_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "order_idempotency_key_idx" ON "order_record" USING btree ("idempotency_key");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_line_item" (
  "id" text PRIMARY KEY NOT NULL,
  "order_id" text NOT NULL REFERENCES "order_record"("id") ON DELETE cascade,
  "title" text NOT NULL,
  "quantity" integer NOT NULL,
  "unit_price" integer NOT NULL,
  "tax_total" integer NOT NULL,
  "total" integer NOT NULL,
  "item_snapshot_json" jsonb NOT NULL,
  "metadata_json" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_line_item_order_id_idx" ON "order_line_item" USING btree ("order_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_transaction" (
  "id" text PRIMARY KEY NOT NULL,
  "order_id" text NOT NULL REFERENCES "order_record"("id") ON DELETE cascade,
  "type" text NOT NULL,
  "amount" integer NOT NULL,
  "currency_code" text NOT NULL,
  "reference_id" text,
  "metadata_json" jsonb NOT NULL,
  "idempotency_key" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_transaction_order_id_idx" ON "order_transaction" USING btree ("order_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "order_transaction_idempotency_key_idx" ON "order_transaction" USING btree ("idempotency_key");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_state_transition" (
  "order_id" text NOT NULL REFERENCES "order_record"("id") ON DELETE cascade,
  "from_status" text,
  "to_status" text NOT NULL,
  "metadata_json" jsonb NOT NULL,
  "idempotency_key" text NOT NULL,
  "changed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_state_transition_order_id_idx" ON "order_state_transition" USING btree ("order_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "order_state_transition_idempotency_key_idx" ON "order_state_transition" USING btree ("idempotency_key");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_post_purchase_operation" (
  "id" text PRIMARY KEY NOT NULL,
  "order_id" text NOT NULL REFERENCES "order_record"("id") ON DELETE cascade,
  "type" text NOT NULL,
  "status" text NOT NULL,
  "metadata_json" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_operation_order_id_idx" ON "order_post_purchase_operation" USING btree ("order_id");
