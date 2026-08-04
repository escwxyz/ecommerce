import { Effect, Layer, Option } from "effect";

import {
  keyedActorLayer,
  keyedActorStateStoreLayer,
  keyedActorTimerLayer,
} from "./index";
import type {
  KeyedActorCommand,
  KeyedActorCommandFailure,
  KeyedActorCommandResult,
  KeyedActorStateOwnership,
  KeyedActorStateSnapshot,
  KeyedActorTimer,
  KeyedActorTimerReference,
} from "./index";

/** Result returned by a deterministic in-memory actor command handler. */
export interface InMemoryKeyedActorCommandHandlerResult {
  readonly output: unknown;
  readonly state?: unknown;
}

/** Options for the deterministic actor test Layer. */
export interface InMemoryKeyedActorTestLayerOptions {
  readonly clock: {
    readonly now: () => Date;
  };
  readonly ownership: KeyedActorStateOwnership;
  readonly handle: (
    command: KeyedActorCommand,
    currentState: Option.Option<KeyedActorStateSnapshot>
  ) => Effect.Effect<
    InMemoryKeyedActorCommandHandlerResult,
    KeyedActorCommandFailure
  >;
}

const actorIdentity = (actor: KeyedActorCommand["actor"]): string =>
  `${actor.type}:${actor.key}`;

const commandIdentity = (command: KeyedActorCommand): string =>
  `${actorIdentity(command.actor)}:${command.idempotencyKey}`;

const stateIdentity = (
  actor: KeyedActorCommand["actor"],
  stateName: string
): string => `${actorIdentity(actor)}:${stateName}`;

const timerIdentity = (reference: KeyedActorTimerReference): string =>
  `${actorIdentity(reference.actor)}:${reference.timerId}`;

/**
 * Deterministic non-platform actor Layer used by contract and recovery tests.
 */
export const createInMemoryKeyedActorTestLayer = ({
  clock,
  handle,
  ownership,
}: InMemoryKeyedActorTestLayerOptions) => {
  const commandResults = new Map<string, KeyedActorCommandResult>();
  const stateSnapshots = new Map<string, KeyedActorStateSnapshot>();
  const timers = new Map<string, KeyedActorTimer>();

  return {
    layer: Layer.mergeAll(
      keyedActorLayer({
        dispatch: (command) =>
          Effect.gen(function* dispatch() {
            const resultKey = commandIdentity(command);
            const duplicate = commandResults.get(resultKey);

            if (duplicate) {
              return {
                ...duplicate,
                duplicate: true,
              };
            }

            const snapshotKey = stateIdentity(
              command.actor,
              ownership.stateName
            );
            const currentState = Option.fromNullishOr(
              stateSnapshots.get(snapshotKey)
            );
            const handled = yield* handle(command, currentState);
            const previousSnapshot = Option.getOrUndefined(currentState);
            const stateVersion = previousSnapshot?.stateVersion ?? 0;
            const nextStateVersion =
              handled.state === undefined ? stateVersion : stateVersion + 1;
            const result: KeyedActorCommandResult = {
              actor: command.actor,
              causationId: command.causationId,
              commandId: command.commandId,
              commandName: command.commandName,
              completedAt: clock.now().toISOString(),
              correlationId: command.correlationId,
              duplicate: false,
              idempotencyKey: command.idempotencyKey,
              output: handled.output,
              schemaVersion: command.schemaVersion,
              stateVersion: nextStateVersion,
              subject: command.subject,
              workflowRunId: command.workflowRunId,
            };

            if (handled.state !== undefined) {
              stateSnapshots.set(snapshotKey, {
                actor: command.actor,
                ownership,
                schemaVersion: command.schemaVersion,
                state: handled.state,
                stateVersion: nextStateVersion,
                updatedAt: result.completedAt,
              });
            }

            commandResults.set(resultKey, result);
            return result;
          }),
      }),
      keyedActorTimerLayer({
        cancel: (reference) =>
          Effect.sync(() => timers.delete(timerIdentity(reference))),
        get: (reference) =>
          Effect.succeed(
            Option.fromNullishOr(timers.get(timerIdentity(reference)))
          ),
        schedule: (timer) =>
          Effect.sync(() => {
            timers.set(
              timerIdentity({
                actor: timer.command.actor,
                timerId: timer.timerId,
              }),
              timer
            );
            return timer;
          }),
      }),
      keyedActorStateStoreLayer({
        get: ({ actor, stateName }) =>
          Effect.succeed(
            Option.fromNullishOr(
              stateSnapshots.get(stateIdentity(actor, stateName))
            )
          ),
        put: (snapshot) =>
          Effect.sync(() => {
            stateSnapshots.set(
              stateIdentity(snapshot.actor, snapshot.ownership.stateName),
              snapshot
            );
          }),
      })
    ),
  };
};
