import type { CommerceEventEnvelope } from "@ecommerce/core/events";
import type { CommerceQueueRetryPolicy } from "@ecommerce/core/queues";
import type { z } from "zod";

import type {
  DispatchNotificationInputSchema,
  EventDeadLetterApiSchema,
  EventDeliveryFailureInputSchema,
  EventOutboxApiSchema,
  EventOutboxStatusSchema,
  EventPublishInputSchema,
  EventPublishResultApiSchema,
  NotificationChannelSchema,
  NotificationDispatchApiSchema,
  NotificationDispatchListApiSchema,
  NotificationDispatchStatusSchema,
  NotificationRecipientSchema,
  NotificationTemplateSchema,
  UpsertNotificationTemplateInputSchema,
} from "./notification-event.schema";

export type EventOutboxStatus = z.infer<typeof EventOutboxStatusSchema>;
export type EventPublishInput = z.infer<typeof EventPublishInputSchema>;
export type EventDeliveryFailureInput = z.infer<
  typeof EventDeliveryFailureInputSchema
>;
export type EventOutboxApiRecord = z.infer<typeof EventOutboxApiSchema>;
export type EventPublishResultApiRecord = z.infer<
  typeof EventPublishResultApiSchema
>;
export type EventDeadLetterApiRecord = z.infer<typeof EventDeadLetterApiSchema>;
export type NotificationChannel = z.infer<typeof NotificationChannelSchema>;
export type NotificationRecipient = z.infer<typeof NotificationRecipientSchema>;
export type NotificationTemplate = z.infer<typeof NotificationTemplateSchema>;
export type UpsertNotificationTemplateInput = z.infer<
  typeof UpsertNotificationTemplateInputSchema
>;
export type DispatchNotificationInput = z.infer<
  typeof DispatchNotificationInputSchema
>;
export type NotificationDispatchStatus = z.infer<
  typeof NotificationDispatchStatusSchema
>;
export type NotificationDispatchApiRecord = z.infer<
  typeof NotificationDispatchApiSchema
>;
export type NotificationDispatchListApiRecord = z.infer<
  typeof NotificationDispatchListApiSchema
>;

export interface EventOutboxRecord {
  readonly attempts: number;
  readonly availableAt: Date;
  readonly createdAt: Date;
  readonly envelope: CommerceEventEnvelope;
  readonly eventId: string;
  readonly id: string;
  readonly lastError?: string;
  readonly status: EventOutboxStatus;
  readonly updatedAt: Date;
}

export interface EventDeadLetterRecord {
  readonly attempts: number;
  readonly createdAt: Date;
  readonly eventId: string;
  readonly id: string;
  readonly outboxId: string;
  readonly reason: string;
}

export interface EventPublishResult {
  readonly envelope: CommerceEventEnvelope;
  readonly outbox: EventOutboxRecord;
}

export interface NotificationProviderRecord {
  readonly createdAt: Date;
  readonly id: string;
  readonly isEnabled: boolean;
  readonly providerKey: string;
  readonly updatedAt: Date;
}

export interface NotificationDispatchRecord {
  readonly attempts: number;
  readonly causationId?: string;
  readonly channel: NotificationChannel;
  readonly correlationId: string;
  readonly createdAt: Date;
  readonly deliveredAt?: Date;
  readonly id: string;
  readonly idempotencyKey: string;
  readonly lastError?: string;
  readonly payload: unknown;
  readonly providerKey: string;
  readonly providerMessageId?: string;
  readonly recipient: NotificationRecipient;
  readonly status: NotificationDispatchStatus;
  readonly templateId: string;
  readonly updatedAt: Date;
  readonly workflowRunId?: string;
}

export interface NotificationProviderDeliveryInput {
  readonly dispatch: NotificationDispatchRecord;
  readonly template: NotificationTemplate;
}

export interface NotificationProviderDeliveryResult {
  readonly deliveredAt?: Date;
  readonly messageId: string;
  readonly status: "delivered" | "failed" | "queued";
  readonly error?: string;
}

export interface NotificationProvider {
  readonly key: string;
  deliver(
    input: NotificationProviderDeliveryInput
  ): Promise<NotificationProviderDeliveryResult>;
}

export interface NotificationEventRepository {
  findDispatchByIdempotencyKey(
    idempotencyKey: string
  ): Promise<NotificationDispatchRecord | null>;
  findOutboxById(outboxId: string): Promise<EventOutboxRecord | null>;
  findTemplateByKey(input: {
    readonly channel: NotificationChannel;
    readonly templateKey: string;
  }): Promise<NotificationTemplate | null>;
  listDeadLetters(): Promise<readonly EventDeadLetterRecord[]>;
  listDispatches(): Promise<readonly NotificationDispatchRecord[]>;
  saveDeadLetter(record: EventDeadLetterRecord): Promise<EventDeadLetterRecord>;
  saveDispatch(
    record: NotificationDispatchRecord
  ): Promise<NotificationDispatchRecord>;
  saveOutbox(record: EventOutboxRecord): Promise<EventOutboxRecord>;
  saveProviderRecord(
    record: NotificationProviderRecord
  ): Promise<NotificationProviderRecord>;
  saveTemplate(template: NotificationTemplate): Promise<NotificationTemplate>;
}

export type EventRetryPolicy = CommerceQueueRetryPolicy;
