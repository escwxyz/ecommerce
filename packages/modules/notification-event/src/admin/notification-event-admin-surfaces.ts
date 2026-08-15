import type { AdminMetadataContribution } from "@ecommerce/core/admin";

import { notificationEventPermissions } from "../permissions";

export const notificationEventAdminMetadata = {
  source: {
    key: "notification-event",
    label: "Notification event module",
    type: "module",
  },
  surfaces: [
    {
      description:
        "Observe event outbox delivery, retries, and dead-letter records.",
      kind: "navigation",
      key: "notification-event:events",
      label: "Events",
      operations: {
        publish: {
          key: "eventPublish",
          permission: notificationEventPermissions.eventWrite,
        },
      },
      order: 120,
      path: "/dashboard",
      permission: notificationEventPermissions.eventRead,
      title: "Events",
    },
    {
      description:
        "Manage notification templates and provider-backed dispatch records.",
      kind: "resource",
      key: "notification-event:notifications",
      label: "Notifications",
      operations: {
        dispatch: {
          key: "notificationDispatch",
          permission: notificationEventPermissions.notificationWrite,
        },
        list: {
          key: "notificationDispatchList",
          permission: notificationEventPermissions.notificationRead,
        },
        upsertTemplate: {
          key: "notificationTemplateUpsert",
          permission: notificationEventPermissions.notificationWrite,
        },
      },
      order: 121,
      path: "/dashboard",
      permission: notificationEventPermissions.notificationRead,
      primitives: [
        {
          kind: "table",
          key: "notification-dispatch-table",
          operation: { key: "notificationDispatchList" },
        },
        {
          kind: "form",
          key: "notification-template-form",
          operation: { key: "notificationTemplateUpsert" },
        },
      ],
      title: "Notifications",
    },
  ],
} as const satisfies AdminMetadataContribution;

export const notificationEventAdminSurfaces =
  notificationEventAdminMetadata.surfaces;
