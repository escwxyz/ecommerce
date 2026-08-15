import {
  ClockService,
  EventPublisherService,
  IdGeneratorService,
  defineCommerceModule,
  defineCommerceModuleProviderContribution,
  defineCommerceModuleServiceContribution,
} from "@ecommerce/core";
import { Effect, Layer } from "effect";

import { notificationEventAdminSurfaces } from "../admin";
import { NotificationEventRepositoryService } from "../domain";
import { notificationEventPermissionList } from "../permissions";
import {
  EVENT_OUTBOX_DEAD_LETTERED_EVENT,
  NOTIFICATION_DISPATCH_DELIVERED_EVENT,
  NOTIFICATION_DISPATCH_REQUESTED_EVENT,
  NotificationEventService,
  createNotificationEventService,
} from "../services";

const notificationEventServiceLayer = Layer.effect(
  NotificationEventService,
  Effect.gen(function* createModuleNotificationEventService() {
    return createNotificationEventService({
      clock: yield* ClockService,
      idGenerator: yield* IdGeneratorService,
      notificationProviders: [],
      repository: yield* NotificationEventRepositoryService,
    });
  })
);

const eventPublisherLayer = Layer.effect(
  EventPublisherService,
  NotificationEventService.use((service) =>
    Effect.succeed({
      publish: async (event) => {
        await Effect.runPromise(
          service.publishEvent({
            causationId: event.causationId,
            correlationId: event.correlationId,
            name: event.name,
            payload: event.payload,
            sourceModule: event.sourceModule ?? "notification-event",
            subject: event.subject,
            workflowRunId: event.workflowRunId,
          })
        );
      },
    })
  )
);

export const notificationEventExtensionPoints = {
  eventSubscribers: "notification-event.event-subscribers",
  notificationProviders: "notification-event.notification-providers",
  templates: "notification-event.templates",
} as const;

export const notificationEventModule = defineCommerceModule({
  contributions: {
    adminSurfaces: notificationEventAdminSurfaces,
    eventTypes: [
      NOTIFICATION_DISPATCH_REQUESTED_EVENT,
      NOTIFICATION_DISPATCH_DELIVERED_EVENT,
      EVENT_OUTBOX_DEAD_LETTERED_EVENT,
    ],
    permissions: notificationEventPermissionList,
    providers: [
      defineCommerceModuleProviderContribution({
        contractKey: "notification-event:event-publisher",
        key: "notification-event:event-publisher",
        kind: "event-publisher",
        layer: eventPublisherLayer,
        provider: EventPublisherService,
      }),
    ],
    services: [
      defineCommerceModuleServiceContribution({
        key: "notification-event:service",
        layer: notificationEventServiceLayer,
        service: NotificationEventService,
      }),
    ],
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
