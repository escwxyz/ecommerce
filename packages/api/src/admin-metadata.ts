import { composeAdminMetadata } from "@ecommerce/core/admin";
import { productAdminMetadata } from "@ecommerce/product/admin";

import type { Context } from "./context";
import {
  authPermissionEvaluator,
  validateBuiltinCommercePermission,
} from "./permissions";

export const createAdminMetadataModel = (context: Context) =>
  composeAdminMetadata({
    contributions: [productAdminMetadata],
    permissionValidator: validateBuiltinCommercePermission,
    permissions: authPermissionEvaluator.getSessionPermissionKeys(
      context.session
    ),
  });
