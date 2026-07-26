import {
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
import type {
  AuthContextService,
  ClockService,
  EventPublisherService,
  IdGeneratorService,
  LoggerService,
} from "../services/index";
import { clockLayer, idGeneratorLayer } from "../services/index";
import { DurableAudit } from "../telemetry/index";
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

  class InMemoryWorkflowRuntimeInterrupted extends Error {
    constructor() {
      super("In-memory workflow runtime interrupted after persisted step.");
      this.name = "InMemoryWorkflowRuntimeInterrupted";
    }
  }

  const terminalStatuses: ReadonlySet<CommerceWorkflowRunRecord["status"]> =
    new Set([
      "completed",
      "failed",
      "compensated",
    ] satisfies readonly CommerceWorkflowRunRecord["status"][]);

  const isTerminalStatus = (
    status: CommerceWorkflowRunRecord["status"]
  ): boolean => terminalStatuses.has(status);

  const toIso = (date: Date): string => date.toISOString();

  const fromIso = (value: string): Date => new Date(value);

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
      ? toIso(attempt.scheduledRetryAt)
      : undefined,
    startedAt: toIso(attempt.startedAt),
    status: attempt.status,
    stepId: attempt.stepId,
    stepName: attempt.stepName,
    completedAt: attempt.completedAt ? toIso(attempt.completedAt) : undefined,
  });

  const stateOutcomeToAttempt = (
    outcome: CommerceWorkflowRunState["attempts"][number]
  ): CommerceWorkflowStepAttempt => ({
    attempt: outcome.attempt,
    completedAt: outcome.completedAt ? fromIso(outcome.completedAt) : undefined,
    error: outcome.error,
    output: outcome.output,
    phase: outcome.phase,
    retryDisposition: outcome.retryDisposition,
    scheduledRetryAt: outcome.scheduledRetryAt
      ? fromIso(outcome.scheduledRetryAt)
      : undefined,
    startedAt: fromIso(outcome.startedAt),
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
      completedAt: record.completedAt ? toIso(record.completedAt) : undefined,
      correlationId: record.correlationId,
      createdAt: toIso(record.createdAt),
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
      updatedAt: toIso(record.updatedAt),
      workflowKey: record.workflowKey,
      workflowVersion: record.workflowVersion,
    });

  const stateToRecord = (
    state: CommerceWorkflowRunState
  ): CommerceWorkflowRunRecord => ({
    attempts: state.attempts.map(stateOutcomeToAttempt),
    correlationId: state.correlationId,
    createdAt: fromIso(state.createdAt),
    input: state.input,
    runId: state.runId,
    status: state.status,
    updatedAt: fromIso(state.updatedAt),
    workflowKey: state.workflowKey,
    workflowVersion: state.workflowVersion,
    causationId: state.causationId,
    completedAt: state.completedAt ? fromIso(state.completedAt) : undefined,
    historyReference: state.historyReference,
    idempotencyKey: state.idempotencyKey,
    metadata: state.metadata,
    output: state.output,
    subject: state.subject,
  });

  const persistRecord = async (
    record: CommerceWorkflowRunRecord,
    nextStepIndex = record.attempts?.filter(
      (attempt) => attempt.phase !== "compensation"
    ).length ?? 0
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

  const executeWorkflowSteps = async <Input, Output>({
    attempts,
    baseRecord,
    request,
    runId,
    startIndex,
  }: {
    attempts: CommerceWorkflowStepAttempt[];
    baseRecord: Omit<
      CommerceWorkflowRunRecord<Input, Output>,
      "attempts" | "completedAt" | "output" | "status" | "updatedAt"
    >;
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
      const stepStartedAt = clock.now();
      const context = {
        workflowId: runId,
        workflowKey: request.workflow.key,
        workflowVersion: request.workflow.version,
        stepId: `${runId}:${step.name}:${stepIndex + 1}`,
        stepName: step.name,
        attempt: 1,
        correlationId: request.correlationId,
        causationId: request.causationId,
        idempotencyKey: request.idempotencyKey,
        subject: request.subject,
      };

      let stepResult: { readonly output: unknown };
      try {
        stepResult = await Effect.runPromise(step.run(request.input, context));
      } catch (error) {
        const failedAt = clock.now();
        const workflowError = createWorkflowRunError(error);
        attempts.push({
          attempt: 1,
          completedAt: failedAt,
          error: workflowError,
          phase: "run",
          retryDisposition: "compensate",
          startedAt: stepStartedAt,
          status: "failed",
          stepId: context.stepId,
          stepName: step.name,
        });
        await persistRecord(
          {
            ...baseRecord,
            attempts,
            completedAt: failedAt,
            status: "failed",
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
          attempt: 1,
          error: workflowError,
        });
        throw error;
      }

      const completedAt = clock.now();
      attempts.push({
        attempt: 1,
        completedAt,
        output: stepResult.output,
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
        attempt: 1,
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
      completedStepsInThisRuntime += 1;
      if (
        interruptAfterCompletedSteps !== undefined &&
        completedStepsInThisRuntime >= interruptAfterCompletedSteps
      ) {
        throw new InMemoryWorkflowRuntimeInterrupted();
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
    baseRecord: Omit<
      CommerceWorkflowRunRecord<Input, Output>,
      "attempts" | "completedAt" | "output" | "status" | "updatedAt"
    >;
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

      status = "compensated";
      await persistRecord(
        {
          ...baseRecord,
          attempts,
          status,
          updatedAt: clock.now(),
        }
      );
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
      if (request.idempotencyKey) {
        const duplicate =
          (await reconcile({
            runId:
              idempotencyIndex.get(
                makeDuplicateKey({
                  workflowKey: request.workflow.key,
                  idempotencyKey: request.idempotencyKey,
                })
              ) ?? "",
          })) ??
          (await (stateStore?.findRunStateByIdempotencyKey({
            workflowKey: request.workflow.key,
            idempotencyKey: request.idempotencyKey,
          }) ?? Promise.resolve(null)));

        if (duplicate) {
          const duplicateRecord =
            "attempts" in duplicate && "schemaVersion" in duplicate
              ? stateToRecord(duplicate)
              : duplicate;
          if (isTerminalStatus(duplicateRecord.status)) {
            return duplicateRecord as CommerceWorkflowRunRecord<Input, Output>;
          }
        }
      }

      const recoveredState = request.runId
        ? ((await stateStore?.getRunState(request.runId)) ?? null)
        : request.idempotencyKey
          ? ((await stateStore?.findRunStateByIdempotencyKey({
              workflowKey: request.workflow.key,
              idempotencyKey: request.idempotencyKey,
            })) ?? null)
          : null;
      const recoveredRecord = recoveredState
        ? stateToRecord(recoveredState)
        : null;
      const createdAt = recoveredRecord?.createdAt ?? clock.now();
      const runId = recoveredRecord?.runId ?? request.runId ?? ids.nextId();
      const attempts: CommerceWorkflowStepAttempt[] = [
        ...(recoveredRecord?.attempts ?? []),
      ];
      let status: CommerceWorkflowRunRecord<Input, Output>["status"] =
        "running";
      let output: Output | undefined = recoveredRecord?.output as
        | Output
        | undefined;
      let workflowError: CommerceWorkflowRunError | undefined;

      const baseRecord = {
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
      } as const;

      if (recoveredRecord && isTerminalStatus(recoveredRecord.status)) {
        await persistRecord(recoveredRecord, recoveredState?.nextStepIndex);
        return recoveredRecord as CommerceWorkflowRunRecord<Input, Output>;
      }

      if (!recoveredRecord) {
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
      }

      try {
        output = await executeWorkflowSteps({
          attempts,
          baseRecord,
          request,
          runId,
          startIndex: recoveredState?.nextStepIndex ?? 0,
        });
        status = "completed";
      } catch (error) {
        if (error instanceof InMemoryWorkflowRuntimeInterrupted) {
          throw error;
        }
        workflowError = createWorkflowRunError(error);
        status = "failed";

        status = await compensateWorkflow({
          attempts,
          baseRecord,
          request,
          runId,
        });
      }

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
