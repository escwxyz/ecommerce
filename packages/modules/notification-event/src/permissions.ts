import type { CommercePermissionDescriptor } from "@ecommerce/core/permissions";
import { createCommercePermission } from "@ecommerce/core/permissions";

export const notificationEventPermissions = {
  eventRead: createCommercePermission({
    action: "read",
    description:
      "Read event outbox, retry, dead-letter, and observability records.",
    resource: "event",
  }),
  eventWrite: createCommercePermission({
    action: "write",
    description: "Publish event envelopes and update delivery retry state.",
    resource: "event",
  }),
  notificationRead: createCommercePermission({
    action: "read",
    description:
      "Read notification templates, providers, and dispatch records.",
    resource: "notification",
  }),
  notificationWrite: createCommercePermission({
    action: "write",
    description: "Manage notification templates and dispatch messages.",
    resource: "notification",
  }),
} as const satisfies Record<string, CommercePermissionDescriptor>;

export const notificationEventPermissionList = [
  notificationEventPermissions.eventRead,
  notificationEventPermissions.eventWrite,
  notificationEventPermissions.notificationRead,
  notificationEventPermissions.notificationWrite,
] as const;
