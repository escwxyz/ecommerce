import type { RepositoryFailure } from "@ecommerce/core";
/* eslint-disable max-classes-per-file -- notification-event expected failures form one schema-backed domain vocabulary */
import { Schema } from "effect";

import {
  EventSerializedIdSchema,
  NotificationChannelSchema,
  NotificationEventTrimmedStringSchema,
} from "./notification-event.schema";

export class NotificationEventOutboxNotFound extends Schema.TaggedErrorClass<NotificationEventOutboxNotFound>()(
  "NotificationEventOutboxNotFound",
  {
    outboxId: EventSerializedIdSchema,
  }
) {}

export class NotificationTemplateNotFound extends Schema.TaggedErrorClass<NotificationTemplateNotFound>()(
  "NotificationTemplateNotFound",
  {
    channel: NotificationChannelSchema,
    templateKey: NotificationEventTrimmedStringSchema,
  }
) {}

export class NotificationProviderUnavailable extends Schema.TaggedErrorClass<NotificationProviderUnavailable>()(
  "NotificationProviderUnavailable",
  {
    providerKey: NotificationEventTrimmedStringSchema,
  }
) {}

export class NotificationEventRuntimeFailure extends Schema.TaggedErrorClass<NotificationEventRuntimeFailure>()(
  "NotificationEventRuntimeFailure",
  {
    reason: NotificationEventTrimmedStringSchema,
  }
) {}

export class NotificationEventValidationFailure extends Schema.TaggedErrorClass<NotificationEventValidationFailure>()(
  "NotificationEventValidationFailure",
  {
    reason: NotificationEventTrimmedStringSchema,
  }
) {}

export type NotificationEventExpectedError =
  | NotificationEventOutboxNotFound
  | NotificationEventRuntimeFailure
  | NotificationEventValidationFailure
  | NotificationProviderUnavailable
  | NotificationTemplateNotFound
  | RepositoryFailure;
