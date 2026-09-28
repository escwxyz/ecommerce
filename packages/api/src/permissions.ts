import type { AuthPermissionInput, AuthSession } from "@ecommerce/auth";
import { createAuthorizationEvaluator } from "@ecommerce/auth";
import type { CommerceModuleDefinition } from "@ecommerce/core";
import {
  composeCommerceModulePermissions,
  createCommercePermissionValidator,
} from "@ecommerce/core";
import type { CommercePermissionInput } from "@ecommerce/core/permissions";

/** Derives authorization from the selected modules, not a second built-in catalog. */
export const createCommerceApiPermissions = (
  modules: readonly CommerceModuleDefinition[]
) => {
  const composition = composeCommerceModulePermissions(modules);
  const evaluate = createAuthorizationEvaluator({
    permissionStatement: composition.statement,
  });

  return {
    composition,
    permissionStatement: composition.statement,
    validatePermission: createCommercePermissionValidator(composition),
    authorizationEvaluator: {
      evaluatePermission: ({
        permission,
        session,
      }: {
        readonly permission: AuthPermissionInput | CommercePermissionInput;
        readonly session: unknown;
      }) =>
        evaluate.evaluatePermission({
          permission: permission as AuthPermissionInput,
          session: session as AuthSession,
        }),
    },
  };
};
