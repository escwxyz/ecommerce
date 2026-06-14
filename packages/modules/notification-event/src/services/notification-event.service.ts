import type {
  ClockServiceShape,
  IdGeneratorServiceShape,
} from "@ecommerce/core";
import { createEventEnvelope } from "@ecommerce/core/events";
import { Context, Layer } from "effect";
import { nanoid } from "nanoid";

import type {
  DispatchNotificationInput,
  EventDeadLetterRecord,
  EventDeliveryFailureInput,
  EventOutboxRecord,
  EventPublishInput,
  EventPublishResult,
  NotificationDispatchRecord,
  NotificationEventRepository,
  NotificationProvider,
  NotificationProviderDeliveryInput,
  NotificationProviderDeliveryResult,
  NotificationProviderRecord,
  NotificationTemplate,
  UpsertNotificationTemplateInput,
} from "../domain";
import { defaultNotificationEventRepository } from "../repositories";

export const NOTIFICATION_DISPATCH_REQUESTED_EVENT =
  "notification.dispatch-requested" as const;
export const NOTIFICATION_DISPATCH_DELIVERED_EVENT =
  "notification.dispatch-delivered" as const;
export const EVENT_OUTBOX_DEAD_LETTERED_EVENT =
  "event.outbox-dead-lettered" as const;

const EVENT_ID_PREFIX = "evt_" as const;
const NOTIFICATION_DISPATCH_ID_PREFIX = "ndsp_" as const;
const NOTIFICATION_PROVIDER_ID_PREFIX = "nprov_" as const;

export interface NotificationEventServiceShape {
  dispatchNotification(
    input: DispatchNotificationInput
  ): Promise<NotificationDispatchRecord>;
  listDeadLetters(): Promise<readonly EventDeadLetterRecord[]>;
  listDispatches(): Promise<readonly NotificationDispatchRecord[]>;
  publishEvent(input: EventPublishInput): Promise<EventPublishResult>;
  recordEventDeliveryFailure(
    input: EventDeliveryFailureInput
  ): Promise<EventOutboxRecord>;
  registerNotificationProvider(
    providerKey: string
  ): Promise<NotificationProviderRecord>;
  upsertNotificationTemplate(
    input: UpsertNotificationTemplateInput
  ): Promise<NotificationTemplate>;
}

export const NotificationEventService =
  Context.Service<NotificationEventServiceShape>(
    "@ecommerce/notification-event/NotificationEventService"
  );

export interface CreateNotificationEventServiceOptions {
  readonly clock?: ClockServiceShape;
  readonly idGenerator?: IdGeneratorServiceShape;
  readonly notificationProviders?: readonly NotificationProvider[];
  readonly repository?: NotificationEventRepository;
  readonly runtime?: NotificationEventRuntimeHooks;
}

export interface NotificationEventRuntimeHooks {
  eventPublished?(result: EventPublishResult): Promise<void>;
}

export interface FakeNotificationProvider extends NotificationProvider {
  readonly deliveries: NotificationProviderDeliveryInput[];
}

const createDefaultClock = (): ClockServiceShape => ({
  now: () => new Date(),
});

const createDefaultIdGenerator = (): IdGeneratorServiceShape => ({
  nextId: () => nanoid(),
});

const createPrefixedId = (
  idGenerator: IdGeneratorServiceShape,
  prefix: string
): string => {
  const nextId = idGenerator.nextId();
  return nextId.startsWith(prefix) ? nextId : `${prefix}${nextId}`;
};

const serializeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const createFakeNotificationProvider = (
  key: string
): FakeNotificationProvider => {
  const deliveries: NotificationProviderDeliveryInput[] = [];

  return {
    deliveries,
    key,
    deliver: (input) => {
      deliveries.push(input);
      return Promise.resolve({
        deliveredAt: input.dispatch.updatedAt,
        messageId: `${key}:${input.dispatch.id}`,
        status: "delivered",
      });
    },
  };
};

const createProviderMap = (
  providers: readonly NotificationProvider[]
): ReadonlyMap<string, NotificationProvider> =>
  new Map(providers.map((provider) => [provider.key, provider]));

const requireProvider = (
  providers: ReadonlyMap<string, NotificationProvider>,
  providerKey: string
): NotificationProvider => {
  const provider = providers.get(providerKey);

  if (!provider) {
    throw new Error(
      `Notification provider "${providerKey}" is not registered.`
    );
  }

  return provider;
};

const getNextAttemptAvailableAt = (
  now: Date,
  attempts: number,
  backoffSeconds?: readonly number[]
): Date => {
  const delaySeconds = backoffSeconds?.[attempts - 1] ?? 0;
  return new Date(now.getTime() + delaySeconds * 1000);
};

const applyDeliveryResult = (
  dispatch: NotificationDispatchRecord,
  result: NotificationProviderDeliveryResult,
  now: Date
): NotificationDispatchRecord => ({
  ...dispatch,
  deliveredAt:
    result.status === "delivered" ? (result.deliveredAt ?? now) : undefined,
  lastError: result.error,
  providerMessageId: result.messageId,
  status: result.status,
  updatedAt: now,
});

export const createNotificationEventService = ({
  clock = createDefaultClock(),
  idGenerator = createDefaultIdGenerator(),
  notificationProviders = [],
  repository = defaultNotificationEventRepository,
  runtime,
}: CreateNotificationEventServiceOptions = {}): NotificationEventServiceShape => {
  const providers = createProviderMap(notificationProviders);

  return {
    dispatchNotification: async (input) => {
      const existing = await repository.findDispatchByIdempotencyKey(
        input.idempotencyKey
      );

      if (existing) {
        return existing;
      }

      const template = await repository.findTemplateByKey({
        channel: input.channel,
        templateKey: input.templateKey,
      });

      if (!template) {
        throw new Error(
          `Notification template "${input.templateKey}" for channel "${input.channel}" was not found.`
        );
      }

      const provider = requireProvider(providers, template.providerKey);
      const now = clock.now();
      const pendingDispatch: NotificationDispatchRecord = {
        attempts: 1,
        channel: input.channel,
        correlationId: input.correlationId,
        createdAt: now,
        id: createPrefixedId(idGenerator, NOTIFICATION_DISPATCH_ID_PREFIX),
        idempotencyKey: input.idempotencyKey,
        payload: input.payload,
        providerKey: template.providerKey,
        recipient: input.recipient,
        status: "pending",
        templateId: template.id,
        updatedAt: now,
        causationId: input.causationId,
        workflowRunId: input.workflowRunId,
      };

      await repository.saveDispatch(pendingDispatch);

      try {
        const result = await provider.deliver({
          dispatch: pendingDispatch,
          template,
        });

        return repository.saveDispatch(
          applyDeliveryResult(pendingDispatch, result, clock.now())
        );
      } catch (error) {
        return repository.saveDispatch({
          ...pendingDispatch,
          lastError: serializeError(error),
          status: "failed",
          updatedAt: clock.now(),
        });
      }
    },
    listDeadLetters: () => repository.listDeadLetters(),
    listDispatches: () => repository.listDispatches(),
    publishEvent: async (input) => {
      const emittedAt = clock.now();
      const envelope = createEventEnvelope({
        ...input,
        emittedAt,
        id: createPrefixedId(idGenerator, EVENT_ID_PREFIX),
      });
      const outbox: EventOutboxRecord = {
        attempts: 0,
        availableAt: emittedAt,
        createdAt: emittedAt,
        envelope,
        eventId: envelope.id,
        id: envelope.id,
        status: "pending",
        updatedAt: emittedAt,
      };

      const result = {
        envelope,
        outbox: await repository.saveOutbox(outbox),
      };

      await runtime?.eventPublished?.(result);

      return result;
    },
    recordEventDeliveryFailure: async ({ outboxId, reason, retryPolicy }) => {
      const outbox = await repository.findOutboxById(outboxId);

      if (!outbox) {
        throw new Error(`Event outbox record "${outboxId}" was not found.`);
      }

      const now = clock.now();
      const attempts = outbox.attempts + 1;
      const exhausted = attempts >= retryPolicy.maxAttempts;
      const nextOutbox: EventOutboxRecord = {
        ...outbox,
        attempts,
        availableAt: exhausted
          ? outbox.availableAt
          : getNextAttemptAvailableAt(
              now,
              attempts,
              retryPolicy.backoffSeconds
            ),
        lastError: reason,
        status: exhausted ? "dead-lettered" : "retrying",
        updatedAt: now,
      };

      await repository.saveOutbox(nextOutbox);

      if (exhausted) {
        await repository.saveDeadLetter({
          attempts,
          createdAt: now,
          eventId: outbox.eventId,
          id: `${outbox.id}:dead-letter`,
          outboxId: outbox.id,
          reason,
        });
      }

      return nextOutbox;
    },
    registerNotificationProvider: async (providerKey) => {
      await Promise.resolve();
      requireProvider(providers, providerKey);
      const now = clock.now();
      return repository.saveProviderRecord({
        createdAt: now,
        id: createPrefixedId(idGenerator, NOTIFICATION_PROVIDER_ID_PREFIX),
        isEnabled: true,
        providerKey,
        updatedAt: now,
      });
    },
    upsertNotificationTemplate: (input) => repository.saveTemplate(input),
  };
};

export const defaultNotificationEventService = createNotificationEventService();

export const createNotificationEventServiceLayer = (
  options: CreateNotificationEventServiceOptions
) =>
  Layer.succeed(
    NotificationEventService,
    createNotificationEventService(options)
  );
