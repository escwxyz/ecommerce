import type { AuthDatabase } from "./schema/auth";
import type { NotificationEventDatabase } from "./schema/notification-event";
import type { OrderDatabase } from "./schema/order";

// oxlint-disable-next-line oxc/no-barrel-file
export * as authSchema from "./schema/auth";
// oxlint-disable-next-line oxc/no-barrel-file
export * as notificationEventSchema from "./schema/notification-event";
// oxlint-disable-next-line oxc/no-barrel-file
export * as orderSchema from "./schema/order";

/**
 * Shared commerce schema assembly for primary relational data.
 * Runtime-neutral packages consume this shape without inheriting any concrete
 * query-builder runtime types from the package root.
 */
// oxlint-disable-next-line typescript/no-empty-interface typescript/no-empty-object-type
export interface CommerceDatabase
  extends AuthDatabase, NotificationEventDatabase, OrderDatabase {}

export type CommerceDatabaseSchema = CommerceDatabase;
export type CommerceDatabaseSchemaKey = keyof CommerceDatabaseSchema;
