import { defineEffectHttpApiModuleContribution } from "@ecommerce/api/effect-http-api";
import {
  CurrentEffectHttpRequestContext,
  withEffectHttpPermission,
} from "@ecommerce/api/effect-http-middleware";
import type { EffectHttpRequestIdentity } from "@ecommerce/api/effect-http-middleware";
import { defineCommerceModuleApiGroupContribution } from "@ecommerce/core";
import { Effect } from "effect";
import { HttpApi, HttpApiBuilder } from "effect/unstable/httpapi";

import type {
  EventDeadLetterRecord,
  EventOutboxRecord,
  EventPublishResult,
  EventPublishResultApiRecord,
  NotificationDispatchRecord,
  NotificationProviderRecord,
} from "../domain";
import { notificationEventPermissions } from "../permissions";
import { NotificationEventService } from "../services";
import { notificationEventAdminHttpApiGroup } from "./contract";

const serializeOutbox = (record: EventOutboxRecord) => ({
  attempts: record.attempts,
  availableAt: record.availableAt.toISOString(),
  createdAt: record.createdAt.toISOString(),
  eventId: record.eventId,
  id: record.id,
  lastError: record.lastError,
  status: record.status,
  updatedAt: record.updatedAt.toISOString(),
});

const serializeEnvelope = (result: EventPublishResult) => ({
  ...result.envelope,
  emittedAt: result.envelope.emittedAt.toISOString(),
});

const serializePublishResult = (
  result: EventPublishResult
): EventPublishResultApiRecord => ({
  envelope: serializeEnvelope(result),
  outbox: serializeOutbox(result.outbox),
});

const serializeDeadLetter = (record: EventDeadLetterRecord) => ({
  ...record,
  createdAt: record.createdAt.toISOString(),
});

const serializeProviderRecord = (record: NotificationProviderRecord) => ({
  ...record,
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
});

const serializeDispatch = (record: NotificationDispatchRecord) => ({
  ...record,
  createdAt: record.createdAt.toISOString(),
  deliveredAt: record.deliveredAt?.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
});

const withSuccessEnvelope = <TData>(
  data: TData,
  request: EffectHttpRequestIdentity
) =>
  ({
    data,
    meta: { request },
    success: true,
  }) as const;

const withCurrentRequest = <TData, TError, TRequirements>(
  effect: Effect.Effect<TData, TError, TRequirements>
) =>
  Effect.gen(function* createNotificationEventApiSuccessEnvelope() {
    const context = yield* CurrentEffectHttpRequestContext;
    const data = yield* effect;
    return withSuccessEnvelope(data, context.identity);
  });

const notificationEventAdminGroupIdentifier = "notificationEventAdmin";
const notificationEventAdminHttpApi = HttpApi.make(
  "NotificationEventAdminApi"
).add(notificationEventAdminHttpApiGroup);

/** Public Effect HTTP handlers supplied by this module contribution. */
export const notificationEventAdminHttpApiHandlers = HttpApiBuilder.group(
  notificationEventAdminHttpApi,
  notificationEventAdminGroupIdentifier,
  (handlers) =>
    handlers
      .handle("eventPublish", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            NotificationEventService.use((service) =>
              service
                .publishEvent(payload)
                .pipe(Effect.map(serializePublishResult))
            )
          ),
          notificationEventPermissions.eventWrite
        )
      )
      .handle("eventDeliveryFailureRecord", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            NotificationEventService.use((service) =>
              service
                .recordEventDeliveryFailure(payload)
                .pipe(Effect.map(serializeOutbox))
            )
          ),
          notificationEventPermissions.eventWrite
        )
      )
      .handle("eventDeadLetterList", () =>
        withEffectHttpPermission(
          withCurrentRequest(
            NotificationEventService.use((service) =>
              service.listDeadLetters.pipe(
                Effect.map((deadLetters) =>
                  deadLetters.map(serializeDeadLetter)
                )
              )
            )
          ),
          notificationEventPermissions.eventRead
        )
      )
      .handle("notificationProviderRegister", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            NotificationEventService.use((service) =>
              service
                .registerNotificationProvider(payload.providerKey)
                .pipe(Effect.map(serializeProviderRecord))
            )
          ),
          notificationEventPermissions.notificationWrite
        )
      )
      .handle("notificationTemplateUpsert", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            NotificationEventService.use((service) =>
              service.upsertNotificationTemplate(payload)
            )
          ),
          notificationEventPermissions.notificationWrite
        )
      )
      .handle("notificationDispatch", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            NotificationEventService.use((service) =>
              service
                .dispatchNotification(payload)
                .pipe(Effect.map(serializeDispatch))
            )
          ),
          notificationEventPermissions.notificationWrite
        )
      )
      .handle("notificationDispatchList", () =>
        withEffectHttpPermission(
          withCurrentRequest(
            NotificationEventService.use((service) =>
              service.listDispatches.pipe(
                Effect.map((dispatches) => dispatches.map(serializeDispatch))
              )
            )
          ),
          notificationEventPermissions.notificationRead
        )
      )
);

/** Executable HTTP contribution registered by the owning module definition. */
export const notificationEventEffectHttpApiContribution =
  defineEffectHttpApiModuleContribution({
    groups: [
      defineCommerceModuleApiGroupContribution({
        group: notificationEventAdminHttpApiGroup,
        handlers: notificationEventAdminHttpApiHandlers,
        key: "module:notification-event.admin",
        surface: "admin",
      }),
    ],
    moduleName: "notification-event",
  });
