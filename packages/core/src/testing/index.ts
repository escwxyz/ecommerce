import {
  Clock,
  ConfigProvider,
  Effect,
  Layer,
  Logger,
  References,
  Ref,
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
  CommerceWorkflowRuntime,
  CommerceWorkflowStartRequest,
  CommerceWorkflowStepAttempt,
  WorkflowLifecycleEventPayload,
} from "../workflows/index";
import {
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

export interface TestLogEntry {
  readonly annotations: Readonly<Record<string, unknown>>;
  readonly message: unknown;
}

export interface TestTelemetryCapture {
  readonly auditEvents: DurableAuditEvent[];
  readonly layer: Layer.Layer<DurableAudit>;
  readonly logs: TestLogEntry[];
  readonly spans: Tracer.Span[];
}

export interface InMemoryRepositoryTestLayer<Identifier, State> {
  readonly layer: Layer.Layer<Identifier>;
  readonly reset: Effect.Effect<void>;
  readonly snapshot: Effect.Effect<State>;
  readonly state: Ref.Ref<State>;
}

export const createStaticClock = (date: Date): ClockService => ({
  now: () => date,
});

const dateToNanoseconds = (date: Date): bigint =>
  BigInt(date.getTime()) * 1_000_000n;

export const createDeterministicEffectClock = (date: Date): Clock.Clock => ({
  currentTimeMillis: Effect.sync(() => date.getTime()),
  currentTimeMillisUnsafe: () => date.getTime(),
  currentTimeNanos: Effect.sync(() => dateToNanoseconds(date)),
  currentTimeNanosUnsafe: () => dateToNanoseconds(date),
  sleep: () => Effect.void,
});

export const createDeterministicClockLayer = (date: Date) =>
  Layer.mergeAll(
    Layer.succeed(Clock.Clock, createDeterministicEffectClock(date)),
    clockLayer(createStaticClock(date))
  );

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

export const createSequenceIdGeneratorLayer = (ids: readonly string[]) =>
  idGeneratorLayer(createSequenceIdGenerator(ids));

export const createTestConfigLayer = (
  values: Readonly<Record<string, unknown>>
) => ConfigProvider.layer(ConfigProvider.fromUnknown(values));

export const createTestLogger = (): LoggerService => ({
  log: () => {
    // no-op yet
  },
});

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

export const createStaticAuthContext = (
  actor: unknown | null
): AuthContextService => ({
  getActor: () => actor,
});

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

interface InMemoryWorkflowRuntimeOptions {
  readonly clock: ClockService;
  readonly ids: IdGeneratorService;
  readonly publisher: EventPublisherService;
  readonly metadataStore?: CommerceWorkflowMetadataStore;
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
}: InMemoryWorkflowRuntimeOptions): CommerceWorkflowRuntime => {
  const runs = new Map<string, CommerceWorkflowRunRecord>();
  const idempotencyIndex = new Map<string, string>();

  const persistRecord = async (
    record: CommerceWorkflowRunRecord
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
  };

  const publishLifecycle = async (
    payload: WorkflowLifecycleEventPayload
  ): Promise<void> => {
    const { occurredAt } = payload;
    const event = createLifecycleEvent(ids, payload, occurredAt);
    await publisher.publish(event);
    await metadataStore?.appendEvent(event);
  };

  const reconcile = (
    request: CommerceWorkflowReconcileRequest
  ): Promise<CommerceWorkflowRunRecord | null> =>
    Promise.resolve(runs.get(request.runId) ?? null);

  const executeWorkflowSteps = async <Input, Output>({
    attempts,
    request,
    runId,
  }: {
    attempts: CommerceWorkflowStepAttempt[];
    request: CommerceWorkflowStartRequest<Input, Output>;
    runId: string;
  }): Promise<Output | undefined> => {
    for (const step of request.workflow.steps) {
      const stepStartedAt = clock.now();
      const context = {
        workflowId: runId,
        workflowKey: request.workflow.key,
        workflowVersion: request.workflow.version,
        stepId: `${runId}:${step.name}:${attempts.length + 1}`,
        stepName: step.name,
        attempt: 1,
        correlationId: request.correlationId,
        causationId: request.causationId,
        idempotencyKey: request.idempotencyKey,
        subject: request.subject,
      };

      const stepResult = await Effect.runPromise(
        step.run(request.input, context)
      );

      const completedAt = clock.now();
      attempts.push({
        attempt: 1,
        completedAt,
        output: stepResult.output,
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
    }

    return request.workflow.resolveOutput?.(attempts);
  };

  const compensateWorkflow = async <Input, Output>({
    attempts,
    request,
    runId,
  }: {
    attempts: CommerceWorkflowStepAttempt[];
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
        startedAt: completedAttempt.startedAt,
        status: "compensated",
        stepId: completedAttempt.stepId,
        stepName: completedAttempt.stepName,
      });

      status = "compensated";
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
      supportsDurableHistory: false,
      supportsEvents: true,
      supportsMetadataProjection: metadataStore !== undefined,
      supportsPause: false,
    },
    dedupe: <Output = unknown>(query: CommerceWorkflowDuplicateQuery) => {
      const runId = idempotencyIndex.get(makeDuplicateKey(query));
      return Promise.resolve(
        runId
          ? ((runs.get(runId) as CommerceWorkflowRunRecord<unknown, Output>) ??
              null)
          : null
      );
    },
    get: <Output = unknown>(runId: string) =>
      Promise.resolve(
        (runs.get(runId) as CommerceWorkflowRunRecord<unknown, Output>) ?? null
      ),
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
        const duplicate = await reconcile({
          runId:
            idempotencyIndex.get(
              makeDuplicateKey({
                workflowKey: request.workflow.key,
                idempotencyKey: request.idempotencyKey,
              })
            ) ?? "",
        });

        if (duplicate) {
          return duplicate as CommerceWorkflowRunRecord<Input, Output>;
        }
      }

      const createdAt = clock.now();
      const runId = request.runId ?? ids.nextId();
      const attempts: CommerceWorkflowStepAttempt[] = [];
      let status: CommerceWorkflowRunRecord<Input, Output>["status"] =
        "running";
      let output: Output | undefined;
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

      try {
        output = await executeWorkflowSteps({
          attempts,
          request,
          runId,
        });
        status = "completed";
      } catch (error) {
        workflowError = createWorkflowRunError(error);
        status = "failed";

        const failedStep = attempts.at(-1);
        await publishLifecycle({
          type: WORKFLOW_LIFECYCLE_EVENT_NAMES.stepFailed,
          occurredAt: clock.now(),
          status,
          runId,
          workflowKey: request.workflow.key,
          workflowVersion: request.workflow.version,
          correlationId: request.correlationId,
          causationId: request.causationId,
          idempotencyKey: request.idempotencyKey,
          subject: request.subject,
          stepId: failedStep?.stepId ?? `${runId}:unknown`,
          stepName: failedStep?.stepName ?? "unknown",
          attempt: failedStep?.attempt ?? 1,
          error: workflowError,
        });

        status = await compensateWorkflow({
          attempts,
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
