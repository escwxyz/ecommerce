import { Context, Layer } from "effect";
import type { Effect, Option } from "effect";

import type { KeyedActorCommandFailure } from "./keyed-actor-command-failure";
import type { KeyedActorStatePersistenceFailure } from "./keyed-actor-state-persistence-failure";
import type { KeyedActorTimerFailure } from "./keyed-actor-timer-failure";
import type {
  KeyedActorCommand,
  KeyedActorCommandResult,
  KeyedActorReference,
  KeyedActorStateSnapshot,
  KeyedActorTimer,
  KeyedActorTimerReference,
} from "./schemas";

export { KeyedActorCommandFailure } from "./keyed-actor-command-failure";
export { KeyedActorStatePersistenceFailure } from "./keyed-actor-state-persistence-failure";
export { KeyedActorTimerFailure } from "./keyed-actor-timer-failure";
export {
  KeyedActorCommandResultSchema,
  KeyedActorCommandSchema,
  KeyedActorIsoDateTimeStringSchema,
  KeyedActorKeySchema,
  KeyedActorReferenceSchema,
  KeyedActorSchemaVersionSchema,
  KeyedActorStateClassificationSchema,
  KeyedActorStateOwnerSchema,
  KeyedActorStateOwnershipSchema,
  KeyedActorStateRecoverySourceSchema,
  KeyedActorStateSnapshotSchema,
  KeyedActorSubjectSchema,
  KeyedActorTimerReferenceSchema,
  KeyedActorTimerSchema,
  KeyedActorTrimmedStringSchema,
  KeyedActorTypeSchema,
  type KeyedActorCommand,
  type KeyedActorCommandResult,
  type KeyedActorReference,
  type KeyedActorStateOwnership,
  type KeyedActorStateSnapshot,
  type KeyedActorTimer,
  type KeyedActorTimerReference,
} from "./schemas";

/**
 * Runtime-neutral command gateway for serialized mutation of one actor key.
 *
 * Platform adapters must decode commands before dispatch and preserve
 * idempotency by actor key plus command idempotency key.
 */
export interface KeyedActorService {
  readonly dispatch: (
    command: KeyedActorCommand
  ) => Effect.Effect<KeyedActorCommandResult, KeyedActorCommandFailure>;
}

/** Runtime-neutral durable timer service scoped by actor identity. */
export interface KeyedActorTimerService {
  readonly cancel: (
    reference: KeyedActorTimerReference
  ) => Effect.Effect<boolean, KeyedActorTimerFailure>;
  readonly get: (
    reference: KeyedActorTimerReference
  ) => Effect.Effect<Option.Option<KeyedActorTimer>, KeyedActorTimerFailure>;
  readonly schedule: (
    timer: KeyedActorTimer
  ) => Effect.Effect<KeyedActorTimer, KeyedActorTimerFailure>;
}

/**
 * Runtime-neutral actor-local state persistence service.
 *
 * Ownership descriptors keep relational authority explicit even when a
 * platform adapter stores coordination, cache, or workflow state locally.
 */
export interface KeyedActorStateStoreService {
  readonly get: (input: {
    readonly actor: KeyedActorReference;
    readonly stateName: string;
  }) => Effect.Effect<
    Option.Option<KeyedActorStateSnapshot>,
    KeyedActorStatePersistenceFailure
  >;
  readonly put: (
    snapshot: KeyedActorStateSnapshot
  ) => Effect.Effect<void, KeyedActorStatePersistenceFailure>;
}

/** Effect service tag for platform-neutral keyed actor implementations. */
export const KeyedActorService = Context.Service<KeyedActorService>(
  "@ecommerce/core/KeyedActorService"
);

/** Effect service tag for platform-neutral actor timer implementations. */
export const KeyedActorTimerService = Context.Service<KeyedActorTimerService>(
  "@ecommerce/core/KeyedActorTimerService"
);

/** Effect service tag for platform-neutral actor state persistence. */
export const KeyedActorStateStoreService =
  Context.Service<KeyedActorStateStoreService>(
    "@ecommerce/core/KeyedActorStateStoreService"
  );

/** Creates a Layer for a platform-neutral keyed actor implementation. */
export const keyedActorLayer = (service: KeyedActorService) =>
  Layer.succeed(KeyedActorService, service);

/** Creates a Layer for a platform-neutral actor timer implementation. */
export const keyedActorTimerLayer = (service: KeyedActorTimerService) =>
  Layer.succeed(KeyedActorTimerService, service);

/** Creates a Layer for a platform-neutral actor state-store implementation. */
export const keyedActorStateStoreLayer = (
  service: KeyedActorStateStoreService
) => Layer.succeed(KeyedActorStateStoreService, service);

/**
 * Legacy Promise coordinator subject retained until task 9.6 replaces the
 * Cloudflare coordinator adapter with the Effect-native keyed actor Layer.
 *
 * @deprecated Use `KeyedActorCommandSchema` and `KeyedActorService`.
 */
export interface StatefulCoordinationSubject {
  readonly type: string;
  readonly id: string;
}

/** @deprecated Use metadata on `KeyedActorCommandSchema`. */
export interface StatefulCoordinationMetadata {
  readonly correlationId: string;
  readonly idempotencyKey: string;
  readonly causationId?: string;
  readonly subject?: StatefulCoordinationSubject;
  readonly traceId?: string;
  readonly workflowRunId?: string;
}

/** @deprecated Use `KeyedActorCommand`. */
export interface StatefulCoordinationRequest<
  Input = unknown,
> extends StatefulCoordinationMetadata {
  readonly coordinatorKey: string;
  readonly operationName: string;
  readonly payload: Input;
}

/** @deprecated Use `KeyedActorCommandResult`. */
export interface StatefulCoordinationResult<
  Output = unknown,
> extends StatefulCoordinationMetadata {
  readonly coordinatorKey: string;
  readonly operationName: string;
  readonly output: Output;
  readonly duplicate: boolean;
  readonly coordinatedAt: Date;
}

/** @deprecated Use the Effect-native `KeyedActorService`. */
export interface StatefulCoordinator {
  coordinate<Input = unknown, Output = unknown>(
    request: StatefulCoordinationRequest<Input>
  ): Promise<StatefulCoordinationResult<Output>>;
}

/** @deprecated Decode commands with `KeyedActorCommandSchema`. */
export const defineStatefulCoordinationRequest = <Input = unknown>(
  request: StatefulCoordinationRequest<Input>
): StatefulCoordinationRequest<Input> => request;
