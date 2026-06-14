import { z } from "zod";

export const EventEnvelopeApiSchema = z.object({
  causationId: z.string().min(1).optional(),
  correlationId: z.string().min(1).optional(),
  emittedAt: z.string().min(1),
  id: z.string().min(1).startsWith("evt_"),
  name: z.string().min(1),
  payload: z.unknown(),
  sourceModule: z.string().min(1).optional(),
  subject: z
    .object({
      id: z.string().min(1),
      type: z.string().min(1),
    })
    .optional(),
  workflowRunId: z.string().min(1).optional(),
});

export const EventOutboxStatusSchema = z.enum([
  "pending",
  "dispatched",
  "retrying",
  "dead-lettered",
]);

export const EventOutboxApiSchema = z.object({
  attempts: z.number().int().nonnegative(),
  availableAt: z.string().min(1),
  createdAt: z.string().min(1),
  eventId: z.string().min(1).startsWith("evt_"),
  id: z.string().min(1).startsWith("evt_"),
  lastError: z.string().min(1).optional(),
  status: EventOutboxStatusSchema,
  updatedAt: z.string().min(1),
});

export const EventPublishInputSchema = z.object({
  causationId: z.string().min(1).optional(),
  correlationId: z.string().min(1).optional(),
  name: z.string().min(1),
  payload: z.unknown(),
  sourceModule: z.string().min(1),
  subject: z
    .object({
      id: z.string().min(1),
      type: z.string().min(1),
    })
    .optional(),
  workflowRunId: z.string().min(1).optional(),
});

export const EventPublishResultApiSchema = z.object({
  envelope: EventEnvelopeApiSchema,
  outbox: EventOutboxApiSchema,
});

export const EventDeliveryFailureInputSchema = z.object({
  outboxId: z.string().min(1).startsWith("evt_"),
  reason: z.string().min(1),
  retryPolicy: z.object({
    backoffSeconds: z
      .array(z.number().int().nonnegative())
      .readonly()
      .optional(),
    maxAttempts: z.number().int().positive(),
  }),
});

export const EventDeadLetterApiSchema = z.object({
  attempts: z.number().int().positive(),
  createdAt: z.string().min(1),
  eventId: z.string().min(1).startsWith("evt_"),
  id: z.string().min(1),
  outboxId: z.string().min(1).startsWith("evt_"),
  reason: z.string().min(1),
});

export const NotificationChannelSchema = z.enum([
  "email",
  "sms",
  "webhook",
  "in-app",
]);

export const NotificationRecipientSchema = z.object({
  address: z.string().min(1),
  type: z.string().min(1),
});

export const NotificationTemplateSchema = z.object({
  channel: NotificationChannelSchema,
  id: z.string().min(1).startsWith("ntpl_"),
  name: z.string().min(1),
  providerKey: z.string().min(1),
  subject: z.string().min(1).optional(),
  templateKey: z.string().min(1),
});

export const UpsertNotificationTemplateInputSchema = NotificationTemplateSchema;

export const NotificationDispatchStatusSchema = z.enum([
  "pending",
  "queued",
  "delivered",
  "failed",
  "dead-lettered",
]);

export const DispatchNotificationInputSchema = z.object({
  causationId: z.string().min(1).optional(),
  channel: NotificationChannelSchema,
  correlationId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  payload: z.unknown(),
  recipient: NotificationRecipientSchema,
  templateKey: z.string().min(1),
  workflowRunId: z.string().min(1).optional(),
});

export const NotificationDispatchApiSchema = z.object({
  attempts: z.number().int().positive(),
  causationId: z.string().min(1).optional(),
  channel: NotificationChannelSchema,
  correlationId: z.string().min(1),
  createdAt: z.string().min(1),
  deliveredAt: z.string().min(1).optional(),
  id: z.string().min(1).startsWith("ndsp_"),
  idempotencyKey: z.string().min(1),
  lastError: z.string().min(1).optional(),
  payload: z.unknown(),
  providerKey: z.string().min(1),
  providerMessageId: z.string().min(1).optional(),
  recipient: NotificationRecipientSchema,
  status: NotificationDispatchStatusSchema,
  templateId: z.string().min(1).startsWith("ntpl_"),
  updatedAt: z.string().min(1),
  workflowRunId: z.string().min(1).optional(),
});

export const NotificationDispatchListApiSchema = z
  .array(NotificationDispatchApiSchema)
  .readonly();
