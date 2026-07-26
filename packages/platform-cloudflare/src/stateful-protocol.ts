import {
  KeyedActorCommandResultSchema,
  KeyedActorCommandSchema,
  KeyedActorReferenceSchema,
  KeyedActorStateSnapshotSchema,
  KeyedActorTimerReferenceSchema,
  KeyedActorTimerSchema,
  KeyedActorTrimmedStringSchema,
} from "@ecommerce/core/stateful";
import { Schema } from "effect";

/** Versioned HTTP-shaped messages accepted by the keyed actor Durable Object. */
export const CloudflareKeyedActorRequestSchema = Schema.Union([
  Schema.Struct({
    command: KeyedActorCommandSchema,
    operation: Schema.Literal("dispatch"),
  }),
  Schema.Struct({
    operation: Schema.Literal("timer-schedule"),
    timer: KeyedActorTimerSchema,
  }),
  Schema.Struct({
    operation: Schema.Literal("timer-get"),
    reference: KeyedActorTimerReferenceSchema,
  }),
  Schema.Struct({
    operation: Schema.Literal("timer-cancel"),
    reference: KeyedActorTimerReferenceSchema,
  }),
  Schema.Struct({
    actor: KeyedActorReferenceSchema,
    operation: Schema.Literal("state-get"),
    stateName: KeyedActorTrimmedStringSchema,
  }),
  Schema.Struct({
    operation: Schema.Literal("state-put"),
    snapshot: KeyedActorStateSnapshotSchema,
  }),
]);

export type CloudflareKeyedActorRequest =
  typeof CloudflareKeyedActorRequestSchema.Type;

export const CloudflareKeyedActorDispatchResponseSchema = Schema.Struct({
  operation: Schema.Literal("dispatch-result"),
  result: KeyedActorCommandResultSchema,
});

export const CloudflareKeyedActorTimerResponseSchema = Schema.Struct({
  operation: Schema.Literal("timer-result"),
  timer: KeyedActorTimerSchema,
});

export const CloudflareKeyedActorTimerLookupResponseSchema = Schema.Struct({
  operation: Schema.Literal("timer-lookup-result"),
  timer: Schema.NullOr(KeyedActorTimerSchema),
});

export const CloudflareKeyedActorTimerCancelResponseSchema = Schema.Struct({
  cancelled: Schema.Boolean,
  operation: Schema.Literal("timer-cancel-result"),
});

export const CloudflareKeyedActorStateLookupResponseSchema = Schema.Struct({
  operation: Schema.Literal("state-lookup-result"),
  snapshot: Schema.NullOr(KeyedActorStateSnapshotSchema),
});

export const CloudflareKeyedActorStatePutResponseSchema = Schema.Struct({
  operation: Schema.Literal("state-put-result"),
});

/** Sanitized failure envelope; clients restore the operation-specific error. */
export const CloudflareKeyedActorFailureResponseSchema = Schema.Struct({
  message: KeyedActorTrimmedStringSchema,
  retryable: Schema.Boolean,
});
