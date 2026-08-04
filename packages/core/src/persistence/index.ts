/* eslint-disable max-classes-per-file -- persistence errors are one shared schema-backed vocabulary */

import { Context, Layer, Schema } from "effect";
import type { Effect } from "effect";

import type { CommerceEventEnvelope } from "../events/index";

/** Persistence operations used by shared error contracts and telemetry. */
export type PersistenceOperation =
  | "read"
  | "write"
  | "delete"
  | "transaction"
  | "migration"
  | "outbox";

/** Runtime-neutral marker for module-owned repository service contracts. */
export interface CommerceRepository {
  readonly moduleName: string;
  readonly repositoryName: string;
}

/** Expected failure emitted when a repository adapter is unavailable. */
export class RepositoryUnavailable extends Schema.TaggedErrorClass<RepositoryUnavailable>()(
  "RepositoryUnavailable",
  {
    adapter: Schema.NonEmptyString,
    operation: Schema.Literals([
      "read",
      "write",
      "delete",
      "transaction",
      "migration",
      "outbox",
    ]),
    repository: Schema.NonEmptyString,
  }
) {}

/** Expected failure emitted when persistence detects a uniqueness/version conflict. */
export class RepositoryConflict extends Schema.TaggedErrorClass<RepositoryConflict>()(
  "RepositoryConflict",
  {
    entity: Schema.NonEmptyString,
    operation: Schema.Literals(["write", "delete"]),
    repository: Schema.NonEmptyString,
  }
) {}

/** Expected failure emitted when adapter data cannot decode into storage/domain schemas. */
export class RepositoryDecodeFailure extends Schema.TaggedErrorClass<RepositoryDecodeFailure>()(
  "RepositoryDecodeFailure",
  {
    entity: Schema.NonEmptyString,
    operation: Schema.Literals(["read", "write"]),
    repository: Schema.NonEmptyString,
  }
) {}

/** Shared repository failure union for adapter-owned translation boundaries. */
export type RepositoryFailure =
  | RepositoryConflict
  | RepositoryDecodeFailure
  | RepositoryUnavailable;

/** Transaction isolation levels exposed without leaking adapter handles. */
export type TransactionIsolationLevel =
  | "read_committed"
  | "repeatable_read"
  | "serializable";

/** Request for a local transaction owned by an application service. */
export interface TransactionRequest {
  readonly isolationLevel?: TransactionIsolationLevel;
  readonly name?: string;
}

/** Metadata for the current local transaction; this is not a database handle. */
export interface CurrentTransactionService {
  readonly adapter: string;
  readonly startedAt: Date;
  readonly transactionId: string;
}

/** Effect tag for the transaction metadata visible inside transaction-scoped work. */
export const CurrentTransactionService =
  Context.Service<CurrentTransactionService>(
    "@ecommerce/core/CurrentTransactionService"
  );

/** Expected failure emitted when a transaction cannot start, commit, or roll back. */
export class TransactionFailure extends Schema.TaggedErrorClass<TransactionFailure>()(
  "TransactionFailure",
  {
    adapter: Schema.NonEmptyString,
    operation: Schema.Literals(["begin", "commit", "rollback"]),
  }
) {}

/** Runtime-neutral transaction boundary; adapters provide scoped resources internally. */
export interface TransactionBoundaryService {
  withTransaction<A, E, R>(
    effect: Effect.Effect<A, E, R | CurrentTransactionService>,
    request?: TransactionRequest
  ): Effect.Effect<A, E | TransactionFailure, R>;
}

/** Effect tag for local transaction ownership at application-service boundaries. */
export const TransactionBoundaryService =
  Context.Service<TransactionBoundaryService>(
    "@ecommerce/core/TransactionBoundaryService"
  );

/** Creates a Layer for transaction metadata available to transaction-scoped services. */
export const currentTransactionLayer = (service: CurrentTransactionService) =>
  Layer.succeed(CurrentTransactionService, service);

/** Creates a Layer for a transaction boundary implementation. */
export const transactionBoundaryLayer = (service: TransactionBoundaryService) =>
  Layer.succeed(TransactionBoundaryService, service);

/** Stable migration identifier owned by an adapter package. */
export type MigrationId = string;

/** Migration dialect name such as `postgres`; not a driver or connection object. */
export type MigrationDialect = string;

/** Static migration metadata exported by dialect adapter packages. */
export interface MigrationDefinition {
  readonly checksum: string;
  readonly description: string;
  readonly dialect: MigrationDialect;
  readonly id: MigrationId;
  readonly moduleName: string;
}

/** Persisted migration status record. */
export interface MigrationRecord extends MigrationDefinition {
  readonly appliedAt?: Date;
  readonly failureMessage?: string;
  readonly status: "applied" | "failed" | "pending";
}

/** Aggregate migration status for a concrete adapter. */
export interface MigrationStatus {
  readonly adapter: string;
  readonly checkedAt: Date;
  readonly records: readonly MigrationRecord[];
}

/** Result returned after applying pending migrations. */
export interface MigrationApplyResult {
  readonly applied: readonly MigrationRecord[];
  readonly status: MigrationStatus;
}

/** Expected failure emitted by migration service implementations. */
export class MigrationFailure extends Schema.TaggedErrorClass<MigrationFailure>()(
  "MigrationFailure",
  {
    adapter: Schema.NonEmptyString,
    migrationId: Schema.NonEmptyString,
    operation: Schema.Literals(["status", "apply", "rollback", "reset"]),
  }
) {}

/** Runtime-neutral migration service; concrete SQL execution stays in adapters. */
export interface MigrationService {
  applyPending(): Effect.Effect<MigrationApplyResult, MigrationFailure>;
  getStatus(): Effect.Effect<MigrationStatus, MigrationFailure>;
}

/** Effect tag for adapter-owned migration services. */
export const MigrationService = Context.Service<MigrationService>(
  "@ecommerce/core/MigrationService"
);

/** Creates a Layer for a migration service implementation. */
export const migrationServiceLayer = (service: MigrationService) =>
  Layer.succeed(MigrationService, service);

/** Transactional outbox status values shared by adapters and claimers. */
export type OutboxStatus = "pending" | "claimed" | "delivered" | "failed";

/** Claim result when a worker reserves outbox records for delivery. */
export interface OutboxClaim {
  readonly claimedAt: Date;
  readonly claimId: string;
  readonly records: readonly OutboxRecord[];
}

/** Message shape written beside domain state in the same local transaction. */
export interface OutboxMessage<
  EventName extends string = string,
  Payload = unknown,
> {
  readonly event: CommerceEventEnvelope<EventName, Payload>;
  readonly idempotencyKey: string;
  readonly topic: string;
}

/** Persisted outbox record without exposing SQL or adapter row types. */
export interface OutboxRecord<
  EventName extends string = string,
  Payload = unknown,
> extends OutboxMessage<EventName, Payload> {
  readonly attempts: number;
  readonly createdAt: Date;
  readonly lastError?: string;
  readonly recordId: string;
  readonly status: OutboxStatus;
  readonly transactionId: string;
}

/** Result returned after writing one outbox record. */
export interface OutboxEnqueueResult<
  EventName extends string = string,
  Payload = unknown,
> {
  readonly record: OutboxRecord<EventName, Payload>;
}

/** Expected failure emitted when outbox persistence cannot write or update records. */
export class OutboxPersistenceFailure extends Schema.TaggedErrorClass<OutboxPersistenceFailure>()(
  "OutboxPersistenceFailure",
  {
    operation: Schema.Literals(["enqueue", "claim", "deliver", "fail"]),
    topic: Schema.NonEmptyString,
  }
) {}

/** Transaction-scoped outbox writer used by module application services. */
export interface OutboxWriterService {
  enqueue<EventName extends string, Payload>(
    message: OutboxMessage<EventName, Payload>
  ): Effect.Effect<
    OutboxEnqueueResult<EventName, Payload>,
    OutboxPersistenceFailure,
    CurrentTransactionService
  >;
}

/** Claiming service used by queue/workflow delivery adapters after commit. */
export interface OutboxClaimerService {
  claimPending(options: {
    readonly limit: number;
    readonly topic: string;
  }): Effect.Effect<OutboxClaim, OutboxPersistenceFailure>;
  markDelivered(
    recordId: string
  ): Effect.Effect<void, OutboxPersistenceFailure>;
  markFailed(options: {
    readonly recordId: string;
    readonly reason: string;
  }): Effect.Effect<void, OutboxPersistenceFailure>;
}

/** Effect tag for the transactional outbox writer. */
export const OutboxWriterService = Context.Service<OutboxWriterService>(
  "@ecommerce/core/OutboxWriterService"
);

/** Effect tag for post-commit outbox claiming and delivery state. */
export const OutboxClaimerService = Context.Service<OutboxClaimerService>(
  "@ecommerce/core/OutboxClaimerService"
);

/** Creates a Layer for a transactional outbox writer implementation. */
export const outboxWriterLayer = (service: OutboxWriterService) =>
  Layer.succeed(OutboxWriterService, service);

/** Creates a Layer for an outbox claiming implementation. */
export const outboxClaimerLayer = (service: OutboxClaimerService) =>
  Layer.succeed(OutboxClaimerService, service);
