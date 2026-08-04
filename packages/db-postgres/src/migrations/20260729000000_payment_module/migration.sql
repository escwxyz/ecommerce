CREATE TABLE IF NOT EXISTS "payment_provider" (
  "id" text PRIMARY KEY NOT NULL,
  "provider_key" text NOT NULL,
  "provider_record_id" text NOT NULL,
  "is_enabled" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_provider_key_idx" ON "payment_provider" ("provider_key");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_account_holder" (
  "id" text PRIMARY KEY NOT NULL,
  "customer_id" text NOT NULL,
  "provider_key" text NOT NULL,
  "provider_account_holder_id" text NOT NULL,
  "email" text,
  "metadata_json" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_account_holder_provider_idx" ON "payment_account_holder" ("provider_key", "provider_account_holder_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_method" (
  "id" text PRIMARY KEY NOT NULL,
  "account_holder_id" text,
  "provider_key" text NOT NULL,
  "provider_payment_method_id" text NOT NULL,
  "type" text NOT NULL,
  "display_name" text,
  "reusable" text NOT NULL,
  "metadata_json" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "payment_method_account_holder_id_payment_account_holder_id_fk"
    FOREIGN KEY ("account_holder_id") REFERENCES "payment_account_holder"("id")
    ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_method_account_holder_idx" ON "payment_method" ("account_holder_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_collection" (
  "id" text PRIMARY KEY NOT NULL,
  "cart_id" text,
  "amount" integer NOT NULL,
  "currency_code" text NOT NULL,
  "status" text NOT NULL,
  "metadata_json" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_collection_status_idx" ON "payment_collection" ("status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_session" (
  "id" text PRIMARY KEY NOT NULL,
  "collection_id" text NOT NULL,
  "provider_key" text NOT NULL,
  "provider_checkout_session_id" text,
  "provider_payment_intent_id" text,
  "amount" integer NOT NULL,
  "currency_code" text NOT NULL,
  "status" text NOT NULL,
  "metadata_json" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "payment_session_collection_id_payment_collection_id_fk"
    FOREIGN KEY ("collection_id") REFERENCES "payment_collection"("id")
    ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_session_collection_idx" ON "payment_session" ("collection_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_provider_intent_session_idx" ON "payment_session" ("provider_key", "provider_payment_intent_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment" (
  "id" text PRIMARY KEY NOT NULL,
  "collection_id" text NOT NULL,
  "session_id" text NOT NULL,
  "provider_key" text NOT NULL,
  "provider_payment_intent_id" text NOT NULL,
  "amount" integer NOT NULL,
  "currency_code" text NOT NULL,
  "status" text NOT NULL,
  "metadata_json" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "payment_collection_id_payment_collection_id_fk"
    FOREIGN KEY ("collection_id") REFERENCES "payment_collection"("id")
    ON DELETE CASCADE,
  CONSTRAINT "payment_session_id_payment_session_id_fk"
    FOREIGN KEY ("session_id") REFERENCES "payment_session"("id")
    ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_provider_intent_idx" ON "payment" ("provider_key", "provider_payment_intent_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_capture" (
  "id" text PRIMARY KEY NOT NULL,
  "payment_id" text NOT NULL,
  "idempotency_key" text NOT NULL,
  "provider_capture_id" text,
  "amount" integer NOT NULL,
  "currency_code" text NOT NULL,
  "status" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  CONSTRAINT "payment_capture_payment_id_payment_id_fk"
    FOREIGN KEY ("payment_id") REFERENCES "payment"("id")
    ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_capture_idempotency_idx" ON "payment_capture" ("idempotency_key");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_refund" (
  "id" text PRIMARY KEY NOT NULL,
  "payment_id" text NOT NULL,
  "idempotency_key" text NOT NULL,
  "provider_refund_id" text NOT NULL,
  "amount" integer NOT NULL,
  "currency_code" text NOT NULL,
  "status" text NOT NULL,
  "reason" text,
  "created_at" timestamp with time zone NOT NULL,
  CONSTRAINT "payment_refund_payment_id_payment_id_fk"
    FOREIGN KEY ("payment_id") REFERENCES "payment"("id")
    ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_refund_idempotency_idx" ON "payment_refund" ("idempotency_key");
