import {
  RepositoryConflict,
  RepositoryDecodeFailure,
  RepositoryUnavailable,
} from "@ecommerce/core";
import {
  DispatchNotificationInputSchema,
  EventDeadLetterListApiSchema,
  EventDeliveryFailureInputSchema,
  EventOutboxApiSchema,
  EventPublishInputSchema,
  EventPublishResultApiSchema,
  NotificationDispatchApiSchema,
  NotificationDispatchListApiSchema,
  NotificationEventOutboxNotFound,
  NotificationEventRuntimeFailure,
  NotificationEventValidationFailure,
  NotificationProviderApiSchema,
  NotificationProviderUnavailable,
  NotificationTemplateNotFound,
  NotificationTemplateSchema,
  UpsertNotificationTemplateInputSchema,
} from "@ecommerce/notification-event";
import { Schema } from "effect";
import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
} from "effect/unstable/httpapi";

import {
  EffectHttpAuthMiddleware,
  EffectHttpExecutionMiddleware,
  EffectHttpForbidden,
  EffectHttpRequestContextMiddleware,
} from "./effect-http-middleware";
import { createApiSuccessSchema } from "./http-api-schemas";

const notificationEventAdminGroupIdentifier = "notificationEventAdmin";

const notificationEventDomainErrors = [
  NotificationEventOutboxNotFound.pipe(HttpApiSchema.status(404)),
  NotificationEventRuntimeFailure.pipe(HttpApiSchema.status(503)),
  NotificationEventValidationFailure.pipe(HttpApiSchema.status(400)),
  NotificationProviderUnavailable.pipe(HttpApiSchema.status(400)),
  NotificationTemplateNotFound.pipe(HttpApiSchema.status(404)),
] as const;
const notificationEventPersistenceErrors = [
  RepositoryConflict.pipe(HttpApiSchema.status(409)),
  RepositoryDecodeFailure.pipe(HttpApiSchema.status(503)),
  RepositoryUnavailable.pipe(HttpApiSchema.status(503)),
] as const;

export const notificationEventReadErrors = [
  EffectHttpForbidden,
  ...notificationEventDomainErrors,
  ...notificationEventPersistenceErrors,
] as const;
export const notificationEventWriteErrors = [
  EffectHttpForbidden,
  ...notificationEventDomainErrors,
  ...notificationEventPersistenceErrors,
] as const;

const RegisterNotificationProviderInputSchema = Schema.Struct({
  providerKey: Schema.NonEmptyString,
});

const NotificationProviderRecordSuccessSchema = createApiSuccessSchema(
  NotificationProviderApiSchema
);
const EventPublishResultSuccessSchema = createApiSuccessSchema(
  EventPublishResultApiSchema
);
const EventOutboxSuccessSchema = createApiSuccessSchema(EventOutboxApiSchema);
const EventDeadLetterListSuccessSchema = createApiSuccessSchema(
  EventDeadLetterListApiSchema
);
const NotificationDispatchSuccessSchema = createApiSuccessSchema(
  NotificationDispatchApiSchema
);
const NotificationDispatchListSuccessSchema = createApiSuccessSchema(
  NotificationDispatchListApiSchema
);
const NotificationTemplateSuccessSchema = createApiSuccessSchema(
  NotificationTemplateSchema
);

/** Notification-event admin Effect HTTP contract for outbox, dispatch, provider, and template operations. */
export const notificationEventAdminHttpApiGroup = HttpApiGroup.make(
  notificationEventAdminGroupIdentifier
)
  .add(
    HttpApiEndpoint.post("eventPublish", "/admin/events", {
      error: notificationEventWriteErrors,
      payload: EventPublishInputSchema,
      success: EventPublishResultSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.post(
      "eventDeliveryFailureRecord",
      "/admin/events/outbox/:outboxId/failures",
      {
        error: notificationEventWriteErrors,
        payload: EventDeliveryFailureInputSchema,
        success: EventOutboxSuccessSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.get("eventDeadLetterList", "/admin/events/dead-letters", {
      error: notificationEventReadErrors,
      success: EventDeadLetterListSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.post(
      "notificationProviderRegister",
      "/admin/notifications/providers",
      {
        error: notificationEventWriteErrors,
        payload: RegisterNotificationProviderInputSchema,
        success: NotificationProviderRecordSuccessSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.put(
      "notificationTemplateUpsert",
      "/admin/notifications/templates/:templateKey",
      {
        error: notificationEventWriteErrors,
        payload: UpsertNotificationTemplateInputSchema,
        success: NotificationTemplateSuccessSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.post(
      "notificationDispatch",
      "/admin/notifications/dispatches",
      {
        error: notificationEventWriteErrors,
        payload: DispatchNotificationInputSchema,
        success: NotificationDispatchSuccessSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.get(
      "notificationDispatchList",
      "/admin/notifications/dispatches",
      {
        error: notificationEventReadErrors,
        success: NotificationDispatchListSuccessSchema,
      }
    )
  )
  .middleware(EffectHttpExecutionMiddleware)
  .middleware(EffectHttpAuthMiddleware)
  .middleware(EffectHttpRequestContextMiddleware);
