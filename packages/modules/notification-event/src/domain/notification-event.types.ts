import type { CommerceQueueRetryPolicy } from "@ecommerce/core/queues";
import type { Effect as EffectValue } from "effect/Effect";

import type { NotificationEventExpectedError } from "./notification-event.errors";
import type {
  DispatchNotificationInputSchema,
  EventDeadLetterApiSchema,
  EventDeadLetterListApiSchema,
  EventDeadLetterRecordSchema,
  EventDeliveryFailureInputSchema,
  EventEnvelopeApiSchema,
  EventEnvelopeSchema,
  EventOutboxApiSchema,
  EventOutboxRecordSchema,
  EventOutboxStatusSchema,
  EventPublishInputSchema,
  EventPublishResultApiSchema,
  EventPublishResultSchema,
  NotificationChannelSchema,
  NotificationDispatchApiSchema,
  NotificationDispatchListApiSchema,
  NotificationDispatchRecordSchema,
  NotificationDispatchStatusSchema,
  NotificationProviderApiSchema,
  NotificationProviderRecordSchema,
  NotificationRecipientSchema,
  NotificationTemplateSchema,
  UpsertNotificationTemplateInputSchema,
} from "./notification-event.schema";

export type EventEnvelope = typeof EventEnvelopeSchema.Type;
export type EventEnvelopeApiRecord = typeof EventEnvelopeApiSchema.Type;
export type EventOutboxStatus = typeof EventOutboxStatusSchema.Type;
export type EventPublishInput = typeof EventPublishInputSchema.Type;
export type EventDeliveryFailureInput =
  typeof EventDeliveryFailureInputSchema.Type;
export type EventOutboxRecord = typeof EventOutboxRecordSchema.Type;
export type EventOutboxApiRecord = typeof EventOutboxApiSchema.Type;
export type EventPublishResult = typeof EventPublishResultSchema.Type;
export type EventPublishResultApiRecord =
  typeof EventPublishResultApiSchema.Type;
export type EventDeadLetterRecord = typeof EventDeadLetterRecordSchema.Type;
export type EventDeadLetterApiRecord = typeof EventDeadLetterApiSchema.Type;
export type EventDeadLetterListApiRecord =
  typeof EventDeadLetterListApiSchema.Type;
export type NotificationChannel = typeof NotificationChannelSchema.Type;
export type NotificationRecipient = typeof NotificationRecipientSchema.Type;
export type NotificationTemplate = typeof NotificationTemplateSchema.Type;
export type UpsertNotificationTemplateInput =
  typeof UpsertNotificationTemplateInputSchema.Type;
export type NotificationProviderRecord =
  typeof NotificationProviderRecordSchema.Type;
export type NotificationProviderApiRecord =
  typeof NotificationProviderApiSchema.Type;
export type DispatchNotificationInput =
  typeof DispatchNotificationInputSchema.Type;
export type NotificationDispatchStatus =
  typeof NotificationDispatchStatusSchema.Type;
export type NotificationDispatchRecord =
  typeof NotificationDispatchRecordSchema.Type;
export type NotificationDispatchApiRecord =
  typeof NotificationDispatchApiSchema.Type;
export type NotificationDispatchListApiRecord =
  typeof NotificationDispatchListApiSchema.Type;

export interface NotificationProviderDeliveryInput {
  readonly dispatch: NotificationDispatchRecord;
  readonly template: NotificationTemplate;
}

export interface NotificationProviderDeliveryResult {
  readonly deliveredAt?: Date;
  readonly error?: string;
  readonly messageId: string;
  readonly status: "delivered" | "failed" | "queued";
}

export interface NotificationProvider {
  readonly key: string;
  deliver(
    input: NotificationProviderDeliveryInput
  ): Promise<NotificationProviderDeliveryResult>;
}

export interface NotificationEventRepository {
  readonly findDispatchByIdempotencyKey: (
    idempotencyKey: string
  ) => EffectValue<
    NotificationDispatchRecord | null,
    NotificationEventExpectedError
  >;
  readonly findOutboxById: (
    outboxId: string
  ) => EffectValue<EventOutboxRecord | null, NotificationEventExpectedError>;
  readonly findTemplateByKey: (input: {
    readonly channel: NotificationChannel;
    readonly templateKey: string;
  }) => EffectValue<
    NotificationTemplate | null,
    NotificationEventExpectedError
  >;
  readonly listDeadLetters: EffectValue<
    readonly EventDeadLetterRecord[],
    NotificationEventExpectedError
  >;
  readonly listDispatches: EffectValue<
    readonly NotificationDispatchRecord[],
    NotificationEventExpectedError
  >;
  readonly saveDeadLetter: (
    record: EventDeadLetterRecord
  ) => EffectValue<EventDeadLetterRecord, NotificationEventExpectedError>;
  readonly saveDispatch: (
    record: NotificationDispatchRecord
  ) => EffectValue<NotificationDispatchRecord, NotificationEventExpectedError>;
  readonly saveOutbox: (
    record: EventOutboxRecord
  ) => EffectValue<EventOutboxRecord, NotificationEventExpectedError>;
  readonly saveProviderRecord: (
    record: NotificationProviderRecord
  ) => EffectValue<NotificationProviderRecord, NotificationEventExpectedError>;
  readonly saveTemplate: (
    template: NotificationTemplate
  ) => EffectValue<NotificationTemplate, NotificationEventExpectedError>;
}

export type EventRetryPolicy = CommerceQueueRetryPolicy;
