import {
  OrderAddressSnapshotSchema,
  OrderFulfillmentReferenceSchema,
  OrderItemSnapshotSchema,
  OrderMetadataSchema,
  OrderPaymentReferenceSchema,
  OrderPostPurchaseOperationTypeSchema,
  OrderSerializedIdSchema,
  OrderStatusSchema,
  OrderTotalsSnapshotSchema,
  OrderTransactionSerializedIdSchema,
  OrderTransactionTypeSchema,
  OrderTrimmedStringSchema,
} from "@ecommerce/order";
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

export const postgresOrderTableName = "order_record" as const;
export const postgresOrderLineItemTableName = "order_line_item" as const;
export const postgresOrderTransactionTableName = "order_transaction" as const;
export const postgresOrderStateTransitionTableName =
  "order_state_transition" as const;
export const postgresOrderPostPurchaseOperationTableName =
  "order_post_purchase_operation" as const;

export const postgresOrder = pgTable(
  postgresOrderTableName,
  {
    billingAddressJson: jsonb("billing_address_json").$type<
      typeof OrderAddressSnapshotSchema.Type | null
    >(),
    cartId: text("cart_id").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    currencyCode: text("currency_code").notNull(),
    customerId: text("customer_id"),
    email: text("email"),
    fulfillmentReferencesJson: jsonb("fulfillment_references_json")
      .$type<readonly (typeof OrderFulfillmentReferenceSchema.Type)[]>()
      .notNull(),
    id: text("id").primaryKey(),
    idempotencyKey: text("idempotency_key").notNull(),
    metadataJson: jsonb("metadata_json")
      .$type<typeof OrderMetadataSchema.Type>()
      .notNull(),
    paymentReferencesJson: jsonb("payment_references_json")
      .$type<readonly (typeof OrderPaymentReferenceSchema.Type)[]>()
      .notNull(),
    shippingAddressJson: jsonb("shipping_address_json").$type<
      typeof OrderAddressSnapshotSchema.Type | null
    >(),
    status: text("status").notNull(),
    totalsJson: jsonb("totals_json")
      .$type<typeof OrderTotalsSnapshotSchema.Type>()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("order_cart_id_idx").on(table.cartId),
    index("order_customer_id_idx").on(table.customerId),
    uniqueIndex("order_idempotency_key_idx").on(table.idempotencyKey),
  ]
);

export const postgresOrderLineItem = pgTable(
  postgresOrderLineItemTableName,
  {
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    id: text("id").primaryKey(),
    itemSnapshotJson: jsonb("item_snapshot_json")
      .$type<typeof OrderItemSnapshotSchema.Type>()
      .notNull(),
    metadataJson: jsonb("metadata_json")
      .$type<typeof OrderMetadataSchema.Type>()
      .notNull(),
    orderId: text("order_id")
      .notNull()
      .references(() => postgresOrder.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    taxTotal: integer("tax_total").notNull(),
    title: text("title").notNull(),
    total: integer("total").notNull(),
    unitPrice: integer("unit_price").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("order_line_item_order_id_idx").on(table.orderId)]
);

export const postgresOrderTransaction = pgTable(
  postgresOrderTransactionTableName,
  {
    amount: integer("amount").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    currencyCode: text("currency_code").notNull(),
    id: text("id").primaryKey(),
    idempotencyKey: text("idempotency_key").notNull(),
    metadataJson: jsonb("metadata_json")
      .$type<typeof OrderMetadataSchema.Type>()
      .notNull(),
    orderId: text("order_id")
      .notNull()
      .references(() => postgresOrder.id, { onDelete: "cascade" }),
    referenceId: text("reference_id"),
    type: text("type").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("order_transaction_order_id_idx").on(table.orderId),
    uniqueIndex("order_transaction_idempotency_key_idx").on(
      table.idempotencyKey
    ),
  ]
);

export const postgresOrderStateTransition = pgTable(
  postgresOrderStateTransitionTableName,
  {
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull(),
    fromStatus: text("from_status"),
    idempotencyKey: text("idempotency_key").notNull(),
    metadataJson: jsonb("metadata_json")
      .$type<typeof OrderMetadataSchema.Type>()
      .notNull(),
    orderId: text("order_id")
      .notNull()
      .references(() => postgresOrder.id, { onDelete: "cascade" }),
    toStatus: text("to_status").notNull(),
  },
  (table) => [
    index("order_state_transition_order_id_idx").on(table.orderId),
    uniqueIndex("order_state_transition_idempotency_key_idx").on(
      table.idempotencyKey
    ),
  ]
);

export const postgresOrderPostPurchaseOperation = pgTable(
  postgresOrderPostPurchaseOperationTableName,
  {
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    id: text("id").primaryKey(),
    metadataJson: jsonb("metadata_json")
      .$type<typeof OrderMetadataSchema.Type>()
      .notNull(),
    orderId: text("order_id")
      .notNull()
      .references(() => postgresOrder.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    type: text("type").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("order_operation_order_id_idx").on(table.orderId)]
);

export const OrderPostgresRowSchema = createSelectSchema(postgresOrder, {
  billingAddressJson: () => Schema.NullOr(OrderAddressSnapshotSchema),
  currencyCode: () => OrderTotalsSnapshotSchema.fields.currencyCode,
  fulfillmentReferencesJson: () =>
    Schema.Array(OrderFulfillmentReferenceSchema),
  id: () => OrderSerializedIdSchema,
  metadataJson: () => OrderMetadataSchema,
  paymentReferencesJson: () => Schema.Array(OrderPaymentReferenceSchema),
  shippingAddressJson: () => Schema.NullOr(OrderAddressSnapshotSchema),
  status: () => OrderStatusSchema,
  totalsJson: () => OrderTotalsSnapshotSchema,
});
export const OrderPostgresInsertSchema = createInsertSchema(postgresOrder, {
  billingAddressJson: () => Schema.NullOr(OrderAddressSnapshotSchema),
  currencyCode: () => OrderTotalsSnapshotSchema.fields.currencyCode,
  fulfillmentReferencesJson: () =>
    Schema.Array(OrderFulfillmentReferenceSchema),
  id: () => OrderSerializedIdSchema,
  metadataJson: () => OrderMetadataSchema,
  paymentReferencesJson: () => Schema.Array(OrderPaymentReferenceSchema),
  shippingAddressJson: () => Schema.NullOr(OrderAddressSnapshotSchema),
  status: () => OrderStatusSchema,
  totalsJson: () => OrderTotalsSnapshotSchema,
});

export const OrderLineItemPostgresRowSchema = createSelectSchema(
  postgresOrderLineItem,
  {
    id: () => OrderTrimmedStringSchema,
    itemSnapshotJson: () => OrderItemSnapshotSchema,
    metadataJson: () => OrderMetadataSchema,
    orderId: () => OrderSerializedIdSchema,
    title: () => OrderTrimmedStringSchema,
  }
);
export const OrderLineItemPostgresInsertSchema = createInsertSchema(
  postgresOrderLineItem,
  {
    id: () => OrderTrimmedStringSchema,
    itemSnapshotJson: () => OrderItemSnapshotSchema,
    metadataJson: () => OrderMetadataSchema,
    orderId: () => OrderSerializedIdSchema,
    title: () => OrderTrimmedStringSchema,
  }
);

export const OrderTransactionPostgresRowSchema = createSelectSchema(
  postgresOrderTransaction,
  {
    currencyCode: () => OrderTotalsSnapshotSchema.fields.currencyCode,
    id: () => OrderTransactionSerializedIdSchema,
    metadataJson: () => OrderMetadataSchema,
    orderId: () => OrderSerializedIdSchema,
    referenceId: () => Schema.NullOr(OrderTrimmedStringSchema),
    type: () => OrderTransactionTypeSchema,
  }
);
export const OrderTransactionPostgresInsertSchema = createInsertSchema(
  postgresOrderTransaction,
  {
    currencyCode: () => OrderTotalsSnapshotSchema.fields.currencyCode,
    id: () => OrderTransactionSerializedIdSchema,
    metadataJson: () => OrderMetadataSchema,
    orderId: () => OrderSerializedIdSchema,
    referenceId: () => Schema.NullOr(OrderTrimmedStringSchema),
    type: () => OrderTransactionTypeSchema,
  }
);

export const OrderStateTransitionPostgresRowSchema = createSelectSchema(
  postgresOrderStateTransition,
  {
    fromStatus: () => Schema.NullOr(OrderStatusSchema),
    metadataJson: () => OrderMetadataSchema,
    orderId: () => OrderSerializedIdSchema,
    toStatus: () => OrderStatusSchema,
  }
);
export const OrderStateTransitionPostgresInsertSchema = createInsertSchema(
  postgresOrderStateTransition,
  {
    fromStatus: () => Schema.NullOr(OrderStatusSchema),
    metadataJson: () => OrderMetadataSchema,
    orderId: () => OrderSerializedIdSchema,
    toStatus: () => OrderStatusSchema,
  }
);

export const OrderPostPurchaseOperationPostgresRowSchema = createSelectSchema(
  postgresOrderPostPurchaseOperation,
  {
    id: () => OrderTrimmedStringSchema,
    metadataJson: () => OrderMetadataSchema,
    orderId: () => OrderSerializedIdSchema,
    status: () => OrderTrimmedStringSchema,
    type: () => OrderPostPurchaseOperationTypeSchema,
  }
);
export const OrderPostPurchaseOperationPostgresInsertSchema =
  createInsertSchema(postgresOrderPostPurchaseOperation, {
    id: () => OrderTrimmedStringSchema,
    metadataJson: () => OrderMetadataSchema,
    orderId: () => OrderSerializedIdSchema,
    status: () => OrderTrimmedStringSchema,
    type: () => OrderPostPurchaseOperationTypeSchema,
  });

export type OrderPostgresRow = typeof postgresOrder.$inferSelect;
export type OrderPostgresInsert = typeof postgresOrder.$inferInsert;
export type OrderLineItemPostgresRow =
  typeof postgresOrderLineItem.$inferSelect;
export type OrderLineItemPostgresInsert =
  typeof postgresOrderLineItem.$inferInsert;
export type OrderTransactionPostgresRow =
  typeof postgresOrderTransaction.$inferSelect;
export type OrderTransactionPostgresInsert =
  typeof postgresOrderTransaction.$inferInsert;
export type OrderStateTransitionPostgresRow =
  typeof postgresOrderStateTransition.$inferSelect;
export type OrderStateTransitionPostgresInsert =
  typeof postgresOrderStateTransition.$inferInsert;
export type OrderPostPurchaseOperationPostgresRow =
  typeof postgresOrderPostPurchaseOperation.$inferSelect;
export type OrderPostPurchaseOperationPostgresInsert =
  typeof postgresOrderPostPurchaseOperation.$inferInsert;
