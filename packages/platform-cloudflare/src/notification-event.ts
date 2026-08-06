import { recordCommerceRuntimeMetric } from "@ecommerce/core";
import type {
  DispatchNotificationInput,
  EventOutboxRecord,
  EventPublishResult,
  EventRetryPolicy,
  NotificationDispatchRecord,
  NotificationEventRepository,
  NotificationProvider,
  NotificationProviderDeliveryResult,
  NotificationTemplate,
} from "@ecommerce/notification-event/domain";
import { Effect } from "effect";

export const notificationEventQueueName = "notification-event-work" as const;
export const notificationEventDeadLetterQueueName =
  "notification-event-dead-letter" as const;
export const notificationEventRealtimeDefaultScope = "tenant:default" as const;

export interface NotificationEventQueueMetadata {
  readonly causationId?: string;
  readonly correlationId?: string;
  readonly idempotencyKey: string;
  readonly workflowRunId?: string;
}

export interface NotificationEventOutboxQueueMessage {
  readonly id: string;
  readonly kind: "event-outbox";
  readonly metadata: NotificationEventQueueMetadata;
  readonly payload: {
    readonly eventId: string;
    readonly eventName: string;
    readonly outboxId: string;
    readonly sourceModule?: string;
    readonly subject?: {
      readonly id: string;
      readonly type: string;
    };
  };
  readonly queueName: typeof notificationEventQueueName;
}

export interface NotificationDispatchQueueMessage {
  readonly id: string;
  readonly kind: "notification-dispatch";
  readonly metadata: NotificationEventQueueMetadata;
  readonly payload: {
    readonly dispatch: NotificationDispatchRecord;
    readonly input: DispatchNotificationInput;
    readonly providerKey: string;
    readonly template: NotificationTemplate;
  };
  readonly queueName: typeof notificationEventQueueName;
}

export interface NotificationEventDeadLetterQueueMessage {
  readonly id: string;
  readonly kind: "dead-letter";
  readonly metadata: NotificationEventQueueMetadata;
  readonly payload: {
    readonly attempts: number;
    readonly reason: string;
    readonly source: NotificationEventQueueMessage;
  };
  readonly queueName: typeof notificationEventDeadLetterQueueName;
}

export type NotificationEventQueueMessage =
  | NotificationEventOutboxQueueMessage
  | NotificationDispatchQueueMessage
  | NotificationEventDeadLetterQueueMessage;

export interface NotificationEventRealtimeUpdate {
  readonly id: string;
  readonly occurredAt: string;
  readonly payload: unknown;
  readonly type:
    | "event-dispatched"
    | "event-dead-lettered"
    | "event-retrying"
    | "notification-delivered"
    | "notification-dead-lettered"
    | "notification-failed"
    | "notification-queued";
}

export interface NotificationEventRealtimePublisher {
  publish(
    scope: string,
    update: NotificationEventRealtimeUpdate
  ): Promise<void>;
}

export interface NotificationEventRealtimeDurableObjectStub {
  broadcast(update: NotificationEventRealtimeUpdate): Promise<void>;
  fetch(request: Request): Promise<Response>;
}

export interface NotificationEventRealtimeNamespace {
  getByName(name: string): NotificationEventRealtimeDurableObjectStub;
}

export interface NotificationEventQueueBatchMessage {
  readonly body: NotificationEventQueueMessage;
  ack(): void;
  retry(): void;
}

export interface NotificationEventQueuePublisherOptions {
  readonly clock: { now(): Date };
  readonly queue?: Queue<NotificationEventQueueMessage>;
  readonly realtime?: NotificationEventRealtimePublisher;
  readonly streamScope?: string;
}

export interface QueuedNotificationProviderOptions extends NotificationEventQueuePublisherOptions {
  readonly providerKey: string;
}

export interface NotificationEventQueueConsumerOptions {
  readonly clock: { now(): Date };
  readonly notificationProviders?: readonly NotificationProvider[];
  readonly repository: NotificationEventRepository;
  readonly retryPolicy: EventRetryPolicy;
  readonly realtime?: NotificationEventRealtimePublisher;
  readonly streamScope?: string;
}

export interface NotificationEventOutboxDrainOptions {
  readonly clock: { now(): Date };
  readonly limit: number;
  readonly queue?: Queue<NotificationEventQueueMessage>;
  readonly repository: NotificationEventRepository;
  readonly retryPolicy: EventRetryPolicy;
  readonly realtime?: NotificationEventRealtimePublisher;
  readonly streamScope?: string;
}

export interface NotificationEventOutboxDrainReport {
  readonly deadLettered: number;
  readonly failed: number;
  readonly published: number;
  readonly scanned: number;
}

export interface NotificationEventQueueBatch {
  readonly messages: readonly NotificationEventQueueBatchMessage[];
}

const getMessageId = (prefix: string, idempotencyKey: string): string =>
  `${prefix}:${idempotencyKey}`;

const serializeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const getProvidersByKey = (
  providers: readonly NotificationProvider[]
): ReadonlyMap<string, NotificationProvider> =>
  new Map(providers.map((provider) => [provider.key, provider]));

const getStreamScope = (scope?: string): string =>
  scope ?? notificationEventRealtimeDefaultScope;

const safePublishRealtime = async (
  publisher: NotificationEventRealtimePublisher | undefined,
  scope: string | undefined,
  update: NotificationEventRealtimeUpdate
): Promise<void> => {
  try {
    await publisher?.publish(getStreamScope(scope), update);
  } catch {
    // Realtime is best-effort; queue/audit state remains authoritative.
  }
};

const recordNotificationRuntimeMetric = async (
  options: Parameters<typeof recordCommerceRuntimeMetric>[0]
): Promise<void> => {
  await Effect.runPromise(
    recordCommerceRuntimeMetric(options).pipe(Effect.exit)
  );
};

const failedDispatchRuntimeMetricEvent = (
  status: NotificationDispatchRecord["status"]
) => (status === "dead-lettered" ? "poison_message" : "retry");

const getRetryDelaySeconds = (
  retryPolicy: EventRetryPolicy,
  attempts: number
): number => {
  const backoffSeconds = retryPolicy.backoffSeconds ?? [30];
  const retryIndex = Math.min(attempts - 1, backoffSeconds.length - 1);
  return backoffSeconds[retryIndex] ?? 30;
};

const realtimeTypeForFailedDispatch = (
  status: NotificationDispatchRecord["status"]
) =>
  status === "dead-lettered"
    ? "notification-dead-lettered"
    : "notification-failed";

const recordFailedDispatchMetric = (
  failed: NotificationDispatchRecord
): Promise<void> =>
  recordNotificationRuntimeMetric({
    attributes: {
      status: failed.status,
    },
    boundary: "provider",
    event: failedDispatchRuntimeMetricEvent(failed.status),
  });

const toOutboxQueueMessage = (
  result: EventPublishResult
): NotificationEventOutboxQueueMessage => ({
  id: getMessageId("event-outbox", result.outbox.id),
  kind: "event-outbox",
  metadata: {
    causationId: result.envelope.causationId,
    correlationId: result.envelope.correlationId,
    idempotencyKey: result.outbox.id,
    workflowRunId: result.envelope.workflowRunId,
  },
  payload: {
    eventId: result.envelope.id,
    eventName: result.envelope.name,
    outboxId: result.outbox.id,
    sourceModule: result.envelope.sourceModule,
    subject: result.envelope.subject,
  },
  queueName: notificationEventQueueName,
});

const toDispatchQueueMessage = (
  input: DispatchNotificationInput,
  dispatch: NotificationDispatchRecord,
  template: NotificationTemplate
): NotificationDispatchQueueMessage => ({
  id: getMessageId("notification-dispatch", input.idempotencyKey),
  kind: "notification-dispatch",
  metadata: {
    causationId: input.causationId,
    correlationId: input.correlationId,
    idempotencyKey: input.idempotencyKey,
    workflowRunId: input.workflowRunId,
  },
  payload: {
    dispatch,
    input,
    providerKey: dispatch.providerKey,
    template,
  },
  queueName: notificationEventQueueName,
});

const markOutboxDispatched = async (
  repository: NotificationEventRepository,
  outboxId: string,
  now: Date
): Promise<EventOutboxRecord | null> => {
  const outbox = await Effect.runPromise(repository.findOutboxById(outboxId));

  if (!outbox || outbox.status === "dispatched") {
    return outbox;
  }

  return Effect.runPromise(
    repository.saveOutbox({
      ...outbox,
      attempts: outbox.attempts + 1,
      status: "dispatched",
      updatedAt: now,
    })
  );
};

const findDispatchById = async (
  repository: NotificationEventRepository,
  dispatchId: string
): Promise<NotificationDispatchRecord | null> => {
  const dispatches = await Effect.runPromise(repository.listDispatches);
  return dispatches.find((dispatch) => dispatch.id === dispatchId) ?? null;
};

const applyProviderResult = (
  dispatch: NotificationDispatchRecord,
  result: NotificationProviderDeliveryResult,
  now: Date
): NotificationDispatchRecord => ({
  ...dispatch,
  attempts: dispatch.attempts + 1,
  deliveredAt:
    result.status === "delivered" ? (result.deliveredAt ?? now) : undefined,
  lastError: result.error,
  providerMessageId: result.messageId,
  status: result.status,
  updatedAt: now,
});

const recordNotificationFailure = (
  repository: NotificationEventRepository,
  dispatch: NotificationDispatchRecord,
  reason: string,
  retryPolicy: EventRetryPolicy,
  now: Date
): Promise<NotificationDispatchRecord> => {
  const attempts = dispatch.attempts + 1;
  const exhausted = attempts >= retryPolicy.maxAttempts;

  return Effect.runPromise(
    repository.saveDispatch({
      ...dispatch,
      attempts,
      lastError: reason,
      status: exhausted ? "dead-lettered" : "failed",
      updatedAt: now,
    })
  );
};

const recordNotificationDeadLetter = async (
  repository: NotificationEventRepository,
  source: NotificationDispatchQueueMessage,
  reason: string,
  attempts: number,
  now: Date
): Promise<NotificationDispatchRecord> => {
  const existing = await findDispatchById(
    repository,
    source.payload.dispatch.id
  );
  const dispatch = existing ?? source.payload.dispatch;

  return Effect.runPromise(
    repository.saveDispatch({
      ...dispatch,
      attempts,
      lastError: reason,
      status: "dead-lettered",
      updatedAt: now,
    })
  );
};

const recordEventDeadLetter = async (
  repository: NotificationEventRepository,
  source: NotificationEventOutboxQueueMessage,
  reason: string,
  attempts: number,
  now: Date
): Promise<EventOutboxRecord | null> => {
  const outbox = await Effect.runPromise(
    repository.findOutboxById(source.payload.outboxId)
  );

  if (!outbox) {
    return null;
  }

  const deadLettered = await Effect.runPromise(
    repository.saveOutbox({
      ...outbox,
      attempts,
      lastError: reason,
      status: "dead-lettered",
      updatedAt: now,
    })
  );

  await Effect.runPromise(
    repository.saveDeadLetter({
      attempts,
      createdAt: now,
      eventId: outbox.eventId,
      id: `${outbox.id}:dead-letter`,
      outboxId: outbox.id,
      reason,
    })
  );

  return deadLettered;
};

export const createNotificationEventQueuePublisher = ({
  clock,
  queue,
  realtime,
  streamScope,
}: NotificationEventQueuePublisherOptions) => ({
  eventPublished: async (result: EventPublishResult): Promise<void> => {
    if (!queue) {
      return;
    }

    const message = toOutboxQueueMessage(result);
    await queue.send(message);
    await safePublishRealtime(realtime, streamScope, {
      id: message.id,
      occurredAt: clock.now().toISOString(),
      payload: message.payload,
      type: "notification-queued",
    });
  },
});

export const drainNotificationEventOutbox = async ({
  clock,
  limit,
  queue,
  repository,
  retryPolicy,
  realtime,
  streamScope,
}: NotificationEventOutboxDrainOptions): Promise<NotificationEventOutboxDrainReport> => {
  if (!queue) {
    return {
      deadLettered: 0,
      failed: 0,
      published: 0,
      scanned: 0,
    };
  }

  const outboxRecords = await Effect.runPromise(
    repository.listPendingOutbox({
      availableAt: clock.now(),
      limit,
    })
  );
  let deadLettered = 0;
  let failed = 0;
  let published = 0;

  for (const outbox of outboxRecords) {
    const message = toOutboxQueueMessage({
      envelope: outbox.envelope,
      outbox,
    });

    try {
      await queue.send(message);
      await safePublishRealtime(realtime, streamScope, {
        id: message.id,
        occurredAt: clock.now().toISOString(),
        payload: message.payload,
        type: "notification-queued",
      });
      published += 1;
    } catch (error) {
      const attempts = outbox.attempts + 1;
      const exhausted = attempts >= retryPolicy.maxAttempts;

      await Effect.runPromise(
        repository.saveOutbox({
          ...outbox,
          attempts,
          availableAt: exhausted
            ? outbox.availableAt
            : new Date(
                clock.now().getTime() +
                  getRetryDelaySeconds(retryPolicy, attempts) * 1000
              ),
          lastError: serializeError(error),
          status: exhausted ? "dead-lettered" : "retrying",
          updatedAt: clock.now(),
        })
      );

      if (exhausted) {
        await Effect.runPromise(
          repository.saveDeadLetter({
            attempts,
            createdAt: clock.now(),
            eventId: outbox.eventId,
            id: `${outbox.id}:dead-letter`,
            outboxId: outbox.id,
            reason: serializeError(error),
          })
        );
        deadLettered += 1;
      } else {
        failed += 1;
      }
    }
  }

  return {
    deadLettered,
    failed,
    published,
    scanned: outboxRecords.length,
  };
};

export const createCloudflareQueuedNotificationProvider = ({
  clock,
  providerKey,
  queue,
  realtime,
  streamScope,
}: QueuedNotificationProviderOptions): NotificationProvider => ({
  key: providerKey,
  deliver: async ({ dispatch, template }) => {
    if (!queue) {
      return {
        error: "Cloudflare notification-event queue binding is not available.",
        messageId: getMessageId(
          "notification-dispatch-missing-queue",
          dispatch.id
        ),
        status: "failed",
      };
    }

    const input: DispatchNotificationInput = {
      causationId: dispatch.causationId,
      channel: dispatch.channel,
      correlationId: dispatch.correlationId,
      idempotencyKey: dispatch.idempotencyKey,
      payload: dispatch.payload,
      recipient: dispatch.recipient,
      templateKey: template.templateKey,
      workflowRunId: dispatch.workflowRunId,
    };
    const message = toDispatchQueueMessage(input, dispatch, template);

    await queue.send(message);
    await safePublishRealtime(realtime, streamScope, {
      id: message.id,
      occurredAt: clock.now().toISOString(),
      payload: {
        dispatchId: dispatch.id,
        providerKey,
      },
      type: "notification-queued",
    });

    return {
      messageId: message.id,
      status: "queued",
    };
  },
});

export const createNotificationEventRealtimePublisher = ({
  namespace,
}: {
  readonly namespace?: NotificationEventRealtimeNamespace;
}): NotificationEventRealtimePublisher => ({
  publish: async (scope, update) => {
    if (!namespace) {
      return;
    }

    const stub = namespace.getByName(scope);
    await stub.broadcast(update);
  },
});

export const processNotificationEventQueueMessage = async (
  message: NotificationEventQueueMessage,
  options: NotificationEventQueueConsumerOptions
): Promise<void> => {
  if (message.kind === "event-outbox") {
    const outbox = await markOutboxDispatched(
      options.repository,
      message.payload.outboxId,
      options.clock.now()
    );

    if (outbox) {
      await safePublishRealtime(options.realtime, options.streamScope, {
        id: message.id,
        occurredAt: options.clock.now().toISOString(),
        payload: {
          eventId: outbox.eventId,
          outboxId: outbox.id,
          status: outbox.status,
        },
        type: "event-dispatched",
      });
    }

    return;
  }

  if (message.kind === "dead-letter") {
    const now = options.clock.now();
    const { source } = message.payload;
    await recordNotificationRuntimeMetric({
      attributes: {
        status: "dead-lettered",
      },
      boundary: "queue",
      event: "poison_message",
    });

    if (source.kind === "notification-dispatch") {
      const failed = await recordNotificationDeadLetter(
        options.repository,
        source,
        message.payload.reason,
        message.payload.attempts,
        now
      );

      await safePublishRealtime(options.realtime, options.streamScope, {
        id: message.id,
        occurredAt: now.toISOString(),
        payload: {
          dispatchId: failed.id,
          providerKey: failed.providerKey,
          status: failed.status,
        },
        type: "notification-dead-lettered",
      });
      return;
    }

    if (source.kind === "event-outbox") {
      const failed = await recordEventDeadLetter(
        options.repository,
        source,
        message.payload.reason,
        message.payload.attempts,
        now
      );

      if (failed) {
        await safePublishRealtime(options.realtime, options.streamScope, {
          id: message.id,
          occurredAt: now.toISOString(),
          payload: {
            eventId: failed.eventId,
            outboxId: failed.id,
            status: failed.status,
          },
          type: "event-dead-lettered",
        });
      }
    }

    return;
  }

  const existing = await findDispatchById(
    options.repository,
    message.payload.dispatch.id
  );
  const dispatch = existing ?? message.payload.dispatch;

  if (dispatch.status === "delivered" || dispatch.status === "dead-lettered") {
    return;
  }

  const provider = getProvidersByKey(options.notificationProviders ?? []).get(
    message.payload.providerKey
  );

  if (!provider) {
    const failed = await recordNotificationFailure(
      options.repository,
      dispatch,
      `Notification provider "${message.payload.providerKey}" is not registered.`,
      options.retryPolicy,
      options.clock.now()
    );
    await recordFailedDispatchMetric(failed);

    await safePublishRealtime(options.realtime, options.streamScope, {
      id: message.id,
      occurredAt: options.clock.now().toISOString(),
      payload: {
        dispatchId: failed.id,
        providerKey: failed.providerKey,
        status: failed.status,
      },
      type: realtimeTypeForFailedDispatch(failed.status),
    });
    return;
  }

  let result: NotificationProviderDeliveryResult;

  try {
    result = await provider.deliver({
      dispatch,
      template: message.payload.template,
    });
  } catch (error) {
    const failed = await recordNotificationFailure(
      options.repository,
      dispatch,
      serializeError(error),
      options.retryPolicy,
      options.clock.now()
    );
    await recordFailedDispatchMetric(failed);
    throw error;
  }

  if (result.status === "failed") {
    const failed = await recordNotificationFailure(
      options.repository,
      dispatch,
      result.error ?? "Notification provider returned failed status.",
      options.retryPolicy,
      options.clock.now()
    );
    await recordFailedDispatchMetric(failed);

    await safePublishRealtime(options.realtime, options.streamScope, {
      id: message.id,
      occurredAt: options.clock.now().toISOString(),
      payload: {
        dispatchId: failed.id,
        providerKey: failed.providerKey,
        status: failed.status,
      },
      type: realtimeTypeForFailedDispatch(failed.status),
    });

    if (failed.status !== "dead-lettered") {
      throw new Error(failed.lastError);
    }

    return;
  }

  const saved = await Effect.runPromise(
    options.repository.saveDispatch(
      applyProviderResult(dispatch, result, options.clock.now())
    )
  );

  await safePublishRealtime(options.realtime, options.streamScope, {
    id: message.id,
    occurredAt: options.clock.now().toISOString(),
    payload: {
      dispatchId: saved.id,
      providerKey: saved.providerKey,
      status: saved.status,
    },
    type:
      saved.status === "delivered"
        ? "notification-delivered"
        : "notification-failed",
  });
};

export const processNotificationEventQueueBatch = async (
  batch: NotificationEventQueueBatch,
  options: NotificationEventQueueConsumerOptions
): Promise<void> => {
  for (const message of batch.messages) {
    try {
      await processNotificationEventQueueMessage(message.body, options);
      message.ack();
    } catch {
      message.retry();
    }
  }
};
