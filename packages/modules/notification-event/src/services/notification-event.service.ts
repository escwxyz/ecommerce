import type {
  ClockServiceShape,
  IdGeneratorServiceShape,
} from "@ecommerce/core";
import { createEventEnvelope } from "@ecommerce/core/events";
import { Context, Effect, Layer, Result } from "effect";
import { nanoid } from "nanoid";

import type {
  DispatchNotificationInput,
  EventDeadLetterRecord,
  EventDeliveryFailureInput,
  EventOutboxRecord,
  EventPublishInput,
  EventPublishResult,
  NotificationDispatchRecord,
  NotificationEventExpectedError,
  NotificationEventRepository,
  NotificationProvider,
  NotificationProviderDeliveryInput,
  NotificationProviderDeliveryResult,
  NotificationProviderRecord,
  NotificationTemplate,
  UpsertNotificationTemplateInput,
} from "../domain";
import {
  NotificationEventOutboxNotFound,
  NotificationEventRuntimeFailure,
  NotificationProviderUnavailable,
  NotificationTemplateNotFound,
} from "../domain";

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
  readonly dispatchNotification: (
    input: DispatchNotificationInput
  ) => Effect.Effect<
    NotificationDispatchRecord,
    NotificationEventExpectedError
  >;
  readonly listDeadLetters: Effect.Effect<
    readonly EventDeadLetterRecord[],
    NotificationEventExpectedError
  >;
  readonly listDispatches: Effect.Effect<
    readonly NotificationDispatchRecord[],
    NotificationEventExpectedError
  >;
  readonly publishEvent: (
    input: EventPublishInput
  ) => Effect.Effect<EventPublishResult, NotificationEventExpectedError>;
  readonly recordEventDeliveryFailure: (
    input: EventDeliveryFailureInput
  ) => Effect.Effect<EventOutboxRecord, NotificationEventExpectedError>;
  readonly registerNotificationProvider: (
    providerKey: string
  ) => Effect.Effect<
    NotificationProviderRecord,
    NotificationEventExpectedError
  >;
  readonly upsertNotificationTemplate: (
    input: UpsertNotificationTemplateInput
  ) => Effect.Effect<NotificationTemplate, NotificationEventExpectedError>;
}

export const NotificationEventService =
  Context.Service<NotificationEventServiceShape>(
    "@ecommerce/notification-event/NotificationEventService"
  );

export interface CreateNotificationEventServiceOptions {
  readonly clock?: ClockServiceShape;
  readonly idGenerator?: IdGeneratorServiceShape;
  readonly notificationProviders: readonly NotificationProvider[];
  readonly repository: NotificationEventRepository;
  readonly runtime?: NotificationEventRuntimeHooks;
}

export interface NotificationEventRuntimeHooks {
  readonly eventPublished?: (
    result: EventPublishResult
  ) => Promise<void> | void;
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
): Effect.Effect<NotificationProvider, NotificationProviderUnavailable> => {
  const provider = providers.get(providerKey);

  return provider
    ? Effect.succeed(provider)
    : Effect.fail(new NotificationProviderUnavailable({ providerKey }));
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
  notificationProviders,
  repository,
  runtime,
}: CreateNotificationEventServiceOptions): NotificationEventServiceShape => {
  const providers = createProviderMap(notificationProviders);

  return NotificationEventService.of({
    dispatchNotification: (input) =>
      Effect.gen(function* dispatchNotificationEffect() {
        const existing = yield* repository.findDispatchByIdempotencyKey(
          input.idempotencyKey
        );

        if (existing) {
          return existing;
        }

        const template = yield* repository.findTemplateByKey({
          channel: input.channel,
          templateKey: input.templateKey,
        });

        if (!template) {
          return yield* new NotificationTemplateNotFound({
            channel: input.channel,
            templateKey: input.templateKey,
          });
        }

        const provider = yield* requireProvider(
          providers,
          template.providerKey
        );
        const now = clock.now();
        const pendingDispatch: NotificationDispatchRecord = {
          attempts: 1,
          causationId: input.causationId,
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
          workflowRunId: input.workflowRunId,
        };

        yield* repository.saveDispatch(pendingDispatch);

        const deliveryExit = yield* Effect.result(
          Effect.tryPromise({
            catch: serializeError,
            try: () =>
              provider.deliver({
                dispatch: pendingDispatch,
                template,
              }),
          })
        );
        const deliveryResult = Result.match(deliveryExit, {
          onFailure: (error) => ({
            error,
            messageId: `${provider.key}:${pendingDispatch.id}:failed`,
            status: "failed" as const,
          }),
          onSuccess: (result) => result,
        });

        return yield* repository.saveDispatch(
          applyDeliveryResult(pendingDispatch, deliveryResult, clock.now())
        );
      }),
    listDeadLetters: repository.listDeadLetters,
    listDispatches: repository.listDispatches,
    publishEvent: (input) =>
      Effect.gen(function* publishEventEffect() {
        const { eventId, ...eventInput } = input;
        const emittedAt = clock.now();
        const envelope = createEventEnvelope({
          ...eventInput,
          emittedAt,
          id: eventId ?? createPrefixedId(idGenerator, EVENT_ID_PREFIX),
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
          outbox: yield* repository.saveOutbox(outbox),
        };

        if (runtime?.eventPublished) {
          yield* Effect.tryPromise({
            catch: (error) =>
              new NotificationEventRuntimeFailure({
                reason: serializeError(error),
              }),
            try: () => Promise.resolve(runtime.eventPublished?.(result)),
          });
        }

        return result;
      }),
    recordEventDeliveryFailure: ({ outboxId, reason, retryPolicy }) =>
      Effect.gen(function* recordEventDeliveryFailureEffect() {
        const outbox = yield* repository.findOutboxById(outboxId);

        if (!outbox) {
          return yield* new NotificationEventOutboxNotFound({ outboxId });
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

        yield* repository.saveOutbox(nextOutbox);

        if (exhausted) {
          yield* repository.saveDeadLetter({
            attempts,
            createdAt: now,
            eventId: outbox.eventId,
            id: `${outbox.id}:dead-letter`,
            outboxId: outbox.id,
            reason,
          });
        }

        return nextOutbox;
      }),
    registerNotificationProvider: (providerKey) =>
      Effect.gen(function* registerNotificationProviderEffect() {
        yield* requireProvider(providers, providerKey);
        const now = clock.now();
        return yield* repository.saveProviderRecord({
          createdAt: now,
          id: createPrefixedId(idGenerator, NOTIFICATION_PROVIDER_ID_PREFIX),
          isEnabled: true,
          providerKey,
          updatedAt: now,
        });
      }),
    upsertNotificationTemplate: (input) => repository.saveTemplate(input),
  });
};

export const createNotificationEventServiceLayer = (
  service: NotificationEventServiceShape
) => Layer.succeed(NotificationEventService, service);
