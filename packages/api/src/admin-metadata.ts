import { composeAdminMetadata } from "@ecommerce/core/admin";
import { pricingAdminMetadata } from "@ecommerce/pricing/admin";
import { productAdminMetadata } from "@ecommerce/product/admin";
import { promotionAdminMetadata } from "@ecommerce/promotion/admin";
import { regionSalesChannelAdminMetadata } from "@ecommerce/region-sales-channel/admin";
import { storeAdminMetadata } from "@ecommerce/store/admin";

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
      productAdminMetadata,
      regionSalesChannelAdminMetadata,
      pricingAdminMetadata,
      promotionAdminMetadata,
    ],
    permissionValidator: validateBuiltinCommercePermission,
    permissions: getContextPermissionKeys(context),
  });
