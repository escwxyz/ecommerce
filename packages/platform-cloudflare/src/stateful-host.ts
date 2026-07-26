import {
  KeyedActorCommandResultSchema,
  KeyedActorStateSnapshotSchema,
  KeyedActorTimerSchema,
} from "@ecommerce/core/stateful";
import type {
  KeyedActorCommand,
  KeyedActorCommandResult,
  KeyedActorReference,
  KeyedActorStateOwnership,
  KeyedActorStateSnapshot,
  KeyedActorTimer,
  KeyedActorCommandFailure,
} from "@ecommerce/core/stateful";
import { Effect, Option, Schema, Semaphore } from "effect";

import {
  CloudflareKeyedActorDispatchResponseSchema,
  CloudflareKeyedActorFailureResponseSchema,
  CloudflareKeyedActorRequestSchema,
  CloudflareKeyedActorStateLookupResponseSchema,
  CloudflareKeyedActorStatePutResponseSchema,
  CloudflareKeyedActorTimerCancelResponseSchema,
  CloudflareKeyedActorTimerLookupResponseSchema,
  CloudflareKeyedActorTimerResponseSchema,
} from "./stateful-protocol";
import type { CloudflareKeyedActorRequest } from "./stateful-protocol";

const COMMAND_RESULT_PREFIX = "actor-command-result:";
const STATE_PREFIX = "actor-state:";
const TIMER_PREFIX = "actor-timer:";

export interface CloudflareKeyedActorStorage {
  readonly delete: (key: string) => Promise<boolean>;
  readonly deleteAlarm: () => Promise<void>;
  readonly get: (key: string) => Promise<unknown>;
  readonly list: (options?: {
    readonly prefix?: string;
  }) => Promise<Map<string, unknown>>;
  readonly put: (key: string, value: unknown) => Promise<void>;
  readonly putMany: (entries: Record<string, unknown>) => Promise<void>;
  readonly setAlarm: (scheduledTime: number | Date) => Promise<void>;
}

/** Successful application result produced inside one serialized actor turn. */
export interface CloudflareKeyedActorCommandHandlerResult {
  readonly output: unknown;
  readonly state?: unknown;
}

/** Platform-owned command interpreter used by a concrete actor class. */
export type CloudflareKeyedActorCommandHandler = (
  command: KeyedActorCommand,
  currentState: Option.Option<KeyedActorStateSnapshot>
) => Effect.Effect<
  CloudflareKeyedActorCommandHandlerResult,
  KeyedActorCommandFailure
>;

export interface CloudflareKeyedActorDurableObjectHandlerOptions {
  readonly clock: {
    readonly now: () => Date;
  };
  readonly handle: CloudflareKeyedActorCommandHandler;
  /** Named Durable Object identity used to reject cross-actor messages. */
  readonly expectedActorName?: string;
  readonly ownership:
    | KeyedActorStateOwnership
    | ((command: KeyedActorCommand) => KeyedActorStateOwnership);
  readonly storage: CloudflareKeyedActorStorage;
}

export interface CloudflareKeyedActorDurableObjectHandler {
  readonly alarm: () => Promise<void>;
  readonly fetch: (request: Request) => Promise<Response>;
}

class CloudflareKeyedActorHostFailureError extends Error {
  readonly retryable: boolean;
  readonly status: number;

  constructor(message: string, retryable: boolean, status: number) {
    super(message);
    this.name = "CloudflareKeyedActorHostFailureError";
    this.retryable = retryable;
    this.status = status;
  }
}

const commandResultKey = (command: KeyedActorCommand): string =>
  `${COMMAND_RESULT_PREFIX}${encodeURIComponent(command.idempotencyKey)}`;

const stateKey = (stateName: string): string =>
  `${STATE_PREFIX}${encodeURIComponent(stateName)}`;

const timerKey = (timerId: string): string =>
  `${TIMER_PREFIX}${encodeURIComponent(timerId)}`;

const requestActor = (
  input: CloudflareKeyedActorRequest
): KeyedActorReference => {
  switch (input.operation) {
    case "dispatch": {
      return input.command.actor;
    }
    case "timer-schedule": {
      return input.timer.command.actor;
    }
    case "state-put": {
      return input.snapshot.actor;
    }
    case "state-get": {
      return input.actor;
    }
    case "timer-cancel":
    case "timer-get": {
      return input.reference.actor;
    }
    default: {
      throw new Error("Unsupported keyed actor operation.");
    }
  }
};

const storageEffect = <A>(
  operation: () => Promise<A>,
  message: string
): Effect.Effect<A, CloudflareKeyedActorHostFailureError> =>
  Effect.tryPromise({
    catch: () => new CloudflareKeyedActorHostFailureError(message, true, 500),
    try: operation,
  });

const decodeStored = <A, E>(
  schema: Schema.Codec<A, E, never, never>,
  input: unknown,
  message: string
): Effect.Effect<A, CloudflareKeyedActorHostFailureError> =>
  Schema.decodeUnknownEffect(schema)(input).pipe(
    Effect.mapError(
      () => new CloudflareKeyedActorHostFailureError(message, false, 500)
    )
  );

const jsonResponse = <A, E>(
  schema: Schema.Codec<A, E, never, never>,
  body: A,
  status = 200
): Effect.Effect<Response, CloudflareKeyedActorHostFailureError> =>
  Schema.decodeUnknownEffect(schema)(body).pipe(
    Effect.map((decoded) =>
      Response.json(decoded, {
        status,
      })
    ),
    Effect.mapError(
      () =>
        new CloudflareKeyedActorHostFailureError(
          "The keyed actor produced an invalid response.",
          false,
          500
        )
    )
  );

const failureResponse = (
  failure: CloudflareKeyedActorHostFailureError
): Response => {
  const body = Schema.decodeUnknownSync(
    CloudflareKeyedActorFailureResponseSchema
  )({
    message: failure.message,
    retryable: failure.retryable,
  });
  return Response.json(body, { status: failure.status });
};

/**
 * Creates the Effect-driven request/alarm host used by a Durable Object class.
 *
 * The returned host serializes every turn, validates all foreign and stored
 * values, and keeps command deduplication durable across object restarts.
 */
export const createKeyedActorDurableObjectHandler = ({
  clock,
  expectedActorName,
  handle,
  ownership,
  storage,
}: CloudflareKeyedActorDurableObjectHandlerOptions): CloudflareKeyedActorDurableObjectHandler => {
  const turnSemaphore = Semaphore.makeUnsafe(1);

  const serialize = <A>(operation: () => Promise<A>): Promise<A> =>
    Effect.runPromise(turnSemaphore.withPermit(Effect.promise(operation)));

  const getOwnership = (command: KeyedActorCommand): KeyedActorStateOwnership =>
    typeof ownership === "function" ? ownership(command) : ownership;

  const readState = (
    command: KeyedActorCommand
  ): Effect.Effect<
    Option.Option<KeyedActorStateSnapshot>,
    CloudflareKeyedActorHostFailureError
  > =>
    Effect.gen(function* readActorState() {
      const actorOwnership = getOwnership(command);
      const stored = yield* storageEffect(
        () => storage.get(stateKey(actorOwnership.stateName)),
        "Failed to read keyed actor state."
      );

      if (stored === undefined) {
        return Option.none();
      }

      const snapshot = yield* decodeStored(
        KeyedActorStateSnapshotSchema,
        stored,
        "Stored keyed actor state is invalid."
      );
      return Option.some(snapshot);
    });

  const dispatch = (
    command: KeyedActorCommand
  ): Effect.Effect<
    KeyedActorCommandResult,
    CloudflareKeyedActorHostFailureError
  > =>
    Effect.gen(function* dispatchActorCommand() {
      const resultStorageKey = commandResultKey(command);
      const storedResult = yield* storageEffect(
        () => storage.get(resultStorageKey),
        "Failed to read keyed actor command result."
      );

      if (storedResult !== undefined) {
        const duplicate = yield* decodeStored(
          KeyedActorCommandResultSchema,
          storedResult,
          "Stored keyed actor command result is invalid."
        );
        return {
          ...duplicate,
          duplicate: true,
        };
      }

      const actorOwnership = getOwnership(command);
      const currentState = yield* readState(command);
      const handled = yield* handle(command, currentState).pipe(
        Effect.mapError(
          (failure) =>
            new CloudflareKeyedActorHostFailureError(
              failure.message,
              failure.retryable,
              422
            )
        )
      );
      const previousState = Option.getOrUndefined(currentState);
      const nextStateVersion =
        handled.state === undefined
          ? (previousState?.stateVersion ?? 0)
          : (previousState?.stateVersion ?? 0) + 1;
      const completedAt = clock.now().toISOString();
      const result = yield* decodeStored(
        KeyedActorCommandResultSchema,
        {
          actor: command.actor,
          causationId: command.causationId,
          commandId: command.commandId,
          commandName: command.commandName,
          completedAt,
          correlationId: command.correlationId,
          duplicate: false,
          idempotencyKey: command.idempotencyKey,
          output: handled.output,
          schemaVersion: command.schemaVersion,
          stateVersion: nextStateVersion,
          subject: command.subject,
          workflowRunId: command.workflowRunId,
        },
        "The keyed actor command result is invalid."
      );

      if (handled.state !== undefined) {
        const snapshot = yield* decodeStored(
          KeyedActorStateSnapshotSchema,
          {
            actor: command.actor,
            ownership: actorOwnership,
            schemaVersion: command.schemaVersion,
            state: handled.state,
            stateVersion: nextStateVersion,
            updatedAt: completedAt,
          },
          "The keyed actor state snapshot is invalid."
        );
        yield* storageEffect(
          () =>
            storage.putMany({
              [resultStorageKey]: result,
              [stateKey(actorOwnership.stateName)]: snapshot,
            }),
          "Failed to persist keyed actor state and command result."
        );
        return result;
      }

      yield* storageEffect(
        () => storage.put(resultStorageKey, result),
        "Failed to persist keyed actor command result."
      );
      return result;
    });

  const listTimers = (): Effect.Effect<
    readonly KeyedActorTimer[],
    CloudflareKeyedActorHostFailureError
  > =>
    Effect.gen(function* listActorTimers() {
      const stored = yield* storageEffect(
        () => storage.list({ prefix: TIMER_PREFIX }),
        "Failed to list keyed actor timers."
      );
      const timers: KeyedActorTimer[] = [];

      for (const value of stored.values()) {
        timers.push(
          yield* decodeStored(
            KeyedActorTimerSchema,
            value,
            "Stored keyed actor timer is invalid."
          )
        );
      }

      return timers;
    });

  const synchronizeAlarm = (): Effect.Effect<
    void,
    CloudflareKeyedActorHostFailureError
  > =>
    Effect.gen(function* synchronizeActorAlarm() {
      const timers = yield* listTimers();
      let earliest: number | undefined;

      for (const timer of timers) {
        const dueAt = new Date(timer.dueAt).getTime();
        earliest = earliest === undefined ? dueAt : Math.min(earliest, dueAt);
      }

      if (earliest === undefined) {
        yield* storageEffect(
          () => storage.deleteAlarm(),
          "Failed to delete the keyed actor alarm."
        );
        return;
      }

      yield* storageEffect(
        () => storage.setAlarm(earliest),
        "Failed to schedule the keyed actor alarm."
      );
    });

  const executeRequest = (
    request: Request
  ): Effect.Effect<Response, CloudflareKeyedActorHostFailureError> =>
    Effect.gen(function* executeActorRequest() {
      if (request.method !== "POST") {
        return yield* Effect.fail(
          new CloudflareKeyedActorHostFailureError(
            "Method Not Allowed",
            false,
            405
          )
        );
      }

      const body = yield* storageEffect(
        () => request.json(),
        "The keyed actor request body is not valid JSON."
      ).pipe(
        Effect.mapError(
          () =>
            new CloudflareKeyedActorHostFailureError(
              "The keyed actor request body is not valid JSON.",
              false,
              400
            )
        )
      );
      const input = yield* Schema.decodeUnknownEffect(
        CloudflareKeyedActorRequestSchema
      )(body).pipe(
        Effect.mapError(
          () =>
            new CloudflareKeyedActorHostFailureError(
              "The keyed actor request does not satisfy its schema.",
              false,
              400
            )
        )
      );
      const actor = requestActor(input);

      if (
        expectedActorName !== undefined &&
        `${actor.type}:${actor.key}` !== expectedActorName
      ) {
        return yield* Effect.fail(
          new CloudflareKeyedActorHostFailureError(
            "The keyed actor request targets a different Durable Object.",
            false,
            409
          )
        );
      }

      switch (input.operation) {
        case "dispatch": {
          const result = yield* dispatch(input.command);
          return yield* jsonResponse(
            CloudflareKeyedActorDispatchResponseSchema,
            {
              operation: "dispatch-result",
              result,
            }
          );
        }
        case "timer-schedule": {
          yield* storageEffect(
            () => storage.put(timerKey(input.timer.timerId), input.timer),
            "Failed to persist keyed actor timer."
          );
          yield* synchronizeAlarm();
          return yield* jsonResponse(CloudflareKeyedActorTimerResponseSchema, {
            operation: "timer-result",
            timer: input.timer,
          });
        }
        case "timer-get": {
          const stored = yield* storageEffect(
            () => storage.get(timerKey(input.reference.timerId)),
            "Failed to read keyed actor timer."
          );
          const found =
            stored === undefined
              ? null
              : yield* decodeStored(
                  KeyedActorTimerSchema,
                  stored,
                  "Stored keyed actor timer is invalid."
                );
          return yield* jsonResponse(
            CloudflareKeyedActorTimerLookupResponseSchema,
            {
              operation: "timer-lookup-result",
              timer: found,
            }
          );
        }
        case "timer-cancel": {
          const cancelled = yield* storageEffect(
            () => storage.delete(timerKey(input.reference.timerId)),
            "Failed to cancel keyed actor timer."
          );
          yield* synchronizeAlarm();
          return yield* jsonResponse(
            CloudflareKeyedActorTimerCancelResponseSchema,
            {
              cancelled,
              operation: "timer-cancel-result",
            }
          );
        }
        case "state-get": {
          const stored = yield* storageEffect(
            () => storage.get(stateKey(input.stateName)),
            "Failed to read keyed actor state."
          );
          const snapshot =
            stored === undefined
              ? null
              : yield* decodeStored(
                  KeyedActorStateSnapshotSchema,
                  stored,
                  "Stored keyed actor state is invalid."
                );
          return yield* jsonResponse(
            CloudflareKeyedActorStateLookupResponseSchema,
            {
              operation: "state-lookup-result",
              snapshot,
            }
          );
        }
        case "state-put": {
          yield* storageEffect(
            () =>
              storage.put(
                stateKey(input.snapshot.ownership.stateName),
                input.snapshot
              ),
            "Failed to persist keyed actor state."
          );
          return yield* jsonResponse(
            CloudflareKeyedActorStatePutResponseSchema,
            {
              operation: "state-put-result",
            }
          );
        }
        default: {
          return yield* Effect.fail(
            new CloudflareKeyedActorHostFailureError(
              "Unsupported keyed actor operation.",
              false,
              400
            )
          );
        }
      }
    });

  const runRequest = async (request: Request): Promise<Response> => {
    try {
      return await Effect.runPromise(executeRequest(request));
    } catch (error) {
      return failureResponse(
        error instanceof CloudflareKeyedActorHostFailureError
          ? error
          : new CloudflareKeyedActorHostFailureError(
              "The keyed actor failed unexpectedly.",
              true,
              500
            )
      );
    }
  };

  const runAlarm = (): Promise<void> =>
    Effect.runPromise(
      Effect.gen(function* runActorAlarm() {
        const timers = yield* listTimers();
        const now = clock.now().getTime();

        for (const timer of timers) {
          if (new Date(timer.dueAt).getTime() > now) {
            continue;
          }

          yield* dispatch(timer.command);
          yield* storageEffect(
            () => storage.delete(timerKey(timer.timerId)),
            "Failed to delete a completed keyed actor timer."
          );
        }

        yield* synchronizeAlarm();
      })
    );

  return {
    alarm: () => serialize(runAlarm),
    fetch: (request) => serialize(() => runRequest(request)),
  };
};
