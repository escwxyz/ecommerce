import { composeAdminMetadata } from "@ecommerce/core/admin";
import { customerAdminMetadata } from "@ecommerce/customer/admin";
import { fulfillmentAdminMetadata } from "@ecommerce/fulfillment/admin";
import { inventoryAdminMetadata } from "@ecommerce/inventory/admin";
import { paymentAdminMetadata } from "@ecommerce/payment/admin";
import { pricingAdminMetadata } from "@ecommerce/pricing/admin";
import { productAdminMetadata } from "@ecommerce/product/admin";
import { promotionAdminMetadata } from "@ecommerce/promotion/admin";
import { regionSalesChannelAdminMetadata } from "@ecommerce/region-sales-channel/admin";
import { storeAdminMetadata } from "@ecommerce/store/admin";
import { taxAdminMetadata } from "@ecommerce/tax/admin";

import type { Context } from "./context";
import { validateBuiltinCommercePermission } from "./permissions";

const getContextPermissionKeys = (context: Context): readonly string[] => {
  const user =
    typeof context.session?.user === "object" && context.session.user !== null
      ? (context.session.user as Record<string, unknown>)
      : null;
  const permissions = user?.permissions;

  return Array.isArray(permissions)
    ? permissions.filter(
        (permission): permission is string => typeof permission === "string"
      )
    : [];
};

export const createAdminMetadataModel = (context: Context) =>
  composeAdminMetadata({
    contributions: [
      storeAdminMetadata,
      customerAdminMetadata,
      productAdminMetadata,
      regionSalesChannelAdminMetadata,
      inventoryAdminMetadata,
      pricingAdminMetadata,
      promotionAdminMetadata,
      taxAdminMetadata,
      paymentAdminMetadata,
      fulfillmentAdminMetadata,
    ],
    permissionValidator: validateBuiltinCommercePermission,
    permissions: getContextPermissionKeys(context),
  });
