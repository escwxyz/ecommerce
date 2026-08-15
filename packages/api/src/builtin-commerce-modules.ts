import { cartModule } from "@ecommerce/cart/module";
import { checkoutModule } from "@ecommerce/checkout/module";
import type {
  CommerceModuleApiGroupContribution,
  CommerceModuleDefinition,
} from "@ecommerce/core";
import {
  composeCommerceApplication,
  defineCommerceModuleApiGroupContribution,
} from "@ecommerce/core";
import { customerModule } from "@ecommerce/customer/module";
import { fulfillmentModule } from "@ecommerce/fulfillment/module";
import { inventoryModule } from "@ecommerce/inventory/module";
import { notificationEventModule } from "@ecommerce/notification-event/module";
import { orderModule } from "@ecommerce/order/module";
import { paymentModule } from "@ecommerce/payment/module";
import { pricingModule } from "@ecommerce/pricing/module";
import { productModule } from "@ecommerce/product/module";
import { promotionModule } from "@ecommerce/promotion/module";
import { regionSalesChannelModule } from "@ecommerce/region-sales-channel/module";
import { storeModule } from "@ecommerce/store/module";
import { taxModule } from "@ecommerce/tax/module";

import { cartEffectHttpApiContribution } from "./cart-effect-http-api";
import { checkoutEffectHttpApiContribution } from "./checkout-effect-http-api";
import { customerEffectHttpApiContribution } from "./customer-effect-http-api";
import type { EffectHttpApiGroupContribution } from "./effect-http-api";
import { fulfillmentEffectHttpApiContribution } from "./fulfillment-effect-http-api";
import { inventoryEffectHttpApiContribution } from "./inventory-effect-http-api";
import { notificationEventEffectHttpApiContribution } from "./notification-event-effect-http-api";
import { orderEffectHttpApiContribution } from "./order-effect-http-api";
import { paymentEffectHttpApiContribution } from "./payment-effect-http-api";
import { pricingEffectHttpApiContribution } from "./pricing-effect-http-api";
import { productEffectHttpApiContribution } from "./product-effect-http-api";
import { promotionEffectHttpApiContribution } from "./promotion-effect-http-api";
import { regionSalesChannelEffectHttpApiContribution } from "./region-sales-channel-effect-http-api";
import { storeEffectHttpApiContribution } from "./store-effect-http-api";
import { taxEffectHttpApiContribution } from "./tax-effect-http-api";

const attachHttpGroups = <
  const Definition extends CommerceModuleDefinition,
  const Groups extends readonly EffectHttpApiGroupContribution[],
>(
  definition: Definition,
  groups: Groups
): Definition & {
  readonly contributions: Definition["contributions"] & {
    readonly apiGroups: readonly CommerceModuleApiGroupContribution[];
  };
} => {
  const apiGroups = groups.map(({ group, handlers, key, surface }) =>
    defineCommerceModuleApiGroupContribution({
      group,
      handlers,
      key,
      surface,
    })
  );

  return {
    ...definition,
    contributions: {
      ...definition.contributions,
      apiGroups,
    },
  };
};

/**
 * The explicit built-in registration catalog. Each module occurs once and all
 * metadata, service Layers, and HTTP behavior travel with that selected value.
 */
export const builtinCommerceModuleCatalog = [
  attachHttpGroups(storeModule, storeEffectHttpApiContribution.groups),
  attachHttpGroups(customerModule, customerEffectHttpApiContribution.groups),
  attachHttpGroups(productModule, productEffectHttpApiContribution.groups),
  attachHttpGroups(
    regionSalesChannelModule,
    regionSalesChannelEffectHttpApiContribution.groups
  ),
  attachHttpGroups(pricingModule, pricingEffectHttpApiContribution.groups),
  attachHttpGroups(inventoryModule, inventoryEffectHttpApiContribution.groups),
  attachHttpGroups(promotionModule, promotionEffectHttpApiContribution.groups),
  attachHttpGroups(taxModule, taxEffectHttpApiContribution.groups),
  attachHttpGroups(
    fulfillmentModule,
    fulfillmentEffectHttpApiContribution.groups
  ),
  attachHttpGroups(paymentModule, paymentEffectHttpApiContribution.groups),
  attachHttpGroups(cartModule, cartEffectHttpApiContribution.groups),
  attachHttpGroups(orderModule, orderEffectHttpApiContribution.groups),
  attachHttpGroups(
    notificationEventModule,
    notificationEventEffectHttpApiContribution.groups
  ),
  attachHttpGroups(checkoutModule, checkoutEffectHttpApiContribution.groups),
] as const;

export type BuiltinCommerceModuleKey =
  (typeof builtinCommerceModuleCatalog)[number]["key"];

export interface ComposeBuiltinCommerceApplicationOptions {
  readonly disabledModuleKeys?: readonly BuiltinCommerceModuleKey[];
}

/** Selects modules before validation so disablement removes all contributions. */
export const composeBuiltinCommerceApplication = (
  options: ComposeBuiltinCommerceApplicationOptions = {}
) => {
  const disabledModuleKeys = new Set(options.disabledModuleKeys);
  const modules = builtinCommerceModuleCatalog.filter(
    (module) => !disabledModuleKeys.has(module.key)
  );

  return composeCommerceApplication({ modules });
};
