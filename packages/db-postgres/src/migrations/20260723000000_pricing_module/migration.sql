CREATE TABLE IF NOT EXISTS "pricing_currency" (
  "id" text PRIMARY KEY,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "precision" integer NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "pricing_currency_code_idx"
  ON "pricing_currency" ("code");

CREATE INDEX IF NOT EXISTS "pricing_currency_created_at_idx"
  ON "pricing_currency" ("created_at");

CREATE TABLE IF NOT EXISTS "pricing_price_set" (
  "id" text PRIMARY KEY,
  "title" text NOT NULL,
  "metadata_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

CREATE INDEX IF NOT EXISTS "pricing_price_set_created_at_idx"
  ON "pricing_price_set" ("created_at");

CREATE TABLE IF NOT EXISTS "pricing_price_list" (
  "id" text PRIMARY KEY,
  "title" text NOT NULL,
  "description" text,
  "status" text NOT NULL,
  "starts_at" timestamp with time zone,
  "ends_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

CREATE INDEX IF NOT EXISTS "pricing_price_list_created_at_idx"
  ON "pricing_price_list" ("created_at");

CREATE INDEX IF NOT EXISTS "pricing_price_list_status_idx"
  ON "pricing_price_list" ("status");

CREATE TABLE IF NOT EXISTS "pricing_money_amount" (
  "id" text PRIMARY KEY,
  "price_set_id" text NOT NULL REFERENCES "pricing_price_set"("id") ON DELETE CASCADE,
  "price_list_id" text REFERENCES "pricing_price_list"("id") ON DELETE SET NULL,
  "currency_code" text NOT NULL REFERENCES "pricing_currency"("code") ON DELETE RESTRICT,
  "amount" integer NOT NULL,
  "rules_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

CREATE INDEX IF NOT EXISTS "pricing_money_amount_price_set_idx"
  ON "pricing_money_amount" ("price_set_id");

CREATE INDEX IF NOT EXISTS "pricing_money_amount_currency_idx"
  ON "pricing_money_amount" ("currency_code");

CREATE TABLE IF NOT EXISTS "pricing_price_rule" (
  "id" text PRIMARY KEY,
  "price_list_id" text NOT NULL REFERENCES "pricing_price_list"("id") ON DELETE CASCADE,
  "attribute" text NOT NULL,
  "value" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

CREATE INDEX IF NOT EXISTS "pricing_price_rule_price_list_idx"
  ON "pricing_price_rule" ("price_list_id");

CREATE TABLE IF NOT EXISTS "pricing_price_preference" (
  "id" text PRIMARY KEY,
  "attribute" text NOT NULL,
  "value" text NOT NULL,
  "currency_code" text NOT NULL REFERENCES "pricing_currency"("code") ON DELETE RESTRICT,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

CREATE INDEX IF NOT EXISTS "pricing_price_preference_scope_idx"
  ON "pricing_price_preference" ("attribute", "value");
