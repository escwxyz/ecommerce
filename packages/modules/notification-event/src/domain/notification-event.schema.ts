import { Schema } from "effect";

export const NotificationEventTrimmedStringSchema = Schema.Trimmed.pipe(
  Schema.check(Schema.isMinLength(1))
);
export const NotificationEventMetadataSchema = Schema.Record(
  Schema.String,
  Schema.Unknown
);

export const EventSerializedIdSchema =
  NotificationEventTrimmedStringSchema.pipe(
    Schema.check(Schema.isStartsWith("evt_"))
  );
export const NotificationDispatchSerializedIdSchema =
  NotificationEventTrimmedStringSchema.pipe(
    Schema.check(Schema.isStartsWith("ndsp_"))
  );
export const NotificationProviderSerializedIdSchema =
  NotificationEventTrimmedStringSchema.pipe(
    Schema.check(Schema.isStartsWith("nprov_"))
  );
export const NotificationTemplateSerializedIdSchema =
  NotificationEventTrimmedStringSchema.pipe(
    Schema.check(Schema.isStartsWith("ntpl_"))
  );

export const NotificationEventIsoDateTimeStringSchema =
  NotificationEventTrimmedStringSchema.pipe(
    Schema.check(
      Schema.makeFilter((value: string) => !Number.isNaN(Date.parse(value)))
    )
  );

export const NotificationEventNonNegativeIntegerSchema = Schema.Number.pipe(
  Schema.check(Schema.isInt()),
  Schema.check(Schema.isGreaterThanOrEqualTo(0))
);
export const NotificationEventPositiveIntegerSchema = Schema.Number.pipe(
  Schema.check(Schema.isInt()),
  Schema.check(Schema.isGreaterThan(0))
);

export const EventSubjectSchema = Schema.Struct({
  id: NotificationEventTrimmedStringSchema,
  type: NotificationEventTrimmedStringSchema,
});

export const EventEnvelopeSchema = Schema.Struct({
  causationId: Schema.optional(NotificationEventTrimmedStringSchema),
  correlationId: Schema.optional(NotificationEventTrimmedStringSchema),
  emittedAt: Schema.Date,
  id: EventSerializedIdSchema,
  name: NotificationEventTrimmedStringSchema,
  payload: Schema.Unknown,
  sourceModule: Schema.optional(NotificationEventTrimmedStringSchema),
  subject: Schema.optional(EventSubjectSchema),
  workflowRunId: Schema.optional(NotificationEventTrimmedStringSchema),
});

export const EventEnvelopeApiSchema = Schema.Struct({
  causationId: Schema.optional(NotificationEventTrimmedStringSchema),
  correlationId: Schema.optional(NotificationEventTrimmedStringSchema),
  emittedAt: NotificationEventIsoDateTimeStringSchema,
  id: EventSerializedIdSchema,
  name: NotificationEventTrimmedStringSchema,
  payload: Schema.Unknown,
  sourceModule: Schema.optional(NotificationEventTrimmedStringSchema),
  subject: Schema.optional(EventSubjectSchema),
  workflowRunId: Schema.optional(NotificationEventTrimmedStringSchema),
});

export const EventOutboxStatusSchema = Schema.Literals([
  "pending",
  "dispatched",
  "retrying",
  "dead-lettered",
]);

export const EventOutboxRecordSchema = Schema.Struct({
  attempts: NotificationEventNonNegativeIntegerSchema,
  availableAt: Schema.Date,
  createdAt: Schema.Date,
  envelope: EventEnvelopeSchema,
  eventId: EventSerializedIdSchema,
  id: EventSerializedIdSchema,
  lastError: Schema.optional(NotificationEventTrimmedStringSchema),
  status: EventOutboxStatusSchema,
  updatedAt: Schema.Date,
});

export const EventOutboxApiSchema = Schema.Struct({
  attempts: NotificationEventNonNegativeIntegerSchema,
  availableAt: NotificationEventIsoDateTimeStringSchema,
  createdAt: NotificationEventIsoDateTimeStringSchema,
  eventId: EventSerializedIdSchema,
  id: EventSerializedIdSchema,
  lastError: Schema.optional(NotificationEventTrimmedStringSchema),
  status: EventOutboxStatusSchema,
  updatedAt: NotificationEventIsoDateTimeStringSchema,
});

export const EventPublishInputSchema = Schema.Struct({
  causationId: Schema.optional(NotificationEventTrimmedStringSchema),
  correlationId: Schema.optional(NotificationEventTrimmedStringSchema),
  name: NotificationEventTrimmedStringSchema,
  payload: Schema.Unknown,
  sourceModule: NotificationEventTrimmedStringSchema,
  subject: Schema.optional(EventSubjectSchema),
  workflowRunId: Schema.optional(NotificationEventTrimmedStringSchema),
});

export const EventPublishResultSchema = Schema.Struct({
  envelope: EventEnvelopeSchema,
  outbox: EventOutboxRecordSchema,
});

export const EventPublishResultApiSchema = Schema.Struct({
  envelope: EventEnvelopeApiSchema,
  outbox: EventOutboxApiSchema,
});

export const EventDeliveryFailureInputSchema = Schema.Struct({
  outboxId: EventSerializedIdSchema,
  reason: NotificationEventTrimmedStringSchema,
  retryPolicy: Schema.Struct({
    backoffSeconds: Schema.optional(
      Schema.Array(NotificationEventNonNegativeIntegerSchema)
    ),
    maxAttempts: NotificationEventPositiveIntegerSchema,
  }),
});

export const EventDeadLetterRecordSchema = Schema.Struct({
  attempts: NotificationEventPositiveIntegerSchema,
  createdAt: Schema.Date,
  eventId: EventSerializedIdSchema,
  id: NotificationEventTrimmedStringSchema,
  outboxId: EventSerializedIdSchema,
  reason: NotificationEventTrimmedStringSchema,
});

export const EventDeadLetterApiSchema = Schema.Struct({
  attempts: NotificationEventPositiveIntegerSchema,
  createdAt: NotificationEventIsoDateTimeStringSchema,
  eventId: EventSerializedIdSchema,
  id: NotificationEventTrimmedStringSchema,
  outboxId: EventSerializedIdSchema,
  reason: NotificationEventTrimmedStringSchema,
});

export const EventDeadLetterListApiSchema = Schema.Array(
  EventDeadLetterApiSchema
);

export const NotificationChannelSchema = Schema.Literals([
  "email",
  "sms",
  "webhook",
  "in-app",
]);

export const NotificationRecipientSchema = Schema.Struct({
  address: NotificationEventTrimmedStringSchema,
  type: NotificationEventTrimmedStringSchema,
});

export const NotificationTemplateSchema = Schema.Struct({
  channel: NotificationChannelSchema,
  id: NotificationTemplateSerializedIdSchema,
  name: NotificationEventTrimmedStringSchema,
  providerKey: NotificationEventTrimmedStringSchema,
  subject: Schema.optional(NotificationEventTrimmedStringSchema),
  templateKey: NotificationEventTrimmedStringSchema,
});

export const UpsertNotificationTemplateInputSchema = NotificationTemplateSchema;

export const NotificationProviderRecordSchema = Schema.Struct({
  createdAt: Schema.Date,
  id: NotificationProviderSerializedIdSchema,
  isEnabled: Schema.Boolean,
  providerKey: NotificationEventTrimmedStringSchema,
  updatedAt: Schema.Date,
});

export const NotificationProviderApiSchema = Schema.Struct({
  createdAt: NotificationEventIsoDateTimeStringSchema,
  id: NotificationProviderSerializedIdSchema,
  isEnabled: Schema.Boolean,
  providerKey: NotificationEventTrimmedStringSchema,
  updatedAt: NotificationEventIsoDateTimeStringSchema,
});

export const NotificationDispatchStatusSchema = Schema.Literals([
  "pending",
  "queued",
  "delivered",
  "failed",
  "dead-lettered",
]);

export const DispatchNotificationInputSchema = Schema.Struct({
  causationId: Schema.optional(NotificationEventTrimmedStringSchema),
  channel: NotificationChannelSchema,
  correlationId: NotificationEventTrimmedStringSchema,
  idempotencyKey: NotificationEventTrimmedStringSchema,
  payload: Schema.Unknown,
  recipient: NotificationRecipientSchema,
  templateKey: NotificationEventTrimmedStringSchema,
  workflowRunId: Schema.optional(NotificationEventTrimmedStringSchema),
});

export const NotificationDispatchRecordSchema = Schema.Struct({
  attempts: NotificationEventPositiveIntegerSchema,
  causationId: Schema.optional(NotificationEventTrimmedStringSchema),
  channel: NotificationChannelSchema,
  correlationId: NotificationEventTrimmedStringSchema,
  createdAt: Schema.Date,
  deliveredAt: Schema.optional(Schema.Date),
  id: NotificationDispatchSerializedIdSchema,
  idempotencyKey: NotificationEventTrimmedStringSchema,
  lastError: Schema.optional(NotificationEventTrimmedStringSchema),
  payload: Schema.Unknown,
  providerKey: NotificationEventTrimmedStringSchema,
  providerMessageId: Schema.optional(NotificationEventTrimmedStringSchema),
  recipient: NotificationRecipientSchema,
  status: NotificationDispatchStatusSchema,
  templateId: NotificationTemplateSerializedIdSchema,
  updatedAt: Schema.Date,
  workflowRunId: Schema.optional(NotificationEventTrimmedStringSchema),
});

export const NotificationDispatchApiSchema = Schema.Struct({
  attempts: NotificationEventPositiveIntegerSchema,
  causationId: Schema.optional(NotificationEventTrimmedStringSchema),
  channel: NotificationChannelSchema,
  correlationId: NotificationEventTrimmedStringSchema,
  createdAt: NotificationEventIsoDateTimeStringSchema,
  deliveredAt: Schema.optional(NotificationEventIsoDateTimeStringSchema),
  id: NotificationDispatchSerializedIdSchema,
  idempotencyKey: NotificationEventTrimmedStringSchema,
  lastError: Schema.optional(NotificationEventTrimmedStringSchema),
  payload: Schema.Unknown,
  providerKey: NotificationEventTrimmedStringSchema,
  providerMessageId: Schema.optional(NotificationEventTrimmedStringSchema),
  recipient: NotificationRecipientSchema,
  status: NotificationDispatchStatusSchema,
  templateId: NotificationTemplateSerializedIdSchema,
  updatedAt: NotificationEventIsoDateTimeStringSchema,
  workflowRunId: Schema.optional(NotificationEventTrimmedStringSchema),
});

export const NotificationDispatchListApiSchema = Schema.Array(
  NotificationDispatchApiSchema
);
