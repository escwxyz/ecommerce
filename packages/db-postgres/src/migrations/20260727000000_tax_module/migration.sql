CREATE TABLE "tax_category" (
  "id" text PRIMARY KEY NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "metadata_json" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint

CREATE TABLE "tax_provider_config" (
  "id" text PRIMARY KEY NOT NULL,
  "provider_key" text NOT NULL,
  "settings_json" jsonb NOT NULL,
  "is_active" text NOT NULL,
  "metadata_json" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint

CREATE TABLE "tax_region" (
  "id" text PRIMARY KEY NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "country_code" text NOT NULL,
  "provider_config_id" text,
  "metadata_json" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint

CREATE TABLE "tax_rate" (
  "id" text PRIMARY KEY NOT NULL,
  "region_id" text NOT NULL,
  "category_id" text,
  "name" text NOT NULL,
  "percentage" real NOT NULL,
  "metadata_json" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint

ALTER TABLE "tax_region" ADD CONSTRAINT "tax_region_provider_config_id_tax_provider_config_id_fk" FOREIGN KEY ("provider_config_id") REFERENCES "tax_provider_config"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "tax_rate" ADD CONSTRAINT "tax_rate_region_id_tax_region_id_fk" FOREIGN KEY ("region_id") REFERENCES "tax_region"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "tax_rate" ADD CONSTRAINT "tax_rate_category_id_tax_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "tax_category"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

CREATE INDEX "tax_category_code_idx" ON "tax_category" USING btree ("code");
--> statement-breakpoint

CREATE INDEX "tax_provider_config_key_idx" ON "tax_provider_config" USING btree ("provider_key");
--> statement-breakpoint

CREATE INDEX "tax_region_code_idx" ON "tax_region" USING btree ("code");
--> statement-breakpoint

CREATE INDEX "tax_rate_region_idx" ON "tax_rate" USING btree ("region_id");
--> statement-breakpoint

CREATE INDEX "tax_rate_category_idx" ON "tax_rate" USING btree ("category_id");
