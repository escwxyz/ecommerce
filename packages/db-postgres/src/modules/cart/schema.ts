import {
  CartAddressSchema,
  CartAdjustmentSerializedIdSchema,
  CartAdjustmentTypeSchema,
  CartApiRecordSchema,
  CartLineItemSerializedIdSchema,
  CartMetadataSchema,
  CartSerializedIdSchema,
  CartStatusSchema,
  CartTotalsSnapshotSchema,
  CartTrimmedStringSchema,
} from "@ecommerce/cart";
import {
  createInsertSchema,
  createSelectSchema,
} from "drizzle-orm/effect-schema";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { Schema } from "effect";

export const postgresCartTableName = "cart" as const;
export const postgresCartLineItemTableName = "cart_line_item" as const;
export const postgresCartAdjustmentTableName = "cart_adjustment" as const;

export const postgresCart = pgTable(
  postgresCartTableName,
  {
    billingAddressJson: jsonb("billing_address_json").$type<
      typeof CartAddressSchema.Type | null
    >(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    currencyCode: text("currency_code").notNull(),
    customerId: text("customer_id"),
    email: text("email"),
    id: text("id").primaryKey(),
    metadataJson: jsonb("metadata_json")
      .$type<typeof CartMetadataSchema.Type>()
      .notNull(),
    paymentCollectionId: text("payment_collection_id"),
    regionId: text("region_id"),
    salesChannelId: text("sales_channel_id"),
    shippingAddressJson: jsonb("shipping_address_json").$type<
      typeof CartAddressSchema.Type | null
    >(),
    shippingOptionId: text("shipping_option_id"),
    status: text("status").notNull(),
    totalsJson: jsonb("totals_json")
      .$type<typeof CartTotalsSnapshotSchema.Type>()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("cart_created_at_idx").on(table.createdAt),
    index("cart_customer_idx").on(table.customerId),
    index("cart_status_idx").on(table.status),
  ]
);

export const postgresCartLineItem = pgTable(
  postgresCartLineItemTableName,
  {
    cartId: text("cart_id")
      .notNull()
      .references(() => postgresCart.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    id: text("id").primaryKey(),
    idempotencyKey: text("idempotency_key"),
    metadataJson: jsonb("metadata_json")
      .$type<typeof CartMetadataSchema.Type>()
      .notNull(),
    productId: text("product_id").notNull(),
    quantity: integer("quantity").notNull(),
    title: text("title").notNull(),
    unitPrice: integer("unit_price").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    variantId: text("variant_id").notNull(),
  },
  (table) => [
    index("cart_line_item_cart_idx").on(table.cartId),
    uniqueIndex("cart_line_item_idempotency_idx").on(table.idempotencyKey),
  ]
);

export const postgresCartAdjustment = pgTable(
  postgresCartAdjustmentTableName,
  {
    amount: integer("amount").notNull(),
    cartId: text("cart_id")
      .notNull()
      .references(() => postgresCart.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    id: text("id").primaryKey(),
    idempotencyKey: text("idempotency_key").notNull(),
    lineItemId: text("line_item_id").references(() => postgresCartLineItem.id, {
      onDelete: "set null",
    }),
    metadataJson: jsonb("metadata_json")
      .$type<typeof CartMetadataSchema.Type>()
      .notNull(),
    source: text("source").notNull(),
    type: text("type").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("cart_adjustment_cart_idx").on(table.cartId),
    uniqueIndex("cart_adjustment_idempotency_idx").on(table.idempotencyKey),
  ]
);

export const CartPostgresRowSchema = createSelectSchema(postgresCart, {
  billingAddressJson: () => Schema.NullOr(CartAddressSchema),
  currencyCode: () => CartApiRecordSchema.fields.currencyCode,
  id: () => CartSerializedIdSchema,
  metadataJson: () => CartMetadataSchema,
  status: () => CartStatusSchema,
  totalsJson: () => CartTotalsSnapshotSchema,
});
export const CartPostgresInsertSchema = createInsertSchema(postgresCart, {
  billingAddressJson: () => Schema.NullOr(CartAddressSchema),
  currencyCode: () => CartApiRecordSchema.fields.currencyCode,
  id: () => CartSerializedIdSchema,
  metadataJson: () => CartMetadataSchema,
  status: () => CartStatusSchema,
  totalsJson: () => CartTotalsSnapshotSchema,
});

export const CartLineItemPostgresRowSchema = createSelectSchema(
  postgresCartLineItem,
  {
    cartId: () => CartSerializedIdSchema,
    id: () => CartLineItemSerializedIdSchema,
    metadataJson: () => CartMetadataSchema,
    productId: () => CartTrimmedStringSchema,
    title: () => CartTrimmedStringSchema,
    variantId: () => CartTrimmedStringSchema,
  }
);
export const CartLineItemPostgresInsertSchema = createInsertSchema(
  postgresCartLineItem,
  {
    cartId: () => CartSerializedIdSchema,
    id: () => CartLineItemSerializedIdSchema,
    metadataJson: () => CartMetadataSchema,
    productId: () => CartTrimmedStringSchema,
    title: () => CartTrimmedStringSchema,
    variantId: () => CartTrimmedStringSchema,
  }
);

export const CartAdjustmentPostgresRowSchema = createSelectSchema(
  postgresCartAdjustment,
  {
    cartId: () => CartSerializedIdSchema,
    id: () => CartAdjustmentSerializedIdSchema,
    lineItemId: () => Schema.NullOr(CartLineItemSerializedIdSchema),
    metadataJson: () => CartMetadataSchema,
    source: () => CartTrimmedStringSchema,
    type: () => CartAdjustmentTypeSchema,
  }
);
export const CartAdjustmentPostgresInsertSchema = createInsertSchema(
  postgresCartAdjustment,
  {
    cartId: () => CartSerializedIdSchema,
    id: () => CartAdjustmentSerializedIdSchema,
    lineItemId: () => Schema.NullOr(CartLineItemSerializedIdSchema),
    metadataJson: () => CartMetadataSchema,
    source: () => CartTrimmedStringSchema,
    type: () => CartAdjustmentTypeSchema,
  }
);

export type CartPostgresRow = typeof postgresCart.$inferSelect;
export type CartPostgresInsert = typeof postgresCart.$inferInsert;
export type CartLineItemPostgresRow = typeof postgresCartLineItem.$inferSelect;
export type CartLineItemPostgresInsert =
  typeof postgresCartLineItem.$inferInsert;
export type CartAdjustmentPostgresRow =
  typeof postgresCartAdjustment.$inferSelect;
export type CartAdjustmentPostgresInsert =
  typeof postgresCartAdjustment.$inferInsert;
