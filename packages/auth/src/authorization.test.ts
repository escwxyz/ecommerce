import { describe, expect, it } from "bun:test";

import {
  createAuthorizationEvaluator,
  createCommerceAuthAccessControl,
  evaluatePermission,
  getSessionPermissionKeys,
  resolveAuthActor,
} from "./index";
import {
  createAnonymousAuthSession,
  createCustomerAuthSession,
  createStoreAdminAuthSession,
} from "./testing";

const productPermissionStatement = {
  product: ["read", "write"],
} as const;

const productAuthorizationEvaluator = createAuthorizationEvaluator({
  permissionStatement: productPermissionStatement,
});

describe("auth authorization evaluator", () => {
  it("classifies anonymous, customer, and store-admin actors", () => {
    expect(
      productAuthorizationEvaluator.resolveAuthActor(
        createAnonymousAuthSession()
      ).kind
    ).toBe("anonymous");
    expect(
      productAuthorizationEvaluator.resolveAuthActor(
        createCustomerAuthSession()
      ).kind
    ).toBe("customer");
    expect(
      productAuthorizationEvaluator.resolveAuthActor(
        createStoreAdminAuthSession()
      ).kind
    ).toBe("store-admin");
  });

  it("normalizes supported session permission keys", () => {
    expect(
      productAuthorizationEvaluator.getSessionPermissionKeys(
        createStoreAdminAuthSession({
          permissions: ["product:read", "product:write"],
        })
      )
    ).toEqual(["product:read", "product:write"]);
  });

  it("distinguishes missing auth from missing permissions", () => {
    expect(
      productAuthorizationEvaluator.evaluatePermission({
        permission: "product:read",
        session: createAnonymousAuthSession(),
      })
    ).toMatchObject({
      allowed: false,
      reason: "missing-authenticated-actor",
    });
    expect(
      productAuthorizationEvaluator.evaluatePermission({
        permission: "product:write",
        session: createCustomerAuthSession({ permissions: ["product:read"] }),
      })
    ).toMatchObject({
      allowed: false,
      reason: "missing-permission",
    });
  });

  it("allows actors with matching permissions", () => {
    expect(
      productAuthorizationEvaluator.evaluatePermission({
        permission: "product:write",
        session: createStoreAdminAuthSession(),
      })
    ).toMatchObject({
      allowed: true,
      permission: "product:write",
    });
  });

  it("preserves Better Auth default admin statements with commerce permissions", () => {
    const { commerceAccessControlStatement, storeAdminRole } =
      createCommerceAuthAccessControl(productPermissionStatement);

    expect(commerceAccessControlStatement.user).toContain("ban");
    expect(commerceAccessControlStatement.session).toContain("revoke");
    expect(commerceAccessControlStatement.product).toEqual(["read", "write"]);
    expect(storeAdminRole.statements.user).toContain("ban");
    expect(storeAdminRole.statements.session).toContain("revoke");
    expect(storeAdminRole.statements.product).toEqual(["read", "write"]);
  });

  it("does not grant default admin statements to customer users", () => {
    const { customerRole } = createCommerceAuthAccessControl(
      productPermissionStatement
    );

    expect(customerRole.statements).toEqual({});
  });

  it("keeps package-level defaults empty until a composed statement is provided", () => {
    expect(resolveAuthActor(createStoreAdminAuthSession()).kind).toBe(
      "store-admin"
    );
    expect(getSessionPermissionKeys(createStoreAdminAuthSession())).toEqual([]);
    expect(
      evaluatePermission({
        permission: "product:read",
        session: createStoreAdminAuthSession(),
      })
    ).toMatchObject({
      allowed: false,
      reason: "unsupported-permission",
    });
  });
});
