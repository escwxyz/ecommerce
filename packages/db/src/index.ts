import type { AuthDatabase } from "./schema/auth";
import type { FulfillmentDatabase } from "./schema/fulfillment";
import type { NotificationEventDatabase } from "./schema/notification-event";
import type { OrderDatabase } from "./schema/order";
import type { PaymentDatabase } from "./schema/payment";

// oxlint-disable-next-line oxc/no-barrel-file
export * as authSchema from "./schema/auth";
// oxlint-disable-next-line oxc/no-barrel-file
export * as fulfillmentSchema from "./schema/fulfillment";
// oxlint-disable-next-line oxc/no-barrel-file
export * as notificationEventSchema from "./schema/notification-event";
// oxlint-disable-next-line oxc/no-barrel-file
export * as orderSchema from "./schema/order";
// oxlint-disable-next-line oxc/no-barrel-file
export * as paymentSchema from "./schema/payment";

/**
 * Shared commerce schema assembly for primary relational data.
 * Runtime-neutral packages consume this shape without inheriting any concrete
 * query-builder runtime types from the package root.
 */
// oxlint-disable-next-line typescript/no-empty-interface typescript/no-empty-object-type
export interface CommerceDatabase
  extends
    AuthDatabase,
    FulfillmentDatabase,
    NotificationEventDatabase,
    OrderDatabase,
    PaymentDatabase {}

export type CommerceDatabaseSchema = CommerceDatabase;
export type CommerceDatabaseSchemaKey = keyof CommerceDatabaseSchema;
