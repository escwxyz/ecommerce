import type { AuthPermissionInput, AuthSession } from "@ecommerce/auth";
import { createAuthorizationEvaluator } from "@ecommerce/auth";
import {
  composeCommerceModulePermissions,
  createCommercePermissionValidator,
} from "@ecommerce/core";
import type { CommercePermissionInput } from "@ecommerce/core/permissions";

import { builtinCommerceModuleCatalog } from "./builtin-commerce-modules";

export const builtinPermissionModules = builtinCommerceModuleCatalog;

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
