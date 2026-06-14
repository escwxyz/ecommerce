import { defineApiContractRoute } from "@ecommerce/module-contracts";
import { z } from "zod";

import {
  DispatchNotificationInputSchema,
  EventDeliveryFailureInputSchema,
  EventOutboxApiSchema,
  EventPublishInputSchema,
  EventPublishResultApiSchema,
  NotificationDispatchApiSchema,
  NotificationDispatchListApiSchema,
  UpsertNotificationTemplateInputSchema,
} from "../domain";

export const notificationEventContractRouter = {
  eventDeliveryFailureRecord: defineApiContractRoute({
    description:
      "Record event outbox delivery failure and transition exhausted events to dead letters.",
    method: "POST",
    operationId: "eventDeliveryFailureRecord",
    path: "/events/outbox/{outboxId}/failures",
    successDescription: "Event delivery failure recorded.",
    summary: "Record event delivery failure",
    tags: ["Events"],
  })
    .input(EventDeliveryFailureInputSchema)
    .output(EventOutboxApiSchema),
  eventPublish: defineApiContractRoute({
    description:
      "Publish a commerce event envelope into the module-owned event outbox.",
    method: "POST",
    operationId: "eventPublish",
    path: "/events",
    successDescription: "Event envelope published.",
    summary: "Publish event",
    tags: ["Events"],
  })
    .input(EventPublishInputSchema)
    .output(EventPublishResultApiSchema),
  notificationDispatch: defineApiContractRoute({
    description:
      "Dispatch a notification through the configured notification provider contract.",
    method: "POST",
    operationId: "notificationDispatch",
    path: "/notifications/dispatches",
    successDescription: "Notification dispatch recorded.",
    summary: "Dispatch notification",
    tags: ["Notifications"],
  })
    .input(DispatchNotificationInputSchema)
    .output(NotificationDispatchApiSchema),
  notificationDispatchList: defineApiContractRoute({
    description: "List notification dispatch records for observability.",
    method: "GET",
    operationId: "notificationDispatchList",
    path: "/notifications/dispatches",
    successDescription: "Notification dispatch records returned.",
    summary: "List notification dispatches",
    tags: ["Notifications"],
  })
    .input(z.unknown())
    .output(NotificationDispatchListApiSchema),
  notificationTemplateUpsert: defineApiContractRoute({
    description:
      "Create or replace a notification template and bind it to a provider key.",
    method: "PUT",
    operationId: "notificationTemplateUpsert",
    path: "/notifications/templates/{templateKey}",
    successDescription: "Notification template saved.",
    summary: "Save notification template",
    tags: ["Notifications"],
  })
    .input(UpsertNotificationTemplateInputSchema)
    .output(UpsertNotificationTemplateInputSchema),
} as const;
