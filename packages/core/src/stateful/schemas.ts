import { Schema } from "effect";

const isCanonicalIsoDateTime = (value: string): boolean => {
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
};

const isPositiveInteger = (value: number): boolean =>
  Number.isInteger(value) && value > 0;

export const KeyedActorTrimmedStringSchema = Schema.NonEmptyString.pipe(
  Schema.check(Schema.makeFilter((value: string) => value.trim() === value))
);

export const KeyedActorSchemaVersionSchema = Schema.Number.pipe(
  Schema.check(Schema.makeFilter(isPositiveInteger))
);

export const KeyedActorIsoDateTimeStringSchema =
  KeyedActorTrimmedStringSchema.pipe(
    Schema.check(Schema.makeFilter(isCanonicalIsoDateTime))
  );

export const KeyedActorTypeSchema = KeyedActorTrimmedStringSchema.pipe(
  Schema.brand("KeyedActorType")
);

export const KeyedActorKeySchema = KeyedActorTrimmedStringSchema.pipe(
  Schema.brand("KeyedActorKey")
);

export const KeyedActorReferenceSchema = Schema.Struct({
  key: KeyedActorKeySchema,
  type: KeyedActorTypeSchema,
});

export type KeyedActorReference = typeof KeyedActorReferenceSchema.Type;

export const KeyedActorSubjectSchema = Schema.Struct({
  id: KeyedActorTrimmedStringSchema,
  type: KeyedActorTrimmedStringSchema,
});

export const KeyedActorCommandSchema = Schema.Struct({
  actor: KeyedActorReferenceSchema,
  causationId: Schema.optional(KeyedActorTrimmedStringSchema),
  commandId: KeyedActorTrimmedStringSchema,
  commandName: KeyedActorTrimmedStringSchema,
  correlationId: KeyedActorTrimmedStringSchema,
  idempotencyKey: KeyedActorTrimmedStringSchema,
  issuedAt: KeyedActorIsoDateTimeStringSchema,
  payload: Schema.Unknown,
  schemaVersion: KeyedActorSchemaVersionSchema,
  subject: Schema.optional(KeyedActorSubjectSchema),
  traceId: Schema.optional(KeyedActorTrimmedStringSchema),
  workflowRunId: Schema.optional(KeyedActorTrimmedStringSchema),
});

export type KeyedActorCommand = typeof KeyedActorCommandSchema.Type;

export const KeyedActorCommandResultSchema = Schema.Struct({
  actor: KeyedActorReferenceSchema,
  causationId: Schema.optional(KeyedActorTrimmedStringSchema),
  commandId: KeyedActorTrimmedStringSchema,
  commandName: KeyedActorTrimmedStringSchema,
  completedAt: KeyedActorIsoDateTimeStringSchema,
  correlationId: KeyedActorTrimmedStringSchema,
  duplicate: Schema.Boolean,
  idempotencyKey: KeyedActorTrimmedStringSchema,
  output: Schema.Unknown,
  schemaVersion: KeyedActorSchemaVersionSchema,
  stateVersion: Schema.Number.pipe(
    Schema.check(
      Schema.makeFilter(
        (value: number): boolean => Number.isInteger(value) && value >= 0
      )
    )
  ),
  subject: Schema.optional(KeyedActorSubjectSchema),
  traceId: Schema.optional(KeyedActorTrimmedStringSchema),
  workflowRunId: Schema.optional(KeyedActorTrimmedStringSchema),
});

export type KeyedActorCommandResult = typeof KeyedActorCommandResultSchema.Type;

export const KeyedActorTimerSchema = Schema.Struct({
  command: KeyedActorCommandSchema,
  dueAt: KeyedActorIsoDateTimeStringSchema,
  scheduledAt: KeyedActorIsoDateTimeStringSchema,
  schemaVersion: KeyedActorSchemaVersionSchema,
  timerId: KeyedActorTrimmedStringSchema,
  timerName: KeyedActorTrimmedStringSchema,
});

export type KeyedActorTimer = typeof KeyedActorTimerSchema.Type;

export const KeyedActorStateClassificationSchema = Schema.Literals([
  "cache",
  "coordination",
  "relational-record",
  "workflow",
]);

export const KeyedActorStateOwnerSchema = Schema.Literals([
  "actor-local",
  "postgresql",
]);

export const KeyedActorStateRecoverySourceSchema = Schema.Literals([
  "actor-local",
  "postgresql",
  "recomputed",
  "workflow-history",
]);

const KeyedActorStateOwnershipFieldsSchema = Schema.Struct({
  acceptedDesignReference: Schema.optional(KeyedActorTrimmedStringSchema),
  actorType: KeyedActorTypeSchema,
  classification: KeyedActorStateClassificationSchema,
  owner: KeyedActorStateOwnerSchema,
  recoverySource: KeyedActorStateRecoverySourceSchema,
  schemaVersion: KeyedActorSchemaVersionSchema,
  stateName: KeyedActorTrimmedStringSchema,
});

/**
 * Declares the authority and recovery source for actor-visible state.
 *
 * PostgreSQL remains the relational system of record by default. Assigning a
 * relational record to actor-local storage requires an accepted design
 * reference so a runtime adapter cannot silently create a second authority.
 */
export const KeyedActorStateOwnershipSchema =
  KeyedActorStateOwnershipFieldsSchema.pipe(
    Schema.check(
      Schema.makeFilter(
        (
          ownership: typeof KeyedActorStateOwnershipFieldsSchema.Type
        ): boolean =>
          ownership.classification !== "relational-record" ||
          ownership.owner !== "actor-local" ||
          ownership.acceptedDesignReference !== undefined
      )
    )
  );

export type KeyedActorStateOwnership =
  typeof KeyedActorStateOwnershipSchema.Type;

const KeyedActorStateSnapshotFieldsSchema = Schema.Struct({
  actor: KeyedActorReferenceSchema,
  ownership: KeyedActorStateOwnershipSchema,
  schemaVersion: KeyedActorSchemaVersionSchema,
  state: Schema.Unknown,
  stateVersion: KeyedActorCommandResultSchema.fields.stateVersion,
  updatedAt: KeyedActorIsoDateTimeStringSchema,
});

export const KeyedActorStateSnapshotSchema =
  KeyedActorStateSnapshotFieldsSchema.pipe(
    Schema.check(
      Schema.makeFilter(
        (snapshot: typeof KeyedActorStateSnapshotFieldsSchema.Type): boolean =>
          snapshot.actor.type === snapshot.ownership.actorType
      )
    )
  );

export type KeyedActorStateSnapshot = typeof KeyedActorStateSnapshotSchema.Type;

export const KeyedActorTimerReferenceSchema = Schema.Struct({
  actor: KeyedActorReferenceSchema,
  timerId: KeyedActorTrimmedStringSchema,
});

export type KeyedActorTimerReference =
  typeof KeyedActorTimerReferenceSchema.Type;
