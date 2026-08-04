CREATE TABLE IF NOT EXISTS "customer" (
  "id" text PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "first_name" text,
  "last_name" text,
  "phone" text,
  "auth_user_id" text,
  "metadata_json" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_email_idx" ON "customer" USING btree ("email");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_auth_user_id_idx" ON "customer" USING btree ("auth_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_created_at_idx" ON "customer" USING btree ("created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_address" (
  "id" text PRIMARY KEY NOT NULL,
  "customer_id" text NOT NULL REFERENCES "customer"("id") ON DELETE cascade,
  "kind" text NOT NULL,
  "first_name" text,
  "last_name" text,
  "company" text,
  "address1" text NOT NULL,
  "address2" text,
  "city" text NOT NULL,
  "province" text,
  "postal_code" text NOT NULL,
  "country_code" text NOT NULL,
  "phone" text,
  "is_default_billing" boolean NOT NULL,
  "is_default_shipping" boolean NOT NULL,
  "metadata_json" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_address_customer_id_idx" ON "customer_address" USING btree ("customer_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_group" (
  "id" text PRIMARY KEY NOT NULL,
  "handle" text NOT NULL,
  "name" text NOT NULL,
  "metadata_json" jsonb NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_group_handle_idx" ON "customer_group" USING btree ("handle");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_group_customer" (
  "customer_id" text NOT NULL REFERENCES "customer"("id") ON DELETE cascade,
  "customer_group_id" text NOT NULL REFERENCES "customer_group"("id") ON DELETE cascade,
  PRIMARY KEY ("customer_id", "customer_group_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_group_customer_group_idx" ON "customer_group_customer" USING btree ("customer_group_id");
