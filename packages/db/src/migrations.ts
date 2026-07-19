import type { Migration, MigrationProvider } from "kysely";

import { authMigration } from "./schema/auth";
import { cartMigration } from "./schema/cart";
import { customerMigration } from "./schema/customer";
import { fulfillmentMigration } from "./schema/fulfillment";
import { inventoryMigration } from "./schema/inventory";
import { notificationEventMigration } from "./schema/notification-event";
import { orderMigration } from "./schema/order";
import { paymentMigration } from "./schema/payment";
import { pricingMigration } from "./schema/pricing";
import { productMigration } from "./schema/product";
import { promotionMigration } from "./schema/promotion";
import { regionSalesChannelMigration } from "./schema/region-sales-channel";
import { taxMigration } from "./schema/tax";

export type CommerceMigration = Migration;
export type CommerceMigrationMap = Readonly<Record<string, CommerceMigration>>;

export class StaticCommerceMigrationProvider implements MigrationProvider {
  readonly #migrations: CommerceMigrationMap;

  constructor(migrations: CommerceMigrationMap) {
    this.#migrations = migrations;
  }

  getMigrations(): Promise<Record<string, Migration>> {
    return Promise.resolve({ ...this.#migrations });
  }
}

export const defineCommerceMigrations = <
  TMigrations extends CommerceMigrationMap,
>(
  migrations: TMigrations
): TMigrations => migrations;

export const commerceMigrations = defineCommerceMigrations({
  "000_auth": authMigration,
  "002_product": productMigration,
  "003_region_sales_channel": regionSalesChannelMigration,
  "004_pricing": pricingMigration,
  "005_promotion": promotionMigration,
  "006_customer": customerMigration,
  "007_inventory": inventoryMigration,
  "008_tax": taxMigration,
  "009_payment": paymentMigration,
  "010_fulfillment": fulfillmentMigration,
  "011_notification_event": notificationEventMigration,
  "012_cart": cartMigration,
  "013_order": orderMigration,
});
