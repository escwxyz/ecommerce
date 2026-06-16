import type { AuthPermissionInput, AuthSession } from "@ecommerce/auth";
import { createAuthorizationEvaluator } from "@ecommerce/auth";
import { cartModule } from "@ecommerce/cart/module";
import {
  composeCommerceModulePermissions,
  createCommercePermissionValidator,
} from "@ecommerce/core";
import type { CommercePermissionInput } from "@ecommerce/core/permissions";
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

export const builtinPermissionModules = [
  storeModule,
  customerModule,
  productModule,
  regionSalesChannelModule,
  inventoryModule,
  notificationEventModule,
  pricingModule,
  promotionModule,
  taxModule,
  paymentModule,
  fulfillmentModule,
  cartModule,
  orderModule,
] as const;

export const builtinPermissionComposition = composeCommerceModulePermissions(
  builtinPermissionModules
);

export const builtinPermissionStatement =
  builtinPermissionComposition.statement;

export const validateBuiltinCommercePermission =
  createCommercePermissionValidator(builtinPermissionComposition);

export const authPermissionEvaluator = createAuthorizationEvaluator({
  permissionStatement: builtinPermissionStatement,
});

export const authorizationEvaluator = {
  evaluatePermission: ({
    permission,
    session,
  }: {
    readonly permission: AuthPermissionInput | CommercePermissionInput;
    readonly session: unknown;
  }) =>
    authPermissionEvaluator.evaluatePermission({
      permission: permission as AuthPermissionInput,
      session: session as AuthSession,
    }),
};
