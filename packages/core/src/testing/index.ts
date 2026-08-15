import {
  Cause,
  Clock,
  ConfigProvider,
  Effect,
  Layer,
  Logger,
  References,
  Ref,
  Schema,
  Tracer,
} from "effect";
import type { Context } from "effect";

import type { CommerceEventEnvelope } from "../events/index";
import { createEventEnvelope } from "../events/index";
import {
  CurrentTransactionService,
  OutboxPersistenceFailure,
  TransactionFailure,
} from "../persistence/index";
import type {
  OutboxMessage,
  OutboxRecord,
  OutboxWriterService,
  TransactionBoundaryService,
} from "../persistence/index";
import type {
  AuthContextService,
  ClockService,
  EventPublisherService,
  IdGeneratorService,
  LoggerService,
} from "../services/index";
import { clockLayer, idGeneratorLayer } from "../services/index";
import { DurableAudit, recordCommerceRuntimeMetric } from "../telemetry/index";
import type { DurableAuditEvent } from "../telemetry/index";
import type {
  CommerceWorkflowDuplicateQuery,
  CommerceWorkflowMetadataRecord,
  CommerceWorkflowMetadataStore,
  CommerceWorkflowReconcileRequest,
  CommerceWorkflowRunError,
  CommerceWorkflowRunRecord,
  CommerceWorkflowRunState,
  CommerceWorkflowRuntime,
  CommerceWorkflowRetryPolicy,
  CommerceWorkflowStartRequest,
  CommerceWorkflowStateStore,
  CommerceWorkflowStepAttempt,
  WorkflowLifecycleEventPayload,
} from "../workflows/index";
import {
  CommerceWorkflowRunStateSchema,
  WORKFLOW_LIFECYCLE_EVENT_NAMES,
  createWorkflowRunError,
} from "../workflows/index";

export {
  collectImportBoundarySourceFiles,
  createLegacyBackendImportBoundary,
  extractImportSpecifiers,
  legacyBackendForbiddenSpecifiers,
  scanImportBoundaryViolations,
  type CollectImportBoundarySourceFilesOptions,
  type ImportBoundary,
  type ImportBoundaryFile,
  type ImportBoundaryRule,
  type ImportBoundaryViolation,
  type LegacyBackendImportBoundaryOptions,
  type ScanImportBoundaryViolationsOptions,
} from "./import-boundaries";

export {
  createInMemoryRepositoryContractHarness,
  createRepositoryContractHarness,
  type InMemoryRepositoryContractHarnessOptions,
  type RepositoryContractCase,
  type RepositoryContractHarness,
  type RepositoryContractHarnessOptions,
} from "./repository-contracts";

/** Captured Effect log entry used by deterministic telemetry tests. */
export interface TestLogEntry {
  readonly annotations: Readonly<Record<string, unknown>>;
  readonly message: unknown;
}

/** In-memory telemetry fixture for logs, spans, and durable audit events. */
export interface TestTelemetryCapture {
  readonly auditEvents: DurableAuditEvent[];
  readonly layer: Layer.Layer<DurableAudit>;
  readonly logs: TestLogEntry[];
  readonly spans: Tracer.Span[];
}

/** Resettable state harness for future runtime-neutral repository contracts. */
export interface InMemoryRepositoryTestLayer<Identifier, State> {
  readonly layer: Layer.Layer<Identifier>;
  readonly reset: Effect.Effect<void>;
  readonly snapshot: Effect.Effect<State>;
  readonly state: Ref.Ref<State>;
}

/** Reversible state participant used by the deterministic transaction adapter. */
export interface InMemoryTransactionResource {
  readonly captureRollback: Effect.Effect<Effect.Effect<void>>;
}

export interface CreateInMemoryTransactionBoundaryOptions {
  readonly adapter?: string;
  readonly failBegin?: boolean;
  readonly failCommit?: boolean;
  readonly now?: Date;
  readonly resources: readonly InMemoryTransactionResource[];
  readonly transactionIds?: readonly string[];
}

/**
 * Creates a deterministic local transaction boundary for public module tests.
 * Every registered resource captures a rollback Effect before mutation work
 * begins, so state and outbox intent are restored together on typed failure,
 * defect, or interruption.
 */
export const createInMemoryTransactionBoundary = ({
  adapter = "in-memory",
  failBegin = false,
  failCommit = false,
  now = new Date("2026-01-01T00:00:00.000Z"),
  resources,
  transactionIds = ["transaction_1"],
}: CreateInMemoryTransactionBoundaryOptions): TransactionBoundaryService => {
  let transactionIndex = 0;

  return {
    withTransaction: <A, E, R>(
      effect: Effect.Effect<A, E, R | CurrentTransactionService>
    ) =>
      Effect.gen(function* inMemoryTransactionEffect() {
        if (failBegin) {
          return yield* Effect.fail(
            new TransactionFailure({
              adapter,
              operation: "begin",
            })
          );
        }

        const rollbackEffects = yield* Effect.all(
          resources.map((resource) => resource.captureRollback)
        );
        const transactionId =
          transactionIds[transactionIndex] ?? transactionIds.at(-1);

        if (!transactionId) {
          throw new Error("No in-memory transaction id is configured.");
        }

        transactionIndex += 1;
        const exit = yield* Effect.exit(
          effect.pipe(
            Effect.provideService(
              CurrentTransactionService,
              CurrentTransactionService.of({
                adapter,
                startedAt: now,
                transactionId,
              })
            )
          )
        );

        if (exit._tag === "Success" && !failCommit) {
          return exit.value;
        }

        const rollbackExit = yield* Effect.exit(
          // ES2022-compatible reverse-order compensation for browser test builds.
          // oxlint-disable-next-line unicorn/no-array-reverse
          Effect.all([...rollbackEffects].reverse(), {
            discard: true,
          })
        );

        if (rollbackExit._tag === "Failure") {
          const originalCause: Cause.Cause<E | TransactionFailure> =
            exit._tag === "Failure"
              ? exit.cause
              : Cause.fail(
                  new TransactionFailure({
                    adapter,
                    operation: "commit",
                  })
                );

          return yield* Effect.failCause(
            Cause.combine(originalCause, rollbackExit.cause)
          );
        }

        if (exit._tag === "Success") {
          return yield* Effect.fail(
            new TransactionFailure({
              adapter,
              operation: "commit",
            })
          );
        }

        return yield* Effect.failCause(exit.cause);
      }),
  };
};

export interface InMemoryOutbox extends InMemoryTransactionResource {
  readonly records: OutboxRecord[];
  readonly writer: OutboxWriterService;
}

export interface CreateInMemoryOutboxOptions {
  readonly failEnqueue?: boolean;
  readonly now?: Date;
  readonly recordIds?: readonly string[];
}

/** Deterministic transactional outbox used by module conformance tests. */
export const createInMemoryOutbox = ({
  failEnqueue = false,
  now = new Date("2026-01-01T00:00:00.000Z"),
  recordIds = ["outbox_1"],
}: CreateInMemoryOutboxOptions = {}): InMemoryOutbox => {
  const records: OutboxRecord[] = [];
  let recordIndex = 0;

  return {
    captureRollback: Effect.sync(() => {
      const snapshot = [...records];
      return Effect.sync(() => {
        records.splice(0, records.length, ...snapshot);
      });
    }),
    records,
    writer: {
      enqueue: <EventName extends string, Payload>(
        message: OutboxMessage<EventName, Payload>
      ) =>
        CurrentTransactionService.use((transaction) => {
          const duplicate = records.find(
            (record) =>
              record.topic === message.topic &&
              record.idempotencyKey === message.idempotencyKey
          );

          if (duplicate) {
            return Effect.succeed({
              record: duplicate as OutboxRecord<EventName, Payload>,
            });
          }

          if (failEnqueue) {
            return Effect.fail(
              new OutboxPersistenceFailure({
                operation: "enqueue",
                topic: message.topic,
              })
            );
          }

          const recordId = recordIds[recordIndex] ?? recordIds.at(-1);
          if (!recordId) {
            throw new Error("No in-memory outbox record id is configured.");
          }
          recordIndex += 1;
          const record: OutboxRecord<EventName, Payload> = {
            ...message,
            attempts: 0,
            createdAt: now,
            recordId,
            status: "pending",
            transactionId: transaction.transactionId,
          };
          records.push(record);
          return Effect.succeed({ record });
        }),
    },
  };
};

/** Creates a legacy clock fixture for code not yet migrated to Effect Clock. */
export const createStaticClock = (date: Date): ClockService => ({
  now: () => date,
});

const dateToNanoseconds = (date: Date): bigint =>
  BigInt(date.getTime()) * 1_000_000n;

/** Creates an Effect `Clock.Clock` whose current time never advances. */
export const createDeterministicEffectClock = (date: Date): Clock.Clock => ({
  currentTimeMillis: Effect.sync(() => date.getTime()),
  currentTimeMillisUnsafe: () => date.getTime(),
  currentTimeNanos: Effect.sync(() => dateToNanoseconds(date)),
  currentTimeNanosUnsafe: () => dateToNanoseconds(date),
  sleep: () => Effect.void,
});

/** Provides both Effect Clock and the legacy ClockService for migration tests. */
export const createDeterministicClockLayer = (date: Date) =>
  Layer.mergeAll(
    Layer.succeed(Clock.Clock, createDeterministicEffectClock(date)),
    clockLayer(createStaticClock(date))
  );

/** Creates a deterministic legacy ID generator from an ordered sequence. */
export const createSequenceIdGenerator = (
  ids: readonly string[]
): IdGeneratorService => {
  let index = 0;

  return {
    nextId: () => {
      const next = ids[index] ?? ids.at(-1);

      if (!next) {
        throw new Error("No ids configured for sequence generator.");
      }

      index += 1;
      return next;
    },
  };
};

/** Provides a deterministic ID generator Layer for runtime-neutral tests. */
export const createSequenceIdGeneratorLayer = (ids: readonly string[]) =>
  idGeneratorLayer(createSequenceIdGenerator(ids));

/** Provides an Effect ConfigProvider Layer from a plain object fixture. */
export const createTestConfigLayer = (
  values: Readonly<Record<string, unknown>>
) => ConfigProvider.layer(ConfigProvider.fromUnknown(values));

/** Creates a no-op legacy logger fixture for code not yet on Effect telemetry. */
export const createTestLogger = (): LoggerService => ({
  log: () => {
    // no-op yet
  },
});

/** Captures Effect logs, spans, and durable audit events without exporters. */
export const createTestTelemetry = (): TestTelemetryCapture => {
  const logs: TestLogEntry[] = [];
  const spans: Tracer.Span[] = [];
  const auditEvents: DurableAuditEvent[] = [];

  const logger = Logger.make((options) => {
    logs.push({
      annotations: options.fiber.getRef(References.CurrentLogAnnotations),
      message: options.message,
    });
  });
  const tracer = Tracer.make({
    span: (options) => {
      const attributes = new Map<string, unknown>();
      const links = [...options.links];
      let status: Tracer.SpanStatus = {
        _tag: "Started",
        startTime: options.startTime,
      };
      const span: Tracer.Span = {
        _tag: "Span",
        addLinks: (newLinks) => {
          links.push(...newLinks);
        },
        annotations: options.annotations,
        attribute: (key, value) => {
          attributes.set(key, value);
        },
        attributes,
        end: (endTime, exit) => {
          status = {
            _tag: "Ended",
            endTime,
            exit,
            startTime: options.startTime,
          };
        },
        event: (name) => {
          void name;
        },
        get status() {
          return status;
        },
        kind: options.kind,
        links,
        name: options.name,
        parent: options.parent,
        sampled: options.sampled,
        spanId: `span_${spans.length + 1}`,
        traceId: "trace_test",
      };
      spans.push(span);
      return span;
    },
  });
  const auditLayer = Layer.succeed(
    DurableAudit,
    DurableAudit.of({
      record: (event) =>
        Effect.sync(() => {
          auditEvents.push(event);
        }),
    })
  );

  return {
    auditEvents,
    layer: Layer.mergeAll(
      Logger.layer([logger]),
      Layer.succeed(Tracer.Tracer, tracer),
      auditLayer
    ),
    logs,
    spans,
  };
};

/**
 * Creates a resettable in-memory repository Layer.
 *
 * This does not define repository semantics. Module-specific contract suites
 * should supply their own service shape and use this helper only for
 * deterministic state control.
 */
export const createInMemoryRepositoryTestLayer = <Identifier, Service, State>({
  initialState,
  makeRepository,
  service,
}: {
  readonly initialState: () => State;
  readonly makeRepository: (state: Ref.Ref<State>) => Service;
  readonly service: Context.Key<Identifier, Service>;
}): InMemoryRepositoryTestLayer<Identifier, State> => {
  const state = Ref.makeUnsafe(initialState());

  return {
    layer: Layer.succeed(service, makeRepository(state)),
    reset: Effect.flatMap(Effect.sync(initialState), (nextState) =>
      Ref.set(state, nextState)
    ),
    snapshot: Ref.get(state),
    state,
  };
};

/** Creates a static actor context fixture for request-scope tests. */
export const createStaticAuthContext = (
  actor: unknown | null
): AuthContextService => ({
  getActor: () => actor,
});

/** Creates an in-memory event publisher plus the mutable collection it appends to. */
export const createEventCollector = () => {
  const events: CommerceEventEnvelope[] = [];

  const publisher: EventPublisherService = {
    publish: (event) => {
      events.push(event);
    },
  };

  return {
    events,
    publisher,
  };
};

export const createInMemoryWorkflowMetadataStore = (): {
  readonly records: Map<string, CommerceWorkflowMetadataRecord>;
  readonly idempotencyIndex: Map<string, CommerceWorkflowMetadataRecord>;
  readonly events: CommerceEventEnvelope[];
  readonly store: CommerceWorkflowMetadataStore;
} => {
  const records = new Map<string, CommerceWorkflowMetadataRecord>();
  const idempotencyIndex = new Map<string, CommerceWorkflowMetadataRecord>();
  const events: CommerceEventEnvelope[] = [];

  return {
    records,
    idempotencyIndex,
    events,
    store: {
      appendEvent: (event) => {
        events.push(event);
      },
      findRunByIdempotencyKey: ({ workflowKey, idempotencyKey }) =>
        Promise.resolve(
          idempotencyIndex.get(`${workflowKey}:${idempotencyKey}`) ?? null
        ),
      getRun: (runId) => Promise.resolve(records.get(runId) ?? null),
      registerRun: (record) => {
        const duplicateKey = record.idempotencyKey
          ? `${record.workflowKey}:${record.idempotencyKey}`
          : null;
        const duplicate = duplicateKey
          ? (idempotencyIndex.get(duplicateKey) ?? null)
          : null;

        if (duplicate) {
          return Promise.resolve({
            record: duplicate,
            status: "duplicate" as const,
          });
        }

        records.set(record.runId, record);

        if (duplicateKey) {
          idempotencyIndex.set(duplicateKey, record);
        }

        return Promise.resolve({
          record,
          status: "created" as const,
        });
      },
      upsertRun: (record) => {
        records.set(record.runId, record);
        if (record.idempotencyKey) {
          idempotencyIndex.set(
            `${record.workflowKey}:${record.idempotencyKey}`,
            record
          );
        }
      },
    },
  };
};

/** In-memory durable workflow state fixture used by recovery contract tests. */
export const createInMemoryWorkflowStateStore = (): {
  readonly states: Map<string, CommerceWorkflowRunState>;
  readonly idempotencyIndex: Map<string, CommerceWorkflowRunState>;
  readonly store: CommerceWorkflowStateStore;
} => {
  const states = new Map<string, CommerceWorkflowRunState>();
  const idempotencyIndex = new Map<string, CommerceWorkflowRunState>();

  const upsert = (state: CommerceWorkflowRunState): void => {
    const decoded = Schema.decodeUnknownSync(CommerceWorkflowRunStateSchema)(
      state
    );
    states.set(decoded.runId, decoded);
    if (decoded.idempotencyKey) {
      idempotencyIndex.set(
        `${decoded.workflowKey}:${decoded.idempotencyKey}`,
        decoded
      );
    }
  };

  return {
    states,
    idempotencyIndex,
    store: {
      findRunStateByIdempotencyKey: ({ workflowKey, idempotencyKey }) =>
        Promise.resolve(
          idempotencyIndex.get(`${workflowKey}:${idempotencyKey}`) ?? null
        ),
      getRunState: (runId) => Promise.resolve(states.get(runId) ?? null),
      registerRunState: (state) => {
        const duplicateKey = state.idempotencyKey
          ? `${state.workflowKey}:${state.idempotencyKey}`
          : null;
        const duplicate = duplicateKey
          ? (idempotencyIndex.get(duplicateKey) ?? null)
          : null;

        if (duplicate) {
          return Promise.resolve({
            state: duplicate,
            status: "duplicate" as const,
          });
        }

        upsert(state);
        return Promise.resolve({
          state,
          status: "created" as const,
        });
      },
      upsertRunState: upsert,
    },
  };
};

/** Options for the deterministic, platform-free workflow runtime fixture. */
export interface InMemoryWorkflowRuntimeOptions {
  readonly clock: ClockService;
  readonly ids: IdGeneratorService;
  readonly publisher: EventPublisherService;
  readonly metadataStore?: CommerceWorkflowMetadataStore;
  readonly stateStore?: CommerceWorkflowStateStore;
  /**
   * Test-only interruption hook. When set, the runtime persists state after the
   * Nth newly executed step and then throws, letting recovery tests prove replay
   * resumes without re-running completed side effects.
   */
  readonly interruptAfterCompletedSteps?: number;
}

const makeDuplicateKey = ({
  workflowKey,
  idempotencyKey,
}: CommerceWorkflowDuplicateQuery) => `${workflowKey}:${idempotencyKey}`;

const observeWorkflowMetric = async (
  options: Parameters<typeof recordCommerceRuntimeMetric>[0]
): Promise<void> => {
  await Effect.runPromise(
    recordCommerceRuntimeMetric(options).pipe(Effect.exit)
  );
};

const createLifecycleEvent = (
  ids: IdGeneratorService,
  payload: WorkflowLifecycleEventPayload,
  occurredAt: Date
) =>
  createEventEnvelope({
    id: ids.nextId(),
    name: payload.type,
    payload,
    emittedAt: occurredAt,
    correlationId: payload.correlationId,
    causationId: payload.causationId,
    workflowRunId: payload.runId,
    subject: payload.subject,
  });

const workflowDateToIso = (date: Date): string => date.toISOString();

const workflowDateFromIso = (value: string): Date => new Date(value);

class InMemoryWorkflowRuntimeInterruptedError extends Error {
  constructor() {
    super("In-memory workflow runtime interrupted after persisted step.");
    this.name = "InMemoryWorkflowRuntimeInterruptedError";
  }
}

type WorkflowRuntimeBaseRecord<Input, Output> = Omit<
  CommerceWorkflowRunRecord<Input, Output>,
  "attempts" | "completedAt" | "output" | "status" | "updatedAt"
>;

interface WorkflowStartPreparation<Input, Output> {
  readonly attempts: CommerceWorkflowStepAttempt[];
  readonly baseRecord: WorkflowRuntimeBaseRecord<Input, Output>;
  readonly createdAt: Date;
  readonly output: Output | undefined;
  readonly recoveredRecord: CommerceWorkflowRunRecord | null;
  readonly recoveredState: CommerceWorkflowRunState | null;
  readonly runId: string;
}

const completedRunStepCount = (
  attempts: readonly CommerceWorkflowStepAttempt[] | undefined
): number =>
  new Set(
    attempts
      ?.filter(
        (attempt) =>
          attempt.phase !== "compensation" && attempt.status === "completed"
      )
      .map((attempt) => attempt.stepId)
  ).size;

const nextWorkflowStepAttempt = (
  attempts: readonly CommerceWorkflowStepAttempt[],
  stepId: string
): number =>
  attempts.filter(
    (attempt) => attempt.phase !== "compensation" && attempt.stepId === stepId
  ).length + 1;

const shouldRetryWorkflowError = ({
  attempt,
  error,
  policy,
}: {
  readonly attempt: number;
  readonly error: CommerceWorkflowRunError;
  readonly policy: CommerceWorkflowRetryPolicy | undefined;
}): boolean => {
  if (policy === undefined || attempt >= policy.maxAttempts) {
    return false;
  }

  const retryableTags = policy.retryableErrorTags;
  if (retryableTags === undefined || retryableTags.length === 0) {
    return error.retryable !== false;
  }

  return error.tag !== undefined && retryableTags.includes(error.tag);
};

/**
 * Calculates persisted retry timing for the deterministic harness.
 *
 * The in-memory runtime records the schedule but retries immediately; production
 * adapters own durable waiting and must preserve the same attempt metadata.
 */
const workflowRetryDelayMillis = ({
  attempt,
  policy,
}: {
  readonly attempt: number;
  readonly policy: CommerceWorkflowRetryPolicy | undefined;
}): number => {
  const backoffMillis = policy?.backoffMillis;
  if (backoffMillis === undefined || backoffMillis.length === 0) {
    return 0;
  }

  const index = Math.min(attempt - 1, backoffMillis.length - 1);
  const backoff = backoffMillis[index] ?? 0;
  const maxDelayMillis = policy?.maxDelayMillis;
  return maxDelayMillis === undefined
    ? backoff
    : Math.min(backoff, maxDelayMillis);
};

export const createInMemoryWorkflowRuntime = ({
  clock,
  ids,
  publisher,
  metadataStore,
  stateStore,
  interruptAfterCompletedSteps,
}: InMemoryWorkflowRuntimeOptions): CommerceWorkflowRuntime => {
  const runs = new Map<string, CommerceWorkflowRunRecord>();
  const idempotencyIndex = new Map<string, string>();
  let completedStepsInThisRuntime = 0;

  const terminalStatuses: ReadonlySet<CommerceWorkflowRunRecord["status"]> =
    new Set([
      "completed",
      "failed",
      "compensated",
    ] satisfies readonly CommerceWorkflowRunRecord["status"][]);

  const isTerminalStatus = (
    status: CommerceWorkflowRunRecord["status"]
  ): boolean => terminalStatuses.has(status);

  const attemptToStateOutcome = (
    attempt: CommerceWorkflowStepAttempt
  ): CommerceWorkflowRunState["attempts"][number] => ({
    attempt: attempt.attempt,
    error: attempt.error,
    output: attempt.output,
    phase:
      attempt.phase ??
      (attempt.status === "compensated" ? "compensation" : "run"),
    retryDisposition: attempt.retryDisposition,
    scheduledRetryAt: attempt.scheduledRetryAt
      ? workflowDateToIso(attempt.scheduledRetryAt)
      : undefined,
    startedAt: workflowDateToIso(attempt.startedAt),
    status: attempt.status,
    stepId: attempt.stepId,
    stepName: attempt.stepName,
    completedAt: attempt.completedAt
      ? workflowDateToIso(attempt.completedAt)
      : undefined,
  });

  const stateOutcomeToAttempt = (
    outcome: CommerceWorkflowRunState["attempts"][number]
  ): CommerceWorkflowStepAttempt => ({
    attempt: outcome.attempt,
    completedAt: outcome.completedAt
      ? workflowDateFromIso(outcome.completedAt)
      : undefined,
    error: outcome.error,
    output: outcome.output,
    phase: outcome.phase,
    retryDisposition: outcome.retryDisposition,
    scheduledRetryAt: outcome.scheduledRetryAt
      ? workflowDateFromIso(outcome.scheduledRetryAt)
      : undefined,
    startedAt: workflowDateFromIso(outcome.startedAt),
    status: outcome.status,
    stepId: outcome.stepId,
    stepName: outcome.stepName,
  });

  const toRunState = (
    record: CommerceWorkflowRunRecord,
    nextStepIndex: number
  ): CommerceWorkflowRunState =>
    Schema.decodeUnknownSync(CommerceWorkflowRunStateSchema)({
      attempts: (record.attempts ?? []).map(attemptToStateOutcome),
      causationId: record.causationId,
      completedAt: record.completedAt
        ? workflowDateToIso(record.completedAt)
        : undefined,
      correlationId: record.correlationId,
      createdAt: workflowDateToIso(record.createdAt),
      historyReference: record.historyReference,
      idempotencyKey: record.idempotencyKey,
      input: record.input,
      metadata: record.metadata,
      nextStepIndex,
      output: record.output,
      runId: record.runId,
      schemaVersion: 1,
      status: record.status,
      subject: record.subject,
      updatedAt: workflowDateToIso(record.updatedAt),
      workflowKey: record.workflowKey,
      workflowVersion: record.workflowVersion,
    });

  const stateToRecord = (
    state: CommerceWorkflowRunState
  ): CommerceWorkflowRunRecord => ({
    attempts: state.attempts.map(stateOutcomeToAttempt),
    correlationId: state.correlationId,
    createdAt: workflowDateFromIso(state.createdAt),
    input: state.input,
    runId: state.runId,
    status: state.status,
    updatedAt: workflowDateFromIso(state.updatedAt),
    workflowKey: state.workflowKey,
    workflowVersion: state.workflowVersion,
    causationId: state.causationId,
    completedAt: state.completedAt
      ? workflowDateFromIso(state.completedAt)
      : undefined,
    historyReference: state.historyReference,
    idempotencyKey: state.idempotencyKey,
    metadata: state.metadata,
    output: state.output,
    subject: state.subject,
  });

  const persistRecord = async (
    record: CommerceWorkflowRunRecord,
    nextStepIndex = completedRunStepCount(record.attempts)
  ): Promise<void> => {
    runs.set(record.runId, record);
    if (record.idempotencyKey) {
      idempotencyIndex.set(
        `${record.workflowKey}:${record.idempotencyKey}`,
        record.runId
      );
    }

    await metadataStore?.upsertRun({
      runId: record.runId,
      workflowKey: record.workflowKey,
      workflowVersion: record.workflowVersion,
      status: record.status,
      correlationId: record.correlationId,
      causationId: record.causationId,
      idempotencyKey: record.idempotencyKey,
      subject: record.subject,
      metadata: record.metadata,
      updatedAt: record.updatedAt,
    });
    await stateStore?.upsertRunState(toRunState(record, nextStepIndex));
  };

  const publishLifecycle = async (
    payload: WorkflowLifecycleEventPayload
  ): Promise<void> => {
    const { occurredAt } = payload;
    const event = createLifecycleEvent(ids, payload, occurredAt);
    await publisher.publish(event);
    await metadataStore?.appendEvent(event);
  };

  const reconcile = async (
    request: CommerceWorkflowReconcileRequest
  ): Promise<CommerceWorkflowRunRecord | null> => {
    const local = runs.get(request.runId);
    if (local) {
      return local;
    }

    const state = (await stateStore?.getRunState(request.runId)) ?? null;
    if (!state) {
      return null;
    }

    const record = stateToRecord(state);
    await persistRecord(record, state.nextStepIndex);
    return record;
  };

  const toWorkflowRecord = <Input, Output>(
    value: CommerceWorkflowRunRecord | CommerceWorkflowRunState
  ): CommerceWorkflowRunRecord<Input, Output> =>
    ("schemaVersion" in value
      ? stateToRecord(value)
      : value) as CommerceWorkflowRunRecord<Input, Output>;

  const findTerminalDuplicateRecord = async <Input, Output>(
    request: CommerceWorkflowStartRequest<Input, Output>
  ): Promise<CommerceWorkflowRunRecord<Input, Output> | null> => {
    if (!request.idempotencyKey) {
      return null;
    }

    const duplicateQuery = {
      workflowKey: request.workflow.key,
      idempotencyKey: request.idempotencyKey,
    };
    const duplicateRunId = idempotencyIndex.get(
      makeDuplicateKey(duplicateQuery)
    );
    const localDuplicate = duplicateRunId
      ? await reconcile({ runId: duplicateRunId })
      : null;
    const storedDuplicate =
      localDuplicate ??
      (await stateStore?.findRunStateByIdempotencyKey(duplicateQuery)) ??
      null;

    if (!storedDuplicate) {
      return null;
    }

    const duplicateRecord = toWorkflowRecord<Input, Output>(storedDuplicate);
    return isTerminalStatus(duplicateRecord.status) ? duplicateRecord : null;
  };

  const findRecoveredState = async <Input, Output>(
    request: CommerceWorkflowStartRequest<Input, Output>
  ): Promise<CommerceWorkflowRunState | null> => {
    if (request.runId) {
      return (await stateStore?.getRunState(request.runId)) ?? null;
    }

    if (!request.idempotencyKey) {
      return null;
    }

    return (
      (await stateStore?.findRunStateByIdempotencyKey({
        workflowKey: request.workflow.key,
        idempotencyKey: request.idempotencyKey,
      })) ?? null
    );
  };

  const prepareWorkflowStart = async <Input, Output>(
    request: CommerceWorkflowStartRequest<Input, Output>
  ): Promise<WorkflowStartPreparation<Input, Output>> => {
    const recoveredState = await findRecoveredState(request);
    const recoveredRecord = recoveredState
      ? stateToRecord(recoveredState)
      : null;
    const createdAt = recoveredRecord?.createdAt ?? clock.now();
    const runId = recoveredRecord?.runId ?? request.runId ?? ids.nextId();

    return {
      attempts: [...(recoveredRecord?.attempts ?? [])],
      baseRecord: {
        correlationId: request.correlationId,
        createdAt,
        input: request.input,
        metadata: request.metadata,
        runId,
        workflowKey: request.workflow.key,
        workflowVersion: request.workflow.version,
        causationId: request.causationId,
        idempotencyKey: request.idempotencyKey,
        subject: request.subject,
      },
      createdAt,
      output: recoveredRecord?.output as Output | undefined,
      recoveredRecord,
      recoveredState,
      runId,
    };
  };

  const persistStartedWorkflow = async <Input, Output>({
    attempts,
    baseRecord,
    createdAt,
    request,
    runId,
    status,
  }: {
    attempts: CommerceWorkflowStepAttempt[];
    baseRecord: WorkflowRuntimeBaseRecord<Input, Output>;
    createdAt: Date;
    request: CommerceWorkflowStartRequest<Input, Output>;
    runId: string;
    status: "pending" | "running";
  }): Promise<void> => {
    await publishLifecycle({
      type: WORKFLOW_LIFECYCLE_EVENT_NAMES.started,
      occurredAt: createdAt,
      status,
      runId,
      workflowKey: request.workflow.key,
      workflowVersion: request.workflow.version,
      correlationId: request.correlationId,
      causationId: request.causationId,
      idempotencyKey: request.idempotencyKey,
      subject: request.subject,
    });
    await persistRecord(
      {
        ...baseRecord,
        attempts,
        status,
        updatedAt: createdAt,
      },
      0
    );
  };

  const publishFinalWorkflowLifecycle = async <Input, Output>({
    output,
    record,
    request,
    runId,
    status,
    workflowError,
  }: {
    output: Output | undefined;
    record: CommerceWorkflowRunRecord<Input, Output>;
    request: CommerceWorkflowStartRequest<Input, Output>;
    runId: string;
    status: CommerceWorkflowRunRecord<Input, Output>["status"];
    workflowError: CommerceWorkflowRunError | undefined;
  }): Promise<void> => {
    if (status === "completed") {
      await publishLifecycle({
        type: WORKFLOW_LIFECYCLE_EVENT_NAMES.completed,
        occurredAt: record.updatedAt,
        status,
        runId,
        workflowKey: request.workflow.key,
        workflowVersion: request.workflow.version,
        correlationId: request.correlationId,
        causationId: request.causationId,
        idempotencyKey: request.idempotencyKey,
        subject: request.subject,
        output,
      });
    }

    if (workflowError) {
      await publishLifecycle({
        type: WORKFLOW_LIFECYCLE_EVENT_NAMES.failed,
        occurredAt: record.updatedAt,
        status: status === "compensated" ? "compensated" : "failed",
        runId,
        workflowKey: request.workflow.key,
        workflowVersion: request.workflow.version,
        correlationId: request.correlationId,
        causationId: request.causationId,
        idempotencyKey: request.idempotencyKey,
        subject: request.subject,
        error: workflowError,
      });
    }
  };

  const executeWorkflowSteps = async <Input, Output>({
    attempts,
    baseRecord,
    request,
    runId,
    startIndex,
  }: {
    attempts: CommerceWorkflowStepAttempt[];
    baseRecord: WorkflowRuntimeBaseRecord<Input, Output>;
    request: CommerceWorkflowStartRequest<Input, Output>;
    runId: string;
    startIndex: number;
  }): Promise<Output | undefined> => {
    for (
      let stepIndex = startIndex;
      stepIndex < request.workflow.steps.length;
      stepIndex += 1
    ) {
      const step = request.workflow.steps[stepIndex];
      if (!step) {
        continue;
      }
      const { retryPolicy } = step;
      const maxAttempts = retryPolicy?.maxAttempts ?? 1;
      const stepId = `${runId}:${step.name}:${stepIndex + 1}`;
      const firstAttempt = nextWorkflowStepAttempt(attempts, stepId);
      let stepCompleted = false;

      for (
        let attemptNumber = firstAttempt;
        attemptNumber <= maxAttempts;
        attemptNumber += 1
      ) {
        const stepStartedAt = clock.now();
        const context = {
          workflowId: runId,
          workflowKey: request.workflow.key,
          workflowVersion: request.workflow.version,
          stepId,
          stepName: step.name,
          attempt: attemptNumber,
          correlationId: request.correlationId,
          causationId: request.causationId,
          idempotencyKey: request.idempotencyKey,
          subject: request.subject,
        };
        const exit = await Effect.runPromiseExit(
          step.run(request.input, context)
        );

        if (exit._tag === "Failure") {
          if (Cause.hasInterruptsOnly(exit.cause)) {
            await observeWorkflowMetric({
              attributes: {
                phase: "run",
                status: "interrupted",
              },
              boundary: "workflow",
              event: "interruption",
            });
            throw new InMemoryWorkflowRuntimeInterruptedError();
          }

          const error = Cause.squash(exit.cause);
          const failedAt = clock.now();
          const workflowError = createWorkflowRunError(error);
          const shouldRetry = shouldRetryWorkflowError({
            attempt: attemptNumber,
            error: workflowError,
            policy: retryPolicy,
          });
          const boundedBackoff = workflowRetryDelayMillis({
            attempt: attemptNumber,
            policy: retryPolicy,
          });
          const scheduledRetryAt = shouldRetry
            ? new Date(failedAt.getTime() + boundedBackoff)
            : undefined;
          attempts.push({
            attempt: attemptNumber,
            completedAt: failedAt,
            error: workflowError,
            phase: "run",
            retryDisposition: shouldRetry ? "retry" : "compensate",
            scheduledRetryAt,
            startedAt: stepStartedAt,
            status: "failed",
            stepId: context.stepId,
            stepName: step.name,
          });
          await persistRecord(
            {
              ...baseRecord,
              attempts,
              completedAt: shouldRetry ? undefined : failedAt,
              status: shouldRetry ? "running" : "failed",
              updatedAt: failedAt,
            },
            stepIndex
          );
          await publishLifecycle({
            type: WORKFLOW_LIFECYCLE_EVENT_NAMES.stepFailed,
            occurredAt: failedAt,
            status: "failed",
            runId,
            workflowKey: request.workflow.key,
            workflowVersion: request.workflow.version,
            correlationId: request.correlationId,
            causationId: request.causationId,
            idempotencyKey: request.idempotencyKey,
            subject: request.subject,
            stepId: context.stepId,
            stepName: step.name,
            attempt: attemptNumber,
            error: workflowError,
          });
          await observeWorkflowMetric({
            attributes: {
              phase: "run",
              retryDisposition: shouldRetry ? "retry" : "compensate",
              status: "failed",
            },
            boundary: "workflow",
            event: shouldRetry ? "retry" : "typed_rejection",
          });

          if (shouldRetry) {
            continue;
          }

          throw error;
        }

        const completedAt = clock.now();
        attempts.push({
          attempt: attemptNumber,
          completedAt,
          output: exit.value.output,
          phase: "run",
          startedAt: stepStartedAt,
          status: "completed",
          stepId: context.stepId,
          stepName: step.name,
        });

        await publishLifecycle({
          type: WORKFLOW_LIFECYCLE_EVENT_NAMES.stepSucceeded,
          occurredAt: completedAt,
          status: "running",
          runId,
          workflowKey: request.workflow.key,
          workflowVersion: request.workflow.version,
          correlationId: request.correlationId,
          causationId: request.causationId,
          idempotencyKey: request.idempotencyKey,
          subject: request.subject,
          stepId: context.stepId,
          stepName: step.name,
          attempt: attemptNumber,
        });
        await persistRecord(
          {
            ...baseRecord,
            attempts,
            status: "running",
            updatedAt: completedAt,
          },
          stepIndex + 1
        );
        stepCompleted = true;
        break;
      }

      if (!stepCompleted) {
        throw new Error(`Workflow step ${step.name} exhausted retry attempts.`);
      }

      completedStepsInThisRuntime += 1;
      if (
        interruptAfterCompletedSteps !== undefined &&
        completedStepsInThisRuntime >= interruptAfterCompletedSteps
      ) {
        throw new InMemoryWorkflowRuntimeInterruptedError();
      }
    }

    return request.workflow.resolveOutput?.(attempts);
  };

  const compensateWorkflow = async <Input, Output>({
    attempts,
    baseRecord,
    request,
    runId,
  }: {
    attempts: CommerceWorkflowStepAttempt[];
    baseRecord: WorkflowRuntimeBaseRecord<Input, Output>;
    request: CommerceWorkflowStartRequest<Input, Output>;
    runId: string;
  }): Promise<"failed" | "compensated"> => {
    let status: "failed" | "compensated" = "failed";
    const completedAttempts: CommerceWorkflowStepAttempt[] = [];

    for (let index = attempts.length - 1; index >= 0; index -= 1) {
      const attempt = attempts[index];

      if (attempt) {
        completedAttempts.push(attempt);
      }
    }

    for (const completedAttempt of completedAttempts) {
      const stepDefinition = request.workflow.steps.find(
        (candidate) => candidate.name === completedAttempt.stepName
      );
      const compensation = stepDefinition?.compensation;

      if (compensation === undefined || completedAttempt.output === undefined) {
        continue;
      }

      await publishLifecycle({
        type: WORKFLOW_LIFECYCLE_EVENT_NAMES.compensationStarted,
        occurredAt: clock.now(),
        status: "compensating",
        runId,
        workflowKey: request.workflow.key,
        workflowVersion: request.workflow.version,
        correlationId: request.correlationId,
        causationId: request.causationId,
        idempotencyKey: request.idempotencyKey,
        subject: request.subject,
        stepId: completedAttempt.stepId,
        stepName: completedAttempt.stepName,
      });

      await Effect.runPromise(
        compensation.compensate(request.input, completedAttempt.output, {
          workflowId: runId,
          workflowKey: request.workflow.key,
          workflowVersion: request.workflow.version,
          stepId: completedAttempt.stepId,
          stepName: completedAttempt.stepName,
          attempt: completedAttempt.attempt,
          correlationId: request.correlationId,
          causationId: request.causationId,
          idempotencyKey: request.idempotencyKey,
          subject: request.subject,
        })
      );

      attempts.push({
        attempt: completedAttempt.attempt,
        completedAt: clock.now(),
        phase: "compensation",
        startedAt: completedAttempt.startedAt,
        status: "compensated",
        stepId: completedAttempt.stepId,
        stepName: completedAttempt.stepName,
      });
      await observeWorkflowMetric({
        attributes: {
          phase: "compensation",
          status: "compensated",
        },
        boundary: "workflow",
        event: "compensation",
      });

      status = "compensated";
      await persistRecord({
        ...baseRecord,
        attempts,
        status,
        updatedAt: clock.now(),
      });
      await publishLifecycle({
        type: WORKFLOW_LIFECYCLE_EVENT_NAMES.compensationCompleted,
        occurredAt: clock.now(),
        status,
        runId,
        workflowKey: request.workflow.key,
        workflowVersion: request.workflow.version,
        correlationId: request.correlationId,
        causationId: request.causationId,
        idempotencyKey: request.idempotencyKey,
        subject: request.subject,
        stepId: completedAttempt.stepId,
        stepName: completedAttempt.stepName,
      });
    }

    return status;
  };

  const executeWorkflowWithCompensation = async <Input, Output>({
    attempts,
    baseRecord,
    initialOutput,
    recoveredState,
    request,
    runId,
  }: {
    attempts: CommerceWorkflowStepAttempt[];
    baseRecord: WorkflowRuntimeBaseRecord<Input, Output>;
    initialOutput: Output | undefined;
    recoveredState: CommerceWorkflowRunState | null;
    request: CommerceWorkflowStartRequest<Input, Output>;
    runId: string;
  }): Promise<{
    readonly output: Output | undefined;
    readonly status: CommerceWorkflowRunRecord<Input, Output>["status"];
    readonly workflowError: CommerceWorkflowRunError | undefined;
  }> => {
    try {
      const output = await executeWorkflowSteps({
        attempts,
        baseRecord,
        request,
        runId,
        startIndex: recoveredState?.nextStepIndex ?? 0,
      });

      return {
        output,
        status: "completed",
        workflowError: undefined,
      };
    } catch (error) {
      if (error instanceof InMemoryWorkflowRuntimeInterruptedError) {
        throw error;
      }

      const workflowError = createWorkflowRunError(error);
      const status = await compensateWorkflow({
        attempts,
        baseRecord,
        request,
        runId,
      });

      return {
        output: initialOutput,
        status,
        workflowError,
      };
    }
  };

  return {
    capabilities: {
      adapter: "memory",
      supportsCompensation: true,
      supportsDurableHistory: stateStore !== undefined,
      supportsEvents: true,
      supportsMetadataProjection: metadataStore !== undefined,
      supportsPause: false,
    },
    dedupe: async <Output = unknown>(query: CommerceWorkflowDuplicateQuery) => {
      const runId = idempotencyIndex.get(makeDuplicateKey(query));
      const local = runId ? (runs.get(runId) ?? null) : null;
      if (local) {
        return local as CommerceWorkflowRunRecord<unknown, Output>;
      }

      const state =
        (await stateStore?.findRunStateByIdempotencyKey(query)) ?? null;
      return state
        ? (stateToRecord(state) as CommerceWorkflowRunRecord<unknown, Output>)
        : null;
    },
    get: async <Output = unknown>(runId: string) =>
      (await reconcile({ runId })) as CommerceWorkflowRunRecord<
        unknown,
        Output
      > | null,
    reconcile: async <Output = unknown>(
      request: CommerceWorkflowReconcileRequest
    ) => {
      const record = await reconcile(request);
      return record as CommerceWorkflowRunRecord<unknown, Output> | null;
    },
    start: async <Input, Output>(
      request: CommerceWorkflowStartRequest<Input, Output>
    ): Promise<CommerceWorkflowRunRecord<Input, Output>> => {
      const duplicateRecord = await findTerminalDuplicateRecord(request);
      if (duplicateRecord) {
        return duplicateRecord;
      }

      const prepared = await prepareWorkflowStart(request);
      const {
        attempts,
        baseRecord,
        createdAt,
        output: initialOutput,
        recoveredRecord,
        recoveredState,
        runId,
      } = prepared;
      const runningStatus = "running";

      if (recoveredRecord && isTerminalStatus(recoveredRecord.status)) {
        await persistRecord(recoveredRecord, recoveredState?.nextStepIndex);
        return recoveredRecord as CommerceWorkflowRunRecord<Input, Output>;
      }

      if (!recoveredRecord) {
        await persistStartedWorkflow({
          attempts,
          baseRecord,
          createdAt,
          request,
          runId,
          status: runningStatus,
        });
      }

      const { output, status, workflowError } =
        await executeWorkflowWithCompensation({
          attempts,
          baseRecord,
          initialOutput,
          recoveredState,
          request,
          runId,
        });

      const completedAt =
        status === "completed" ||
        status === "failed" ||
        status === "compensated"
          ? clock.now()
          : undefined;
      const record: CommerceWorkflowRunRecord<Input, Output> = {
        ...baseRecord,
        attempts,
        completedAt,
        output,
        status,
        updatedAt: completedAt ?? clock.now(),
      };

      await persistRecord(record);
      await publishFinalWorkflowLifecycle({
        output,
        record,
        request,
        runId,
        status,
        workflowError,
      });

      return record;
    },
  };
};

export interface InMemoryWorkflowRecoveryHarnessOptions {
  readonly clock: ClockService;
  readonly ids: IdGeneratorService;
}

export interface InMemoryWorkflowRecoveryHarness {
  readonly events: CommerceEventEnvelope[];
  readonly metadata: ReturnType<typeof createInMemoryWorkflowMetadataStore>;
  readonly state: ReturnType<typeof createInMemoryWorkflowStateStore>;
  readonly createRuntime: (
    options?: Pick<
      InMemoryWorkflowRuntimeOptions,
      "interruptAfterCompletedSteps"
    >
  ) => CommerceWorkflowRuntime;
}

/**
 * Creates a deterministic workflow recovery fixture with shared durable state.
 *
 * Tests use separate runtime instances from this harness to simulate Worker or
 * process restarts while preserving persisted step outcomes and idempotency
 * indexes. Production adapters must satisfy the same replay contract through
 * their own state store implementation.
 */
export const createInMemoryWorkflowRecoveryHarness = ({
  clock,
  ids,
}: InMemoryWorkflowRecoveryHarnessOptions): InMemoryWorkflowRecoveryHarness => {
  const { events, publisher } = createEventCollector();
  const metadata = createInMemoryWorkflowMetadataStore();
  const state = createInMemoryWorkflowStateStore();

  return {
    createRuntime: (options) =>
      createInMemoryWorkflowRuntime({
        clock,
        ids,
        publisher,
        metadataStore: metadata.store,
        stateStore: state.store,
        interruptAfterCompletedSteps: options?.interruptAfterCompletedSteps,
      }),
    events,
    metadata,
    state,
  };
};
