import {
  Cause,
  Clock,
  ConfigProvider,
  Effect,
  Option,
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
import {
  ClockService as ClockServiceTag,
  IdGeneratorService as IdGeneratorServiceTag,
  WorkflowRuntimeService,
  clockLayer,
  idGeneratorLayer,
} from "../services/index";
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
  WorkflowLifecyclePublisher,
} from "../workflows/index";
import {
  CommerceWorkflowRunStateSchema,
  CommerceWorkflowDefinitionDescriptorSchema,
  WORKFLOW_LIFECYCLE_EVENT_NAMES,
  WorkflowLifecyclePublisherService,
  WorkflowRuntimeError,
  WorkflowStateStoreService,
  createWorkflowRunError,
  describeWorkflowDefinition,
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
    workflowPublisher: {
      publish: (event: CommerceEventEnvelope) =>
        Effect.sync(() => {
          if (!events.some((existing) => existing.id === event.id)) {
            events.push(event);
          }
        }),
    } satisfies WorkflowLifecyclePublisher,
  };
};

/** Effect-native isolated metadata projection fixture. */
export const createInMemoryWorkflowMetadataStore = () => {
  const records = new Map<string, CommerceWorkflowMetadataRecord>();
  const idempotencyIndex = new Map<string, CommerceWorkflowMetadataRecord>();
  const events: CommerceEventEnvelope[] = [];
  const put = (record: CommerceWorkflowMetadataRecord) => {
    records.set(record.runId, record);
    if (record.idempotencyKey) {
      idempotencyIndex.set(
        `${record.workflowKey}:${record.idempotencyKey}`,
        record
      );
    }
  };
  const store: CommerceWorkflowMetadataStore = {
    getRun: (id) => Effect.sync(() => Option.fromUndefinedOr(records.get(id))),
    findRunByIdempotencyKey: (q) =>
      Effect.sync(() =>
        Option.fromUndefinedOr(idempotencyIndex.get(makeDuplicateKey(q)))
      ),
    registerRun: (record) =>
      Effect.sync(() => {
        const old = record.idempotencyKey
          ? idempotencyIndex.get(
              makeDuplicateKey({
                workflowKey: record.workflowKey,
                idempotencyKey: record.idempotencyKey,
              })
            )
          : records.get(record.runId);
        if (old) {
          return { status: "duplicate" as const, record: old };
        }
        put(record);
        return { status: "created" as const, record };
      }),
    upsertRun: (record) => Effect.sync(() => put(record)),
    appendEvent: (event) =>
      Effect.sync(() => {
        if (!events.some((existing) => existing.id === event.id)) {
          events.push(event);
        }
      }),
  };
  return { records, idempotencyIndex, events, store };
};

const decodeWorkflowRunState = (state: unknown) =>
  Schema.decodeUnknownEffect(CommerceWorkflowRunStateSchema)(state).pipe(
    Effect.mapError(
      () =>
        new WorkflowRuntimeError({
          operation: "state",
          message: "Invalid workflow state",
        })
    )
  );

/** Durable state fixture validates every stored value before returning it. */
export const createInMemoryWorkflowStateStore = () => {
  const states = new Map<string, CommerceWorkflowRunState>();
  const idempotencyIndex = new Map<string, CommerceWorkflowRunState>();
  const read = (state: CommerceWorkflowRunState | undefined) =>
    state === undefined
      ? Effect.succeed(Option.none<CommerceWorkflowRunState>())
      : decodeWorkflowRunState(state).pipe(Effect.map(Option.some));
  const put = (state: CommerceWorkflowRunState) => {
    states.set(state.runId, state);
    if (state.idempotencyKey) {
      idempotencyIndex.set(
        makeDuplicateKey({
          workflowKey: state.workflowKey,
          idempotencyKey: state.idempotencyKey,
        }),
        state
      );
    }
  };
  const store: CommerceWorkflowStateStore = {
    getRunState: (id) => Effect.suspend(() => read(states.get(id))),
    findRunStateByIdempotencyKey: (q) =>
      Effect.suspend(() => read(idempotencyIndex.get(makeDuplicateKey(q)))),
    registerRunState: (state) =>
      decodeWorkflowRunState(state).pipe(
        Effect.map((decoded) => {
          const old = decoded.idempotencyKey
            ? idempotencyIndex.get(
                makeDuplicateKey({
                  workflowKey: decoded.workflowKey,
                  idempotencyKey: decoded.idempotencyKey,
                })
              )
            : states.get(decoded.runId);
          if (old) {
            return { status: "duplicate" as const, state: old };
          }
          put(decoded);
          return { status: "created" as const, state: decoded };
        })
      ),
    upsertRunState: (state) =>
      decodeWorkflowRunState(state).pipe(Effect.map(put)),
  };
  return { states, idempotencyIndex, store };
};
/** Host-supplied dependencies for an isolated deterministic runtime. */
export interface InMemoryWorkflowRuntimeOptions {
  readonly clock: ClockService;
  readonly ids: IdGeneratorService;
  readonly publisher: WorkflowLifecyclePublisher;
  readonly metadataStore?: CommerceWorkflowMetadataStore;
  readonly stateStore?: CommerceWorkflowStateStore;
  /** Interrupts with an actual Effect interruption after a persisted checkpoint. */
  readonly interruptAfterCompletedSteps?: number;
}
const makeDuplicateKey = ({
  workflowKey,
  idempotencyKey,
}: CommerceWorkflowDuplicateQuery) => `${workflowKey}:${idempotencyKey}`;
const createLifecycleEvent = (
  payload: WorkflowLifecycleEventPayload,
  occurredAt: Date
) =>
  createEventEnvelope({
    // A stable identity lets an idempotent outbox accept replay after the
    // state checkpoint succeeded but the first publication was interrupted.
    id: [
      "workflow",
      payload.runId,
      payload.type,
      "stepId" in payload ? payload.stepId : "run",
      "attempt" in payload ? payload.attempt : "terminal",
    ].join(":"),
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

function reverseWorkflowAttempts<Attempt>(
  attempts: readonly Attempt[]
): Attempt[] {
  // ES2022-compatible non-mutating reverse for browser-facing test builds.
  // oxlint-disable-next-line unicorn/no-array-reverse
  return [...attempts].reverse();
}

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

/** Executes workflow steps in the caller fiber, preserving requirements and Causes. */
export const createInMemoryWorkflowRuntime = ({
  clock,
  ids,
  publisher,
  metadataStore,
  stateStore: providedStore,
  interruptAfterCompletedSteps,
}: InMemoryWorkflowRuntimeOptions): CommerceWorkflowRuntime => {
  const stateStore = providedStore ?? createInMemoryWorkflowStateStore().store;
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
      dispatchStatus: record.dispatchStatus,
      historyReference: record.historyReference,
      idempotencyKey: record.idempotencyKey,
      input: record.input,
      metadata: record.metadata,
      nextStepIndex,
      output: record.output,
      runId: record.runId,
      schemaVersion: record.schemaVersion,
      status: record.status,
      subject: record.subject,
      traceId: record.traceId,
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
    dispatchStatus: state.dispatchStatus,
    input: state.input,
    runId: state.runId,
    schemaVersion: state.schemaVersion,
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
    traceId: state.traceId,
  });

  const publish = (payload: WorkflowLifecycleEventPayload) =>
    Effect.gen(function* publishWorkflowEffect() {
      const event = createLifecycleEvent(payload, payload.occurredAt);
      yield* publisher.publish(event);
      if (metadataStore) {
        yield* metadataStore.appendEvent(event);
      }
    });
  const persist = (state: CommerceWorkflowRunState) =>
    Effect.gen(function* persistWorkflowEffect() {
      yield* stateStore.upsertRunState(state);
      if (metadataStore) {
        yield* metadataStore.upsertRun({ ...stateToRecord(state) });
      }
    });
  const get = <Output = unknown>(runId: string) =>
    stateStore
      .getRunState(runId)
      .pipe(
        Effect.map(
          Option.map(
            (state) =>
              stateToRecord(state) as CommerceWorkflowRunRecord<unknown, Output>
          )
        )
      );
  // The interpreter keeps persistence, retry, compensation, and publication
  // in one Effect so interruption cannot cross an untracked async boundary.
  // oxlint-disable-next-line eslint/complexity
  const start = <Input, Output, Requirements = never, Error = unknown>(
    request: CommerceWorkflowStartRequest<
      Input,
      Output,
      Record<string, unknown>,
      Requirements,
      Error
    >
  ) =>
    // oxlint-disable-next-line eslint/complexity
    Effect.gen(function* startWorkflowEffect() {
      yield* Schema.decodeUnknownEffect(
        CommerceWorkflowDefinitionDescriptorSchema
      )(describeWorkflowDefinition(request.workflow)).pipe(
        Effect.mapError(
          () =>
            new WorkflowRuntimeError({
              operation: "validation",
              message: "Invalid workflow definition",
              workflowKey: request.workflow.key,
            })
        )
      );
      const decodedInput = yield* Schema.decodeUnknownEffect(
        request.workflow.inputSchema
      )(request.input).pipe(
        Effect.mapError(
          () =>
            new WorkflowRuntimeError({
              operation: "validation",
              message: "Invalid workflow input",
              workflowKey: request.workflow.key,
            })
        )
      );
      let recovered = Option.none<CommerceWorkflowRunState>();
      if (request.runId) {
        recovered = yield* stateStore.getRunState(request.runId);
      } else if (request.idempotencyKey) {
        recovered = yield* stateStore.findRunStateByIdempotencyKey({
          workflowKey: request.workflow.key,
          idempotencyKey: request.idempotencyKey,
        });
      }
      const date = clock.now();
      let state: CommerceWorkflowRunState;
      if (Option.isSome(recovered)) {
        state = recovered.value;
      } else {
        const record: CommerceWorkflowRunRecord<Input, Output> = {
          ...request,
          input: decodedInput as Input,
          workflowKey: request.workflow.key,
          workflowVersion: request.workflow.version,
          schemaVersion:
            request.workflow.schemaVersion ?? request.workflow.version,
          runId: request.runId ?? ids.nextId(),
          createdAt: date,
          updatedAt: date,
          status: "running",
          attempts: [],
        };
        const registration = yield* stateStore.registerRunState({
          ...toRunState(record, 0),
          schemaVersion:
            request.workflow.schemaVersion ?? request.workflow.version,
        });
        ({ state } = registration);
        if (registration.status === "duplicate") {
          recovered = Option.some(state);
        }
      }
      if (
        state.workflowKey !== request.workflow.key ||
        state.workflowVersion !== request.workflow.version ||
        state.schemaVersion !==
          (request.workflow.schemaVersion ?? request.workflow.version)
      ) {
        return yield* Effect.fail(
          new WorkflowRuntimeError({
            operation: "validation",
            message: "Unsupported workflow recovery version",
            runId: state.runId,
          })
        );
      }
      yield* Schema.decodeUnknownEffect(request.workflow.inputSchema)(
        state.input
      ).pipe(
        Effect.mapError(
          () =>
            new WorkflowRuntimeError({
              operation: "validation",
              message: "Invalid persisted workflow input",
              runId: state.runId,
              workflowKey: state.workflowKey,
            })
        )
      );
      const base = {
        runId: state.runId,
        workflowKey: state.workflowKey,
        workflowVersion: state.workflowVersion,
        correlationId: state.correlationId,
        causationId: state.causationId,
        idempotencyKey: state.idempotencyKey,
        subject: state.subject,
        traceId: state.traceId,
      };
      if (state.status === "completed") {
        yield* Schema.decodeUnknownEffect(request.workflow.outputSchema)(
          state.output
        ).pipe(
          Effect.mapError(
            () =>
              new WorkflowRuntimeError({
                operation: "validation",
                message: "Invalid persisted workflow output",
                runId: state.runId,
                workflowKey: state.workflowKey,
              })
          )
        );
      }
      if (["completed", "failed", "compensated"].includes(state.status)) {
        if (state.status === "completed") {
          yield* publish({
            ...base,
            type: WORKFLOW_LIFECYCLE_EVENT_NAMES.completed,
            status: "completed",
            output: state.output,
            occurredAt: clock.now(),
          });
        } else {
          const failedAttempt = reverseWorkflowAttempts(state.attempts).find(
            (attempt) => attempt.phase === "run" && attempt.status === "failed"
          );
          if (failedAttempt?.error) {
            yield* publish({
              ...base,
              type: WORKFLOW_LIFECYCLE_EVENT_NAMES.failed,
              status: state.status === "compensated" ? "compensated" : "failed",
              error: failedAttempt.error,
              occurredAt: clock.now(),
            });
          }
        }
        return stateToRecord(state) as CommerceWorkflowRunRecord<Input, Output>;
      }
      const attempts = [...state.attempts];
      const save = (
        status: CommerceWorkflowRunState["status"],
        nextStepIndex = state.nextStepIndex,
        output: unknown = state.output
      ) => {
        state = {
          ...state,
          attempts: [...attempts],
          status,
          nextStepIndex,
          output,
          updatedAt: clock.now().toISOString(),
        };
        return persist(state);
      };
      if (Option.isNone(recovered)) {
        yield* persist(state);
        yield* publish({
          ...base,
          type: WORKFLOW_LIFECYCLE_EVENT_NAMES.started,
          status: "running",
          occurredAt: date,
        });
      } else {
        const latestAttempt = attempts.at(-1);
        if (!latestAttempt) {
          yield* publish({
            ...base,
            type: WORKFLOW_LIFECYCLE_EVENT_NAMES.started,
            status: "running",
            occurredAt: clock.now(),
          });
        } else if (
          latestAttempt.phase === "run" &&
          latestAttempt.status === "completed"
        ) {
          yield* publish({
            ...base,
            type: WORKFLOW_LIFECYCLE_EVENT_NAMES.stepSucceeded,
            status: "running",
            occurredAt: clock.now(),
            stepId: latestAttempt.stepId,
            stepName: latestAttempt.stepName,
            attempt: latestAttempt.attempt,
          });
        } else if (latestAttempt.phase === "run" && latestAttempt.error) {
          yield* publish({
            ...base,
            type: WORKFLOW_LIFECYCLE_EVENT_NAMES.stepFailed,
            status: "failed",
            occurredAt: clock.now(),
            stepId: latestAttempt.stepId,
            stepName: latestAttempt.stepName,
            attempt: latestAttempt.attempt,
            error: latestAttempt.error,
          });
        } else if (latestAttempt.phase === "compensation") {
          yield* publish({
            ...base,
            type: WORKFLOW_LIFECYCLE_EVENT_NAMES.compensationCompleted,
            status: "compensated",
            occurredAt: clock.now(),
            stepId: latestAttempt.stepId,
            stepName: latestAttempt.stepName,
          });
        }
      }
      let terminalError: CommerceWorkflowRunError | undefined =
        state.status === "compensating"
          ? reverseWorkflowAttempts(attempts).find(
              (a) => a.phase === "run" && a.status === "failed"
            )?.error
          : undefined;
      let completed = 0;
      for (
        let index = state.nextStepIndex;
        index < request.workflow.steps.length && !terminalError;
        index += 1
      ) {
        const step = request.workflow.steps[index];
        if (!step) {
          continue;
        }
        const stepId = `${state.runId}:${step.name}:${index + 1}`;
        let attempt =
          attempts.filter((a) => a.phase === "run" && a.stepId === stepId)
            .length + 1;
        const previous = attempts.at(-1);
        if (
          previous?.retryDisposition === "retry" &&
          previous.scheduledRetryAt
        ) {
          yield* Effect.sleep(
            Math.max(
              0,
              new Date(previous.scheduledRetryAt).getTime() -
                clock.now().getTime()
            )
          );
        }
        for (; ; attempt += 1) {
          const startedAt = clock.now().toISOString();
          const context = {
            ...base,
            workflowId: state.runId,
            stepId,
            stepName: step.name,
            attempt,
          };
          const result = yield* step.run(state.input as Input, context).pipe(
            Effect.result,
            Effect.withSpan("workflow.step", {
              attributes: {
                workflowKey: state.workflowKey,
                runId: state.runId,
                stepId,
                attempt,
              },
            })
          );
          if (result._tag === "Success") {
            attempts.push({
              attempt,
              startedAt,
              completedAt: clock.now().toISOString(),
              phase: "run",
              status: "completed",
              stepId,
              stepName: step.name,
              output: result.success.output,
            });
            yield* save("running", index + 1);
            yield* publish({
              ...base,
              type: WORKFLOW_LIFECYCLE_EVENT_NAMES.stepSucceeded,
              status: "running",
              occurredAt: clock.now(),
              stepId,
              stepName: step.name,
              attempt,
            });
            completed += 1;
            if (
              interruptAfterCompletedSteps !== undefined &&
              completed >= interruptAfterCompletedSteps
            ) {
              yield* Effect.interrupt;
            }
            break;
          }
          const error = createWorkflowRunError(result.failure);
          const retry = shouldRetryWorkflowError({
            attempt,
            error,
            policy: step.retryPolicy,
          });
          const delay = workflowRetryDelayMillis({
            attempt,
            policy: step.retryPolicy,
          });
          attempts.push({
            attempt,
            startedAt,
            completedAt: clock.now().toISOString(),
            phase: "run",
            status: "failed",
            stepId,
            stepName: step.name,
            error,
            retryDisposition: retry ? "retry" : "compensate",
            scheduledRetryAt: retry
              ? new Date(clock.now().getTime() + delay).toISOString()
              : undefined,
          });
          yield* save(retry ? "running" : "compensating", index);
          yield* publish({
            ...base,
            type: WORKFLOW_LIFECYCLE_EVENT_NAMES.stepFailed,
            status: "failed",
            occurredAt: clock.now(),
            stepId,
            stepName: step.name,
            attempt,
            error,
          });
          yield* recordCommerceRuntimeMetric({
            boundary: "workflow",
            event: retry ? "retry" : "typed_rejection",
            attributes: { status: "failed" },
          }).pipe(Effect.exit);
          if (retry) {
            yield* Effect.sleep(delay);
            continue;
          }
          terminalError = error;
          break;
        }
      }
      let status: CommerceWorkflowRunState["status"] = "completed";
      if (terminalError) {
        status = "failed";
        for (const outcome of reverseWorkflowAttempts(attempts)) {
          if (outcome.phase !== "run" || outcome.status !== "completed") {
            continue;
          }
          const compensation = request.workflow.steps.find(
            (step) => step.name === outcome.stepName
          )?.compensation;
          if (!compensation) {
            continue;
          }
          if (
            attempts.some(
              (a) =>
                a.phase === "compensation" &&
                a.stepId === outcome.stepId &&
                a.status === "compensated"
            )
          ) {
            status = "compensated";
            continue;
          }
          yield* publish({
            ...base,
            type: WORKFLOW_LIFECYCLE_EVENT_NAMES.compensationStarted,
            status: "compensating",
            occurredAt: clock.now(),
            stepId: outcome.stepId,
            stepName: outcome.stepName,
          });
          const compensationRunId = state.runId;
          yield* compensation
            .compensate(state.input as Input, outcome.output, {
              ...base,
              workflowId: state.runId,
              stepId: outcome.stepId,
              stepName: outcome.stepName,
              attempt: outcome.attempt,
            })
            .pipe(
              Effect.mapError(
                () =>
                  new WorkflowRuntimeError({
                    operation: "compensation",
                    message: "Workflow compensation failed",
                    runId: compensationRunId,
                  })
              )
            );
          attempts.push({
            ...outcome,
            phase: "compensation",
            status: "compensated",
            output: undefined,
            completedAt: clock.now().toISOString(),
          });
          yield* save("compensating");
          status = "compensated";
          yield* publish({
            ...base,
            type: WORKFLOW_LIFECYCLE_EVENT_NAMES.compensationCompleted,
            status: "compensated",
            occurredAt: clock.now(),
            stepId: outcome.stepId,
            stepName: outcome.stepName,
          });
        }
      }
      const unresolvedOutput = request.workflow.resolveOutput?.(
        attempts.map(stateOutcomeToAttempt)
      );
      const output = terminalError
        ? state.output
        : yield* Schema.decodeUnknownEffect(request.workflow.outputSchema)(
            unresolvedOutput
          ).pipe(
            Effect.mapError(
              () =>
                new WorkflowRuntimeError({
                  operation: "validation",
                  message: "Invalid workflow output",
                  runId: state.runId,
                  workflowKey: state.workflowKey,
                })
            )
          );
      state = { ...state, completedAt: clock.now().toISOString() };
      yield* save(status, state.nextStepIndex, output);
      const terminalEvent: WorkflowLifecycleEventPayload = terminalError
        ? {
            ...base,
            type: WORKFLOW_LIFECYCLE_EVENT_NAMES.failed,
            status: status === "compensated" ? "compensated" : "failed",
            error: terminalError,
            occurredAt: clock.now(),
          }
        : {
            ...base,
            type: WORKFLOW_LIFECYCLE_EVENT_NAMES.completed,
            status: "completed",
            output,
            occurredAt: clock.now(),
          };
      yield* publish(terminalEvent);
      return stateToRecord(state) as CommerceWorkflowRunRecord<Input, Output>;
    }).pipe(Effect.withSpan("workflow.start"));
  return {
    capabilities: Object.freeze({
      adapter: "memory",
      supportsPause: false,
      supportsEvents: true,
      supportsDurableHistory: true,
      supportsCompensation: true,
      supportsMetadataProjection: metadataStore !== undefined,
    }),
    start,
    get,
    reconcile: <Output = unknown>({
      runId,
    }: CommerceWorkflowReconcileRequest) => get<Output>(runId),
    dedupe: <Output = unknown>(query: CommerceWorkflowDuplicateQuery) =>
      stateStore
        .findRunStateByIdempotencyKey(query)
        .pipe(
          Effect.map(
            Option.map(
              (state) =>
                stateToRecord(state) as CommerceWorkflowRunRecord<
                  unknown,
                  Output
                >
            )
          )
        ),
  };
};

/**
 * Builds a deterministic runtime from explicit Effect services. Each Layer
 * acquisition owns its runtime, while callers may deliberately share durable
 * state by providing the same state-store Layer.
 */
export const InMemoryWorkflowRuntimeLayer = Layer.effect(
  WorkflowRuntimeService,
  Effect.gen(function* createInMemoryRuntimeServiceEffect() {
    return createInMemoryWorkflowRuntime({
      clock: yield* ClockServiceTag,
      ids: yield* IdGeneratorServiceTag,
      publisher: yield* WorkflowLifecyclePublisherService,
      stateStore: yield* WorkflowStateStoreService,
    });
  })
);

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
  const events: CommerceEventEnvelope[] = [];
  const publisher: WorkflowLifecyclePublisher = {
    publish: (event) =>
      Effect.sync(() => {
        if (!events.some((existing) => existing.id === event.id)) {
          events.push(event);
        }
      }),
  };
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

export {
  workflowRuntimeContractCases,
  type WorkflowRuntimeContractCase,
} from "./workflow-contracts";
