import {
  assertSupportedPermission,
  emptyPermissionStatement,
  normalizePermissionKey,
} from "./permissions";
import type {
  AuthPermission,
  AuthPermissionKey,
  AuthPermissionStatement,
} from "./permissions";
import type { AuthSession } from "./types";

export type AuthActorKind = "anonymous" | "customer" | "store-admin";

export interface AuthActor {
  readonly kind: AuthActorKind;
  readonly permissionKeys: readonly AuthPermissionKey[];
  readonly session: AuthSession;
  readonly userId?: string;
}

export type AuthorizationDenialReason =
  | "missing-authenticated-actor"
  | "missing-permission"
  | "unsupported-permission";

export type AuthorizationDecision =
  | {
      readonly actor: AuthActor;
      readonly allowed: true;
      readonly permission: AuthPermissionKey;
    }
  | {
      readonly actor: AuthActor;
      readonly allowed: false;
      readonly permission: AuthPermissionKey;
      readonly reason: AuthorizationDenialReason;
    };

export type AuthPermissionInput = AuthPermission | AuthPermissionKey;

export interface CreateAuthorizationEvaluatorOptions {
  readonly permissionStatement?: AuthPermissionStatement;
}

const getUserRecord = (
  session: AuthSession
): Record<string, unknown> | undefined => {
  const user = session?.user;

  return typeof user === "object" && user !== null
    ? (user as Record<string, unknown>)
    : undefined;
};

const normalizeRoleValues = (role: unknown): readonly string[] => {
  if (Array.isArray(role)) {
    return role.filter((value): value is string => typeof value === "string");
  }

  if (typeof role === "string") {
    return role
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }

  return [];
};

const createSessionPermissionKeyReader =
  (permissionStatement: AuthPermissionStatement) =>
  (session: AuthSession): readonly AuthPermissionKey[] => {
    const permissions = getUserRecord(session)?.permissions;

    if (!Array.isArray(permissions)) {
      return [];
    }

    const permissionKeys: AuthPermissionKey[] = [];

    for (const permission of permissions) {
      if (typeof permission !== "string") {
        continue;
      }

      try {
        permissionKeys.push(
          assertSupportedPermission(
            permission as AuthPermissionKey,
            permissionStatement
          )
        );
      } catch {
        continue;
      }
    }

    return permissionKeys;
  };

const createAuthActorResolver =
  (getPermissionKeys: (session: AuthSession) => readonly AuthPermissionKey[]) =>
  (session: AuthSession): AuthActor => {
    const user = getUserRecord(session);

    if (!session || !user) {
      return {
        kind: "anonymous",
        permissionKeys: [],
        session,
      };
    }

    const roles = normalizeRoleValues(user.role);
    const isStoreAdmin =
      roles.includes("admin") || roles.includes("store-admin");

    return {
      kind: isStoreAdmin ? "store-admin" : "customer",
      permissionKeys: getPermissionKeys(session),
      session,
      userId: typeof user.id === "string" ? user.id : undefined,
    };
  };

export const createAuthorizationEvaluator = ({
  permissionStatement = emptyPermissionStatement,
}: CreateAuthorizationEvaluatorOptions = {}) => {
  const getSessionPermissionKeys =
    createSessionPermissionKeyReader(permissionStatement);
  const resolveAuthActor = createAuthActorResolver(getSessionPermissionKeys);

  const evaluatePermission = ({
    permission,
    session,
  }: {
    readonly permission: AuthPermissionInput;
    readonly session: AuthSession;
  }): AuthorizationDecision => {
    const actor = resolveAuthActor(session);
    let permissionKey: AuthPermissionKey;

    try {
      permissionKey = assertSupportedPermission(
        permission,
        permissionStatement
      );
    } catch {
      return {
        actor,
        allowed: false,
        permission: normalizePermissionKey(permission),
        reason: "unsupported-permission",
      };
    }

    if (actor.kind === "anonymous") {
      return {
        actor,
        allowed: false,
        permission: permissionKey,
        reason: "missing-authenticated-actor",
      };
    }

    if (!actor.permissionKeys.includes(permissionKey)) {
      return {
        actor,
        allowed: false,
        permission: permissionKey,
        reason: "missing-permission",
      };
    }

    return {
      actor,
      allowed: true,
      permission: permissionKey,
    };
  };

  return {
    assertPermission: (
      session: AuthSession,
      permission: AuthPermissionInput
    ): AuthorizationDecision =>
      evaluatePermission({
        permission,
        session,
      }),
    evaluatePermission,
    getSessionPermissionKeys,
    hasPermission: (
      session: AuthSession,
      permission: AuthPermissionInput
    ): boolean =>
      evaluatePermission({
        permission,
        session,
      }).allowed,
    resolveAuthActor,
  };
};

const defaultAuthorizationEvaluator = createAuthorizationEvaluator();
export const {
  assertPermission,
  evaluatePermission,
  getSessionPermissionKeys,
  hasPermission,
  resolveAuthActor,
} = defaultAuthorizationEvaluator;
