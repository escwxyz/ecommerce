import { defineCommerceModule } from "@ecommerce/core";
import { Effect } from "effect";

import { notificationEventAdminSurfaces } from "../admin";
import { notificationEventPermissionList } from "../permissions";
import { notificationEventApiFragment } from "../router";
import {
  EVENT_OUTBOX_DEAD_LETTERED_EVENT,
  NOTIFICATION_DISPATCH_DELIVERED_EVENT,
  NOTIFICATION_DISPATCH_REQUESTED_EVENT,
  NotificationEventService,
} from "../services";

export const notificationEventExtensionPoints = {
  eventSubscribers: "notification-event.event-subscribers",
  notificationProviders: "notification-event.notification-providers",
  templates: "notification-event.templates",
} as const;

export const notificationEventModule = defineCommerceModule({
  contributions: {
    adminSurfaces: notificationEventAdminSurfaces,
    apiFragments: [notificationEventApiFragment],
    eventTypes: [
      NOTIFICATION_DISPATCH_REQUESTED_EVENT,
      NOTIFICATION_DISPATCH_DELIVERED_EVENT,
      EVENT_OUTBOX_DEAD_LETTERED_EVENT,
    ],
    permissions: notificationEventPermissionList,
    workflowSteps: [
      {
        name: "notification.dispatch",
        run: () =>
          Effect.succeed({
            output: {
              contract: "notification.dispatchNotification",
            },
          }),
      },
      {
        name: "event.publish",
        run: () =>
          Effect.succeed({
            output: {
              contract: "event.publishEvent",
            },
          }),
      },
    ],
  },
  dependencies: [],
  key: "notification-event",
  providedServices: [
    { key: "notification-event-service", service: NotificationEventService },
  ],
  schema: {
    tables: [
      "event_outbox",
      "event_dead_letter",
      "notification_template",
      "notification_dispatch",
      "notification_provider",
    ],
  },
});
