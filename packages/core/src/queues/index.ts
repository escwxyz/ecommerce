export {
  deliverOutboxBatch,
  outboxRecordToQueueMessage,
  OutboxQueuePublishFailure,
  type OutboxDeliveryBatchOptions,
  type OutboxDeliveryBatchReport,
  type OutboxDeliveryRecordResult,
} from "./outbox-delivery";

export interface CommerceQueueSubject {
  readonly type: string;
  readonly id: string;
}

export interface CommerceQueueMessageMetadata {
  readonly correlationId: string;
  readonly idempotencyKey: string;
  readonly causationId?: string;
  readonly subject?: CommerceQueueSubject;
  readonly workflowRunId?: string;
}

export interface CommerceQueueMessage<
  Payload = unknown,
> extends CommerceQueueMessageMetadata {
  readonly id: string;
  readonly queueName: string;
  readonly type: string;
  readonly payload: Payload;
}

export interface CommerceQueuePublishOptions {
  readonly delaySeconds?: number;
}

export interface CommerceQueuePublishResult {
  readonly messageId: string;
  readonly queuedAt: Date;
}

export interface CommerceQueuePublisher {
  publish<Payload = unknown>(
    message: CommerceQueueMessage<Payload>,
    options?: CommerceQueuePublishOptions
  ): Promise<CommerceQueuePublishResult>;
}

export interface CommerceQueueRetryPolicy {
  readonly maxAttempts: number;
  readonly backoffSeconds?: readonly number[];
}

export interface CommerceQueueConsumeContext {
  readonly attempt: number;
  readonly retryPolicy?: CommerceQueueRetryPolicy;
}

export interface CommerceQueueConsumer<Payload = unknown> {
  consume(
    message: CommerceQueueMessage<Payload>,
    context: CommerceQueueConsumeContext
  ): Promise<void> | void;
}

export interface CommerceQueueDeadLetter<Payload = unknown> {
  readonly message: CommerceQueueMessage<Payload>;
  readonly failedAt: Date;
  readonly reason: string;
  readonly attempts: number;
}

export const defineQueueMessage = <Payload = unknown>(
  message: CommerceQueueMessage<Payload>
): CommerceQueueMessage<Payload> => message;
