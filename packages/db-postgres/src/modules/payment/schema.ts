import {
  PaymentAccountHolderSerializedIdSchema,
  PaymentCaptureSerializedIdSchema,
  PaymentCaptureStatusSchema,
  PaymentCollectionSerializedIdSchema,
  PaymentCollectionStatusSchema,
  PaymentMetadataSchema,
  PaymentMethodSerializedIdSchema,
  PaymentProviderRecordSerializedIdSchema,
  PaymentRefundSerializedIdSchema,
  PaymentRefundStatusSchema,
  PaymentSerializedIdSchema,
  PaymentSessionSerializedIdSchema,
  PaymentSessionStatusSchema,
  PaymentStatusSchema,
  PaymentTrimmedStringSchema,
} from "@ecommerce/payment";
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
} from "drizzle-orm/pg-core";
import { Schema } from "effect";

export const postgresPaymentProviderTableName = "payment_provider" as const;
export const postgresPaymentAccountHolderTableName =
  "payment_account_holder" as const;
export const postgresPaymentMethodTableName = "payment_method" as const;
export const postgresPaymentCollectionTableName = "payment_collection" as const;
export const postgresPaymentSessionTableName = "payment_session" as const;
export const postgresPaymentTableName = "payment" as const;
export const postgresPaymentCaptureTableName = "payment_capture" as const;
export const postgresPaymentRefundTableName = "payment_refund" as const;

export const postgresPaymentProvider = pgTable(
  postgresPaymentProviderTableName,
  {
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    id: text("id").primaryKey(),
    isEnabled: text("is_enabled").notNull(),
    providerKey: text("provider_key").notNull(),
    providerRecordId: text("provider_record_id").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("payment_provider_key_idx").on(table.providerKey)]
);

export const postgresPaymentAccountHolder = pgTable(
  postgresPaymentAccountHolderTableName,
  {
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    customerId: text("customer_id").notNull(),
    email: text("email"),
    id: text("id").primaryKey(),
    metadataJson: jsonb("metadata_json")
      .$type<typeof PaymentMetadataSchema.Type>()
      .notNull(),
    providerAccountHolderId: text("provider_account_holder_id").notNull(),
    providerKey: text("provider_key").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("payment_account_holder_provider_idx").on(
      table.providerKey,
      table.providerAccountHolderId
    ),
  ]
);

export const postgresPaymentMethod = pgTable(
  postgresPaymentMethodTableName,
  {
    accountHolderId: text("account_holder_id").references(
      () => postgresPaymentAccountHolder.id,
      { onDelete: "set null" }
    ),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    displayName: text("display_name"),
    id: text("id").primaryKey(),
    metadataJson: jsonb("metadata_json")
      .$type<typeof PaymentMetadataSchema.Type>()
      .notNull(),
    providerKey: text("provider_key").notNull(),
    providerPaymentMethodId: text("provider_payment_method_id").notNull(),
    reusable: text("reusable").notNull(),
    type: text("type").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("payment_method_account_holder_idx").on(table.accountHolderId),
  ]
);

export const postgresPaymentCollection = pgTable(
  postgresPaymentCollectionTableName,
  {
    amount: integer("amount").notNull(),
    cartId: text("cart_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    currencyCode: text("currency_code").notNull(),
    id: text("id").primaryKey(),
    metadataJson: jsonb("metadata_json")
      .$type<typeof PaymentMetadataSchema.Type>()
      .notNull(),
    status: text("status").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("payment_collection_status_idx").on(table.status)]
);

export const postgresPaymentSession = pgTable(
  postgresPaymentSessionTableName,
  {
    amount: integer("amount").notNull(),
    collectionId: text("collection_id")
      .notNull()
      .references(() => postgresPaymentCollection.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    currencyCode: text("currency_code").notNull(),
    id: text("id").primaryKey(),
    metadataJson: jsonb("metadata_json")
      .$type<typeof PaymentMetadataSchema.Type>()
      .notNull(),
    providerCheckoutSessionId: text("provider_checkout_session_id"),
    providerKey: text("provider_key").notNull(),
    providerPaymentIntentId: text("provider_payment_intent_id"),
    status: text("status").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("payment_session_collection_idx").on(table.collectionId),
    index("payment_provider_intent_session_idx").on(
      table.providerKey,
      table.providerPaymentIntentId
    ),
  ]
);

export const postgresPayment = pgTable(
  postgresPaymentTableName,
  {
    amount: integer("amount").notNull(),
    collectionId: text("collection_id")
      .notNull()
      .references(() => postgresPaymentCollection.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    currencyCode: text("currency_code").notNull(),
    id: text("id").primaryKey(),
    metadataJson: jsonb("metadata_json")
      .$type<typeof PaymentMetadataSchema.Type>()
      .notNull(),
    providerKey: text("provider_key").notNull(),
    providerPaymentIntentId: text("provider_payment_intent_id").notNull(),
    sessionId: text("session_id")
      .notNull()
      .references(() => postgresPaymentSession.id, { onDelete: "restrict" }),
    status: text("status").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("payment_provider_intent_idx").on(
      table.providerKey,
      table.providerPaymentIntentId
    ),
  ]
);

export const postgresPaymentCapture = pgTable(
  postgresPaymentCaptureTableName,
  {
    amount: integer("amount").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    currencyCode: text("currency_code").notNull(),
    id: text("id").primaryKey(),
    idempotencyKey: text("idempotency_key").notNull(),
    paymentId: text("payment_id")
      .notNull()
      .references(() => postgresPayment.id, { onDelete: "cascade" }),
    providerCaptureId: text("provider_capture_id"),
    status: text("status").notNull(),
  },
  (table) => [index("payment_capture_idempotency_idx").on(table.idempotencyKey)]
);

export const postgresPaymentRefund = pgTable(
  postgresPaymentRefundTableName,
  {
    amount: integer("amount").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    currencyCode: text("currency_code").notNull(),
    id: text("id").primaryKey(),
    idempotencyKey: text("idempotency_key").notNull(),
    paymentId: text("payment_id")
      .notNull()
      .references(() => postgresPayment.id, { onDelete: "cascade" }),
    providerRefundId: text("provider_refund_id").notNull(),
    reason: text("reason"),
    status: text("status").notNull(),
  },
  (table) => [index("payment_refund_idempotency_idx").on(table.idempotencyKey)]
);

export const PaymentProviderPostgresRowSchema = createSelectSchema(
  postgresPaymentProvider,
  {
    id: () => PaymentProviderRecordSerializedIdSchema,
    isEnabled: () => Schema.Literals(["true", "false"]),
    providerKey: () => PaymentTrimmedStringSchema,
    providerRecordId: () => PaymentTrimmedStringSchema,
  }
);
export const PaymentProviderPostgresInsertSchema = createInsertSchema(
  postgresPaymentProvider,
  {
    id: () => PaymentProviderRecordSerializedIdSchema,
    isEnabled: () => Schema.Literals(["true", "false"]),
    providerKey: () => PaymentTrimmedStringSchema,
    providerRecordId: () => PaymentTrimmedStringSchema,
  }
);

export const PaymentAccountHolderPostgresRowSchema = createSelectSchema(
  postgresPaymentAccountHolder,
  {
    id: () => PaymentAccountHolderSerializedIdSchema,
    metadataJson: () => PaymentMetadataSchema,
    providerAccountHolderId: () => PaymentTrimmedStringSchema,
    providerKey: () => PaymentTrimmedStringSchema,
  }
);
export const PaymentMethodPostgresRowSchema = createSelectSchema(
  postgresPaymentMethod,
  {
    accountHolderId: () =>
      Schema.NullOr(PaymentAccountHolderSerializedIdSchema),
    id: () => PaymentMethodSerializedIdSchema,
    metadataJson: () => PaymentMetadataSchema,
    reusable: () => Schema.Literals(["true", "false"]),
  }
);
export const PaymentCollectionPostgresRowSchema = createSelectSchema(
  postgresPaymentCollection,
  {
    id: () => PaymentCollectionSerializedIdSchema,
    metadataJson: () => PaymentMetadataSchema,
    status: () => PaymentCollectionStatusSchema,
  }
);
export const PaymentSessionPostgresRowSchema = createSelectSchema(
  postgresPaymentSession,
  {
    collectionId: () => PaymentCollectionSerializedIdSchema,
    id: () => PaymentSessionSerializedIdSchema,
    metadataJson: () => PaymentMetadataSchema,
    status: () => PaymentSessionStatusSchema,
  }
);
export const PaymentPostgresRowSchema = createSelectSchema(postgresPayment, {
  collectionId: () => PaymentCollectionSerializedIdSchema,
  id: () => PaymentSerializedIdSchema,
  metadataJson: () => PaymentMetadataSchema,
  sessionId: () => PaymentSessionSerializedIdSchema,
  status: () => PaymentStatusSchema,
});
export const PaymentCapturePostgresRowSchema = createSelectSchema(
  postgresPaymentCapture,
  {
    id: () => PaymentCaptureSerializedIdSchema,
    paymentId: () => PaymentSerializedIdSchema,
    status: () => PaymentCaptureStatusSchema,
  }
);
export const PaymentRefundPostgresRowSchema = createSelectSchema(
  postgresPaymentRefund,
  {
    id: () => PaymentRefundSerializedIdSchema,
    paymentId: () => PaymentSerializedIdSchema,
    status: () => PaymentRefundStatusSchema,
  }
);

export type PaymentProviderPostgresRow =
  typeof postgresPaymentProvider.$inferSelect;
export type PaymentAccountHolderPostgresRow =
  typeof postgresPaymentAccountHolder.$inferSelect;
export type PaymentMethodPostgresRow =
  typeof postgresPaymentMethod.$inferSelect;
export type PaymentCollectionPostgresRow =
  typeof postgresPaymentCollection.$inferSelect;
export type PaymentSessionPostgresRow =
  typeof postgresPaymentSession.$inferSelect;
export type PaymentPostgresRow = typeof postgresPayment.$inferSelect;
export type PaymentCapturePostgresRow =
  typeof postgresPaymentCapture.$inferSelect;
export type PaymentRefundPostgresRow =
  typeof postgresPaymentRefund.$inferSelect;
