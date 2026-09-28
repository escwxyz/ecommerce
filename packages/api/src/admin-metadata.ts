import type {
  AdminMetadataContribution,
  ComposeAdminMetadataOptions,
} from "@ecommerce/core/admin";
import { composeAdminMetadata } from "@ecommerce/core/admin";

export interface AdminMetadataContext {
  readonly auth?: unknown;
  readonly authorization?: unknown;
  readonly session: {
    readonly user?: unknown | null;
  } | null;
}

const getContextPermissionKeys = (
  context: AdminMetadataContext
): readonly string[] => {
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

/** Builds admin metadata from the selected registration's surfaces and policy. */
export const createAdminMetadataModel = (
  context: AdminMetadataContext,
  options: {
    readonly contributions: readonly AdminMetadataContribution[];
    readonly permissionValidator?: ComposeAdminMetadataOptions["permissionValidator"];
  }
) =>
  composeAdminMetadata({
    ...options,
    permissions: getContextPermissionKeys(context),
  });
