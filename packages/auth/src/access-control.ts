import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

import type { AuthPermissionStatement } from "./permissions";
import { emptyPermissionStatement } from "./permissions";

export interface CommerceAuthAccessControlConfig {
  readonly commerceAccessControl: ReturnType<typeof createAccessControl>;
  readonly commerceAccessControlStatement: AuthPermissionStatement;
  readonly commerceAuthRoles: {
    readonly admin: ReturnType<
      ReturnType<typeof createAccessControl>["newRole"]
    >;
    readonly user: ReturnType<
      ReturnType<typeof createAccessControl>["newRole"]
    >;
  };
  readonly customerRole: ReturnType<
    ReturnType<typeof createAccessControl>["newRole"]
  >;
  readonly storeAdminRole: ReturnType<
    ReturnType<typeof createAccessControl>["newRole"]
  >;
}

const toRoleStatements = (statement: AuthPermissionStatement) =>
  Object.fromEntries(
    Object.entries(statement).map(([resource, actions]) => [
      resource,
      [...actions],
    ])
  );

export const createCommerceAuthAccessControl = (
  commercePermissionStatement: AuthPermissionStatement = emptyPermissionStatement
): CommerceAuthAccessControlConfig => {
  const commerceAccessControlStatement = {
    ...defaultStatements,
    ...commercePermissionStatement,
  } as const;
  const commerceAccessControl = createAccessControl(
    commerceAccessControlStatement
  );
  const customerRole = commerceAccessControl.newRole({});
  const storeAdminRole = commerceAccessControl.newRole({
    ...adminAc.statements,
    ...toRoleStatements(commercePermissionStatement),
  });

  return {
    commerceAccessControl,
    commerceAccessControlStatement,
    commerceAuthRoles: {
      admin: storeAdminRole,
      user: customerRole,
    },
    customerRole,
    storeAdminRole,
  };
};

const defaultCommerceAuthAccessControl = createCommerceAuthAccessControl();
export const {
  commerceAccessControl,
  commerceAccessControlStatement,
  commerceAuthRoles,
  customerRole,
  storeAdminRole,
} = defaultCommerceAuthAccessControl;
