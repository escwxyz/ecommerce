import type { AuthPermissionKey } from "./permissions";
import type { AuthSession } from "./types";

const fixedDate = new Date("2026-01-01T00:00:00.000Z");

export const createAnonymousAuthSession = (): AuthSession => null;

export const createCustomerAuthSession = ({
  id = "user_customer",
  permissions = [],
}: {
  readonly id?: string;
  readonly permissions?: readonly AuthPermissionKey[];
} = {}): AuthSession =>
  ({
    session: {
      createdAt: fixedDate,
      expiresAt: new Date("2026-01-02T00:00:00.000Z"),
      id: "session_customer",
      token: "session-customer-token",
      updatedAt: fixedDate,
      userId: id,
    },
    user: {
      banned: false,
      createdAt: fixedDate,
      email: "customer@example.com",
      emailVerified: true,
      id,
      name: "Customer",
      permissions,
      role: "user",
      updatedAt: fixedDate,
    },
  }) as unknown as AuthSession;

export const createStoreAdminAuthSession = ({
  id = "user_admin",
  permissions = ["product:read", "product:write"],
}: {
  readonly id?: string;
  readonly permissions?: readonly AuthPermissionKey[];
} = {}): AuthSession =>
  ({
    session: {
      createdAt: fixedDate,
      expiresAt: new Date("2026-01-02T00:00:00.000Z"),
      id: "session_admin",
      token: "session-admin-token",
      updatedAt: fixedDate,
      userId: id,
    },
    user: {
      banned: false,
      createdAt: fixedDate,
      email: "admin@example.com",
      emailVerified: true,
      id,
      name: "Store Admin",
      permissions,
      role: "admin",
      updatedAt: fixedDate,
    },
  }) as unknown as AuthSession;
