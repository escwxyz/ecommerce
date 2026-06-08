ALTER TABLE product ADD COLUMN catalog_metadata TEXT NOT NULL DEFAULT '{}';
ALTER TABLE product ADD COLUMN catalog_searchable_text TEXT NOT NULL DEFAULT '';
ALTER TABLE product ADD COLUMN catalog_published_at INTEGER;

CREATE TABLE IF NOT EXISTS product_variant (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  sku TEXT,
  status TEXT NOT NULL,
  option_value_ids TEXT NOT NULL,
  searchable_text TEXT,
  metadata TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS product_variant_product_id_idx ON product_variant(product_id);

CREATE TABLE IF NOT EXISTS product_option (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  metadata TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS product_option_product_id_title_idx ON product_option(product_id, title);

CREATE TABLE IF NOT EXISTS product_option_value (
  id TEXT PRIMARY KEY,
  option_id TEXT NOT NULL REFERENCES product_option(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  value TEXT NOT NULL,
  metadata TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS product_option_value_option_id_value_idx ON product_option_value(option_id, value);

CREATE TABLE IF NOT EXISTS product_variant_option (
  variant_id TEXT NOT NULL REFERENCES product_variant(id) ON DELETE CASCADE,
  option_value_id TEXT NOT NULL REFERENCES product_option_value(id) ON DELETE CASCADE,
  PRIMARY KEY (variant_id, option_value_id)
);

CREATE TABLE IF NOT EXISTS product_collection (
  id TEXT PRIMARY KEY,
  handle TEXT NOT NULL,
  title TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS product_collection_handle_idx ON product_collection(handle);

CREATE TABLE IF NOT EXISTS product_collection_product (
  product_id TEXT NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  product_collection_id TEXT NOT NULL REFERENCES product_collection(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, product_collection_id)
);

CREATE TABLE IF NOT EXISTS product_category (
  id TEXT PRIMARY KEY,
  handle TEXT NOT NULL,
  title TEXT NOT NULL,
  parent_id TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS product_category_handle_idx ON product_category(handle);

CREATE TABLE IF NOT EXISTS product_category_product (
  product_id TEXT NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  product_category_id TEXT NOT NULL REFERENCES product_category(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, product_category_id)
);

CREATE TABLE IF NOT EXISTS product_media (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  type TEXT NOT NULL,
  alt_text TEXT,
  metadata TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS product_tag (
  id TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS product_tag_value_idx ON product_tag(value);

CREATE TABLE IF NOT EXISTS product_tags (
  product_id TEXT NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  product_tag_id TEXT NOT NULL REFERENCES product_tag(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, product_tag_id)
);

CREATE TABLE IF NOT EXISTS product_type (
  id TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS product_type_value_idx ON product_type(value);

CREATE TABLE IF NOT EXISTS product_type_product (
  product_id TEXT NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  product_type_id TEXT NOT NULL REFERENCES product_type(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, product_type_id)
);
