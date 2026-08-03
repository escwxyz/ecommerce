import { correlationContextToHeaders } from "@ecommerce/core";
import {
  KeyedActorCommandFailure,
  KeyedActorStatePersistenceFailure,
  KeyedActorTimerFailure,
  keyedActorLayer,
  keyedActorStateStoreLayer,
  keyedActorTimerLayer,
} from "@ecommerce/core/stateful";
import type {
  KeyedActorCommand,
  KeyedActorReference,
  KeyedActorStateSnapshot,
  KeyedActorTimerReference,
} from "@ecommerce/core/stateful";
import { Effect, Layer, Option, Schema } from "effect";

import {
  CloudflareKeyedActorDispatchResponseSchema,
  CloudflareKeyedActorFailureResponseSchema,
  CloudflareKeyedActorStateLookupResponseSchema,
  CloudflareKeyedActorStatePutResponseSchema,
  CloudflareKeyedActorTimerCancelResponseSchema,
  CloudflareKeyedActorTimerLookupResponseSchema,
  CloudflareKeyedActorTimerResponseSchema,
} from "./stateful-protocol";

export {
  createKeyedActorDurableObjectHandler,
  type CloudflareKeyedActorCommandHandler,
  type CloudflareKeyedActorDurableObjectHandler,
  type CloudflareKeyedActorDurableObjectHandlerOptions,
  type CloudflareKeyedActorStorage,
} from "./stateful-host";
export {
  CloudflareKeyedActorDispatchResponseSchema,
  CloudflareKeyedActorFailureResponseSchema,
  CloudflareKeyedActorRequestSchema,
  CloudflareKeyedActorStateLookupResponseSchema,
  CloudflareKeyedActorStatePutResponseSchema,
  CloudflareKeyedActorTimerCancelResponseSchema,
  CloudflareKeyedActorTimerLookupResponseSchema,
  CloudflareKeyedActorTimerResponseSchema,
  type CloudflareKeyedActorRequest,
} from "./stateful-protocol";

export interface CloudflareKeyedActorStub {
  readonly fetch: (request: Request) => Promise<Response> | Response;
}

export interface CloudflareKeyedActorNamespace {
  readonly getByName: (name: string) => CloudflareKeyedActorStub;
}

/** Options for the Cloudflare implementation of all portable actor services. */
export interface CloudflareKeyedActorLayerOptions {
  readonly namespace: CloudflareKeyedActorNamespace;
}

class CloudflareKeyedActorTransportFailureError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = "CloudflareKeyedActorTransportFailureError";
    this.retryable = retryable;
  }
}

const actorName = (actor: KeyedActorReference): string =>
  `${actor.type}:${actor.key}`;

const readFailureMessage = async (response: Response): Promise<string> => {
  try {
    const body = await response.json();
    const decoded = Schema.decodeUnknownSync(
      CloudflareKeyedActorFailureResponseSchema
    )(body);
    return decoded.message;
  } catch {
    return `Keyed actor Durable Object rejected the request with HTTP ${response.status}.`;
  }
};

const actorRequestHeaders = (
  correlation:
    | {
        readonly correlationId: string;
        readonly requestId?: string;
        readonly traceId?: string;
      }
    | undefined
): HeadersInit => ({
  "content-type": "application/json",
  ...(correlation
    ? correlationContextToHeaders({
        operationId: correlation.correlationId,
        requestId: correlation.requestId ?? correlation.correlationId,
        traceId: correlation.traceId,
      })
    : {}),
});

const sendActorRequest = (
  namespace: CloudflareKeyedActorNamespace,
  actor: KeyedActorReference,
  body: unknown,
  correlation?: {
    readonly correlationId: string;
    readonly requestId?: string;
    readonly traceId?: string;
  }
): Effect.Effect<unknown, CloudflareKeyedActorTransportFailureError> =>
  Effect.tryPromise({
    catch: (cause) =>
      cause instanceof CloudflareKeyedActorTransportFailureError
        ? cause
        : new CloudflareKeyedActorTransportFailureError(
            "Keyed actor Durable Object request failed.",
            true
          ),
    try: async () => {
      const response = await namespace.getByName(actorName(actor)).fetch(
        new Request("https://keyed-actor.internal/", {
          body: JSON.stringify(body),
          headers: actorRequestHeaders(correlation),
          method: "POST",
        })
      );

      if (!response.ok) {
        throw new CloudflareKeyedActorTransportFailureError(
          await readFailureMessage(response),
          response.status >= 500
        );
      }

      return response.json();
    },
  });

const toCommandFailure = (
  command: KeyedActorCommand,
  cause: { readonly message?: string; readonly retryable?: boolean }
) =>
  new KeyedActorCommandFailure({
    actorKey: command.actor.key,
    actorType: command.actor.type,
    commandId: command.commandId,
    commandName: command.commandName,
    message: cause.message ?? "Invalid keyed actor command response.",
    retryable: cause.retryable ?? false,
  });

const toTimerFailure = (
  reference: KeyedActorTimerReference,
  cause: { readonly message?: string; readonly retryable?: boolean }
) =>
  new KeyedActorTimerFailure({
    actorKey: reference.actor.key,
    actorType: reference.actor.type,
    message: cause.message ?? "Invalid keyed actor timer response.",
    retryable: cause.retryable ?? false,
    timerId: reference.timerId,
  });

const toStateFailure = (
  actor: KeyedActorReference,
  stateName: string,
  cause: { readonly message?: string; readonly retryable?: boolean }
) =>
  new KeyedActorStatePersistenceFailure({
    actorKey: actor.key,
    actorType: actor.type,
    message: cause.message ?? "Invalid keyed actor state response.",
    retryable: cause.retryable ?? false,
    stateName,
  });

/**
 * Implements command, timer, and state services over a Durable Object namespace.
 *
 * Every response is decoded before it enters runtime-neutral services. Foreign
 * fetch and parse failures are translated to the corresponding core error.
 */
export const createCloudflareKeyedActorLayer = ({
  namespace,
}: CloudflareKeyedActorLayerOptions) =>
  Layer.mergeAll(
    keyedActorLayer({
      dispatch: (command) =>
        Effect.gen(function* dispatchCloudflareActorCommand() {
          const body = yield* sendActorRequest(
            namespace,
            command.actor,
            {
              command,
              operation: "dispatch",
            },
            {
              correlationId: command.correlationId,
              traceId: command.traceId,
            }
          ).pipe(Effect.mapError((cause) => toCommandFailure(command, cause)));
          const response = yield* Schema.decodeUnknownEffect(
            CloudflareKeyedActorDispatchResponseSchema
          )(body).pipe(
            Effect.mapError((cause) =>
              toCommandFailure(command, {
                message: String(cause),
                retryable: false,
              })
            )
          );
          return response.result;
        }),
    }),
    keyedActorTimerLayer({
      cancel: (reference) =>
        Effect.gen(function* cancelCloudflareActorTimer() {
          const body = yield* sendActorRequest(namespace, reference.actor, {
            operation: "timer-cancel",
            reference,
          }).pipe(Effect.mapError((cause) => toTimerFailure(reference, cause)));
          const response = yield* Schema.decodeUnknownEffect(
            CloudflareKeyedActorTimerCancelResponseSchema
          )(body).pipe(
            Effect.mapError((cause) =>
              toTimerFailure(reference, {
                message: String(cause),
                retryable: false,
              })
            )
          );
          return response.cancelled;
        }),
      get: (reference) =>
        Effect.gen(function* getCloudflareActorTimer() {
          const body = yield* sendActorRequest(namespace, reference.actor, {
            operation: "timer-get",
            reference,
          }).pipe(Effect.mapError((cause) => toTimerFailure(reference, cause)));
          const response = yield* Schema.decodeUnknownEffect(
            CloudflareKeyedActorTimerLookupResponseSchema
          )(body).pipe(
            Effect.mapError((cause) =>
              toTimerFailure(reference, {
                message: String(cause),
                retryable: false,
              })
            )
          );
          return Option.fromNullishOr(response.timer);
        }),
      schedule: (timer) => {
        const reference = {
          actor: timer.command.actor,
          timerId: timer.timerId,
        };
        return Effect.gen(function* scheduleCloudflareActorTimer() {
          const body = yield* sendActorRequest(
            namespace,
            timer.command.actor,
            {
              operation: "timer-schedule",
              timer,
            },
            {
              correlationId: timer.command.correlationId,
              traceId: timer.command.traceId,
            }
          ).pipe(Effect.mapError((cause) => toTimerFailure(reference, cause)));
          const response = yield* Schema.decodeUnknownEffect(
            CloudflareKeyedActorTimerResponseSchema
          )(body).pipe(
            Effect.mapError((cause) =>
              toTimerFailure(reference, {
                message: String(cause),
                retryable: false,
              })
            )
          );
          return response.timer;
        });
      },
    }),
    keyedActorStateStoreLayer({
      get: ({ actor, stateName }) =>
        Effect.gen(function* getCloudflareActorState() {
          const body = yield* sendActorRequest(namespace, actor, {
            actor,
            operation: "state-get",
            stateName,
          }).pipe(
            Effect.mapError((cause) => toStateFailure(actor, stateName, cause))
          );
          const response = yield* Schema.decodeUnknownEffect(
            CloudflareKeyedActorStateLookupResponseSchema
          )(body).pipe(
            Effect.mapError((cause) =>
              toStateFailure(actor, stateName, {
                message: String(cause),
                retryable: false,
              })
            )
          );
          return Option.fromNullishOr(response.snapshot);
        }),
      put: (snapshot: KeyedActorStateSnapshot) =>
        Effect.gen(function* putCloudflareActorState() {
          const { stateName } = snapshot.ownership;
          const body = yield* sendActorRequest(namespace, snapshot.actor, {
            operation: "state-put",
            snapshot,
          }).pipe(
            Effect.mapError((cause) =>
              toStateFailure(snapshot.actor, stateName, cause)
            )
          );
          yield* Schema.decodeUnknownEffect(
            CloudflareKeyedActorStatePutResponseSchema
          )(body).pipe(
            Effect.mapError((cause) =>
              toStateFailure(snapshot.actor, stateName, {
                message: String(cause),
                retryable: false,
              })
            )
          );
        }),
    })
  );
