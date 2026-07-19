CREATE TABLE IF NOT EXISTS "product" (
  "id" text PRIMARY KEY NOT NULL,
  "handle" text NOT NULL,
  "title" text NOT NULL,
  "status" text NOT NULL,
  "catalog_json" jsonb NOT NULL,
  "metadata_json" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "product_handle_idx" ON "product" USING btree ("handle");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_created_at_idx" ON "product" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_status_idx" ON "product" USING btree ("status");
