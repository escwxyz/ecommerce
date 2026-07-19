import type { AuthDatabase } from "./schema/auth";
import type { CartDatabase } from "./schema/cart";
import type { FulfillmentDatabase } from "./schema/fulfillment";
import type { InventoryDatabase } from "./schema/inventory";
import type { NotificationEventDatabase } from "./schema/notification-event";
import type { OrderDatabase } from "./schema/order";
import type { PaymentDatabase } from "./schema/payment";
import type { PricingDatabase } from "./schema/pricing";
import type { PromotionDatabase } from "./schema/promotion";
import type { TaxDatabase } from "./schema/tax";

// oxlint-disable-next-line oxc/no-barrel-file
export * as authSchema from "./schema/auth";
// oxlint-disable-next-line oxc/no-barrel-file
export * as cartSchema from "./schema/cart";
// oxlint-disable-next-line oxc/no-barrel-file
export * as fulfillmentSchema from "./schema/fulfillment";
// oxlint-disable-next-line oxc/no-barrel-file
export * as inventorySchema from "./schema/inventory";
// oxlint-disable-next-line oxc/no-barrel-file
export * as notificationEventSchema from "./schema/notification-event";
// oxlint-disable-next-line oxc/no-barrel-file
export * as orderSchema from "./schema/order";
// oxlint-disable-next-line oxc/no-barrel-file
export * as paymentSchema from "./schema/payment";
export * as pricingSchema from "./schema/pricing";
// oxlint-disable-next-line oxc/no-barrel-file
export * as promotionSchema from "./schema/promotion";
// oxlint-disable-next-line oxc/no-barrel-file
export * as taxSchema from "./schema/tax";

/**
 * Shared commerce schema assembly for primary relational data.
 * Runtime-neutral packages consume this shape without inheriting any concrete
 * query-builder runtime types from the package root.
 */
// oxlint-disable-next-line typescript/no-empty-interface typescript/no-empty-object-type
export interface CommerceDatabase
  extends
    AuthDatabase,
    CartDatabase,
    FulfillmentDatabase,
    InventoryDatabase,
    NotificationEventDatabase,
    OrderDatabase,
    PaymentDatabase,
    PricingDatabase,
    PromotionDatabase,
    TaxDatabase {}

export type CommerceDatabaseSchema = CommerceDatabase;
export type CommerceDatabaseSchemaKey = keyof CommerceDatabaseSchema;
