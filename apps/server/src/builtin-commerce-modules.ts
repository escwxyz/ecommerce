import { cartModule } from "@ecommerce/cart/module";
import { checkoutModule } from "@ecommerce/checkout/module";
import { composeCommerceApplication } from "@ecommerce/core";
import type {
  CommerceApplicationComposition,
  CommerceModuleDefinition,
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

type BuiltinCommerceModuleDefinitions = readonly [
  typeof storeModule,
  typeof customerModule,
  typeof productModule,
  typeof regionSalesChannelModule,
  typeof pricingModule,
  typeof inventoryModule,
  typeof promotionModule,
  typeof taxModule,
  typeof fulfillmentModule,
  typeof paymentModule,
  typeof cartModule,
  typeof orderModule,
  typeof notificationEventModule,
  typeof checkoutModule,
];

type BuiltinCommerceModulesWithoutCheckout = readonly [
  typeof storeModule,
  typeof customerModule,
  typeof productModule,
  typeof regionSalesChannelModule,
  typeof pricingModule,
  typeof inventoryModule,
  typeof promotionModule,
  typeof taxModule,
  typeof fulfillmentModule,
  typeof paymentModule,
  typeof cartModule,
  typeof orderModule,
  typeof notificationEventModule,
];

/**
 * Server-owned built-in selection. Each module definition carries its own
 * HTTP groups and handler Layers, so selecting it is the only route catalog.
 */
const builtinCommerceModuleDefinitions: BuiltinCommerceModuleDefinitions = [
  storeModule,
  customerModule,
  productModule,
  regionSalesChannelModule,
  pricingModule,
  inventoryModule,
  promotionModule,
  taxModule,
  fulfillmentModule,
  paymentModule,
  cartModule,
  orderModule,
  notificationEventModule,
  checkoutModule,
] as const;

export const builtinCommerceModuleCatalog: readonly CommerceModuleDefinition[] =
  builtinCommerceModuleDefinitions;

export type BuiltinCommerceModuleKey =
  (typeof builtinCommerceModuleDefinitions)[number]["key"];

type BuiltinCommerceModuleDefinition =
  (typeof builtinCommerceModuleDefinitions)[number];

type BuiltinCommerceApplicationComposition = ReturnType<
  typeof composeCommerceApplication<typeof builtinCommerceModuleDefinitions>
>;

type BuiltinCommerceApplicationWithoutCheckoutComposition = ReturnType<
  typeof composeCommerceApplication<BuiltinCommerceModulesWithoutCheckout>
>;

export interface ComposeBuiltinCommerceApplicationOptions<
  DisabledModuleKeys extends readonly BuiltinCommerceModuleKey[] = readonly [],
> {
  readonly disabledModuleKeys?: DisabledModuleKeys;
}

/** Selects modules before validation so disablement removes all contributions. */
export function composeBuiltinCommerceApplication(): BuiltinCommerceApplicationComposition;
export function composeBuiltinCommerceApplication(options: {
  readonly disabledModuleKeys: readonly ["checkout"];
}): BuiltinCommerceApplicationWithoutCheckoutComposition;
export function composeBuiltinCommerceApplication<
  const DisabledModuleKeys extends readonly BuiltinCommerceModuleKey[] =
    readonly [],
>(
  options: ComposeBuiltinCommerceApplicationOptions<DisabledModuleKeys>
): CommerceApplicationComposition<readonly CommerceModuleDefinition[]>;
export function composeBuiltinCommerceApplication<
  const DisabledModuleKeys extends readonly BuiltinCommerceModuleKey[] =
    readonly [],
>(
  options: ComposeBuiltinCommerceApplicationOptions<DisabledModuleKeys> = {}
):
  | BuiltinCommerceApplicationComposition
  | BuiltinCommerceApplicationWithoutCheckoutComposition
  | CommerceApplicationComposition<readonly CommerceModuleDefinition[]> {
  if (!options.disabledModuleKeys?.length) {
    return composeCommerceApplication({
      modules: builtinCommerceModuleDefinitions,
    });
  }

  const disabledModuleKeys = new Set(options.disabledModuleKeys);
  const modules = builtinCommerceModuleDefinitions.filter(
    (
      module
    ): module is Exclude<
      BuiltinCommerceModuleDefinition,
      { readonly key: DisabledModuleKeys[number] }
    > => !disabledModuleKeys.has(module.key)
  );

  return composeCommerceApplication({ modules });
}
