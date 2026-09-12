import {
  CommerceWorkflowRunStateSchema,
  WORKFLOW_LIFECYCLE_EVENT_NAMES,
  createEventEnvelope,
  createWorkflowRunError,
  WorkflowRuntimeError,
  WorkflowRuntimeService,
} from "@ecommerce/core";
import type {
  CommerceWorkflowDuplicateQuery,
  CommerceWorkflowDefinition,
  CommerceWorkflowMetadataRecord,
  CommerceWorkflowMetadataStore,
  CommerceWorkflowReconcileRequest,
  CommerceWorkflowRunError,
  CommerceWorkflowRunRecord,
  CommerceWorkflowRunState,
  CommerceWorkflowRunStatus,
  CommerceWorkflowRuntime,
  CommerceWorkflowRuntimeCapabilities,
  CommerceWorkflowStartRequest,
  CommerceWorkflowStateStore,
  WorkflowLifecyclePublisher,
} from "@ecommerce/core";
import { Effect, Layer, Option, Schema, Semaphore } from "effect";

export interface CloudflareWorkflowRuntimeBindings {
  readonly workflow: Workflow<CloudflareWorkflowPayload>;
  readonly dispatchQueue?: Queue<CloudflareWorkflowDispatchMessage>;
  readonly coordinator?: DurableObjectNamespace;
}

export const CloudflareWorkflowPayloadSchema = Schema.Struct({
  causationId: Schema.optional(Schema.String),
  correlationId: Schema.String,
  idempotencyKey: Schema.optional(Schema.String),
  input: Schema.Unknown,
  metadata: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  runId: Schema.String,
  schemaVersion: Schema.Number,
  subject: Schema.optional(
    Schema.Struct({ id: Schema.String, type: Schema.String })
  ),
  traceId: Schema.optional(Schema.String),
  workflowKey: Schema.String,
  workflowVersion: Schema.Number,
});

export type CloudflareWorkflowPayload =
  typeof CloudflareWorkflowPayloadSchema.Type;

export const CloudflareWorkflowDispatchMessageSchema = Schema.Struct({
  correlationId: Schema.String,
  runId: Schema.String,
  schemaVersion: Schema.Number,
  traceId: Schema.optional(Schema.String),
  workflowKey: Schema.String,
  workflowVersion: Schema.Number,
});

export type CloudflareWorkflowDispatchMessage =
  typeof CloudflareWorkflowDispatchMessageSchema.Type;

export interface CloudflareWorkflowRuntimeOptions {
  readonly bindings: CloudflareWorkflowRuntimeBindings;
  readonly clock: {
    now(): Date;
  };
  readonly ids: {
    nextId(): string;
  };
  readonly publisher: WorkflowLifecyclePublisher;
  readonly metadataStore?: CommerceWorkflowMetadataStore;
  readonly stateStore?: CommerceWorkflowStateStore;
  readonly telemetry?: CloudflareWorkflowTelemetrySink;
  /** Definitions available after adapter restart for durable payload decoding. */
  readonly workflowDefinitions?: readonly CommerceWorkflowDefinition[];
}

/** Compatibility export; all adapters share the portable failure vocabulary. */
export { WorkflowRuntimeError as CloudflareWorkflowRuntimeFailure };

export interface CloudflareWorkflowTelemetryEvent {
  readonly kind:
    | "workflow.coordinator.failed"
    | "workflow.coordinator.succeeded"
    | "workflow.event.failed"
    | "workflow.event.succeeded"
    | "workflow.queue.failed"
    | "workflow.queue.succeeded"
    | "workflow.reconcile.failed"
    | "workflow.reconcile.succeeded"
    | "workflow.state.failed"
    | "workflow.state.succeeded"
    | "workflow.start.failed"
    | "workflow.start.succeeded";
  readonly correlationId?: string;
  readonly idempotencyKey?: string;
  readonly runId?: string;
  readonly status?: CommerceWorkflowRunStatus;
  readonly traceId?: string;
  readonly workflowKey?: string;
  readonly workflowVersion?: number;
}

export interface CloudflareWorkflowTelemetrySink {
  record(event: CloudflareWorkflowTelemetryEvent): Effect.Effect<void, unknown>;
}

const CLOUDFLARE_TO_CORE_STATUS: Record<
  Awaited<ReturnType<WorkflowInstance["status"]>>["status"],
  CommerceWorkflowRunStatus
> = {
  complete: "completed",
  errored: "failed",
  paused: "running",
  queued: "pending",
  running: "running",
  terminated: "failed",
  unknown: "failed",
  waiting: "running",
  waitingForPause: "running",
};

const cloudflareRuntimeCapabilities: CommerceWorkflowRuntimeCapabilities = {
  adapter: "cloudflare",
  supportsCompensation: true,
  supportsDurableHistory: true,
  supportsEvents: true,
  supportsMetadataProjection: true,
  supportsPause: true,
};

const makeDuplicateKey = ({
  workflowKey,
  idempotencyKey,
}: CommerceWorkflowDuplicateQuery) => `${workflowKey}:${idempotencyKey}`;

const toMetadataRecord = (
  run: CommerceWorkflowRunRecord
): CommerceWorkflowMetadataRecord => ({
  runId: run.runId,
  workflowKey: run.workflowKey,
  workflowVersion: run.workflowVersion,
  schemaVersion: run.schemaVersion,
  status: run.status,
  dispatchStatus: run.dispatchStatus,
  correlationId: run.correlationId,
  causationId: run.causationId,
  idempotencyKey: run.idempotencyKey,
  subject: run.subject,
  traceId: run.traceId,
  metadata: run.metadata,
  updatedAt: run.updatedAt,
});

const fromMetadataRecord = (
  record: CommerceWorkflowMetadataRecord
): CommerceWorkflowRunRecord => ({
  attempts: undefined,
  correlationId: record.correlationId,
  createdAt: record.updatedAt,
  historyReference: `cloudflare:${record.runId}`,
  input: undefined,
  metadata: record.metadata,
  runId: record.runId,
  status: record.status,
  dispatchStatus: record.dispatchStatus,
  traceId: record.traceId,
  updatedAt: record.updatedAt,
  workflowKey: record.workflowKey,
  workflowVersion: record.workflowVersion,
  schemaVersion: record.schemaVersion,
  causationId: record.causationId,
  idempotencyKey: record.idempotencyKey,
  subject: record.subject,
});

const toIso = (date: Date): string => date.toISOString();

const fromIso = (value: string): Date => new Date(value);

const toRunState = (
  record: CommerceWorkflowRunRecord,
  nextStepIndex = record.attempts?.length ?? 0
): CommerceWorkflowRunState =>
  Schema.decodeUnknownSync(CommerceWorkflowRunStateSchema)({
    attempts: (record.attempts ?? []).map((attempt) => ({
      attempt: attempt.attempt,
      completedAt: attempt.completedAt ? toIso(attempt.completedAt) : undefined,
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
    })),
    causationId: record.causationId,
    completedAt: record.completedAt ? toIso(record.completedAt) : undefined,
    correlationId: record.correlationId,
    createdAt: toIso(record.createdAt),
    dispatchStatus: record.dispatchStatus,
    historyReference: record.historyReference,
    idempotencyKey: record.idempotencyKey,
    traceId: record.traceId,
    input: record.input,
    metadata: record.metadata,
    nextStepIndex,
    output: record.output,
    runId: record.runId,
    schemaVersion: record.schemaVersion,
    status: record.status,
    subject: record.subject,
    updatedAt: toIso(record.updatedAt),
    workflowKey: record.workflowKey,
    workflowVersion: record.workflowVersion,
  });

const fromRunState = (
  state: CommerceWorkflowRunState
): CommerceWorkflowRunRecord => ({
  attempts: state.attempts.map((attempt) => ({
    attempt: attempt.attempt,
    completedAt: attempt.completedAt ? fromIso(attempt.completedAt) : undefined,
    error: attempt.error,
    output: attempt.output,
    phase: attempt.phase,
    retryDisposition: attempt.retryDisposition,
    scheduledRetryAt: attempt.scheduledRetryAt
      ? fromIso(attempt.scheduledRetryAt)
      : undefined,
    startedAt: fromIso(attempt.startedAt),
    status: attempt.status,
    stepId: attempt.stepId,
    stepName: attempt.stepName,
  })),
  causationId: state.causationId,
  completedAt: state.completedAt ? fromIso(state.completedAt) : undefined,
  correlationId: state.correlationId,
  createdAt: fromIso(state.createdAt),
  dispatchStatus: state.dispatchStatus,
  historyReference: state.historyReference,
  idempotencyKey: state.idempotencyKey,
  input: state.input,
  metadata: state.metadata,
  output: state.output,
  runId: state.runId,
  status: state.status,
  subject: state.subject,
  traceId: state.traceId,
  updatedAt: fromIso(state.updatedAt),
  workflowKey: state.workflowKey,
  workflowVersion: state.workflowVersion,
  schemaVersion: state.schemaVersion,
});

/** Wrap only platform promises; rejection details must not expose binding secrets. */
const platformCall = <A>(
  operation: WorkflowRuntimeError["operation"],
  runId: string,
  call: (signal: AbortSignal) => Promise<A>
) =>
  Effect.tryPromise({
    try: call,
    catch: () =>
      new WorkflowRuntimeError({
        operation,
        runId,
        message: `Cloudflare workflow ${operation} failed.`,
      }),
  });

const recordTelemetry = (
  telemetry: CloudflareWorkflowTelemetrySink | undefined,
  event: CloudflareWorkflowTelemetryEvent
) =>
  telemetry
    ? Effect.suspend(() => telemetry.record(event)).pipe(
        Effect.timeout("1 second"),
        Effect.catchCause(() => Effect.void)
      )
    : Effect.void;

/** Durable state is authoritative; metadata is only a discovery projection. */
const acquireWorkflowRuntime = ({
  bindings,
  clock,
  ids,
  publisher,
  metadataStore,
  stateStore,
  telemetry,
  workflowDefinitions = [],
}: CloudflareWorkflowRuntimeOptions) => {
  const runs = new Map<string, CommerceWorkflowRunRecord>();
  const idempotencyIndex = new Map<string, string>();
  const definitions = new Map<
    string,
    Pick<
      CommerceWorkflowDefinition,
      "inputSchema" | "key" | "outputSchema" | "schemaVersion" | "version"
    >
  >();
  const definitionsByKey = new Map(
    workflowDefinitions.map((definition) => [definition.key, definition])
  );
  const starts = Semaphore.makeUnsafe(1);
  const observe = (
    kind: CloudflareWorkflowTelemetryEvent["kind"],
    run: CommerceWorkflowRunRecord
  ) =>
    recordTelemetry(telemetry, {
      kind,
      runId: run.runId,
      workflowKey: run.workflowKey,
      workflowVersion: run.workflowVersion,
      correlationId: run.correlationId,
      traceId: run.traceId,
      idempotencyKey: run.idempotencyKey,
      status: run.status,
    });
  const remember = (run: CommerceWorkflowRunRecord) => {
    runs.set(run.runId, run);
    if (run.idempotencyKey) {
      idempotencyIndex.set(
        makeDuplicateKey({
          workflowKey: run.workflowKey,
          idempotencyKey: run.idempotencyKey,
        }),
        run.runId
      );
    }
    return run;
  };
  const decodeState = (state: unknown) =>
    Schema.decodeUnknownEffect(CommerceWorkflowRunStateSchema)(state).pipe(
      Effect.mapError(
        () =>
          new WorkflowRuntimeError({
            operation: "state",
            message: "Invalid persisted workflow state.",
          })
      ),
      Effect.flatMap((decoded) => {
        const definition =
          definitions.get(decoded.runId) ??
          definitionsByKey.get(decoded.workflowKey);
        if (
          definition &&
          (decoded.workflowKey !== definition.key ||
            decoded.workflowVersion !== definition.version ||
            decoded.schemaVersion !==
              (definition.schemaVersion ?? definition.version))
        ) {
          return Effect.fail(
            new WorkflowRuntimeError({
              operation: "state",
              runId: decoded.runId,
              message: "Unsupported workflow state version.",
            })
          );
        }
        return Effect.succeed(decoded);
      }),
      Effect.flatMap((decoded) => {
        const definition =
          definitions.get(decoded.runId) ??
          definitionsByKey.get(decoded.workflowKey);
        if (!definition) {
          return Effect.succeed(decoded);
        }
        const outputValidation =
          decoded.status === "completed"
            ? Schema.decodeUnknownEffect(definition.outputSchema)(
                decoded.output
              )
            : Effect.void;
        return Schema.decodeUnknownEffect(definition.inputSchema)(
          decoded.input
        ).pipe(
          Effect.andThen(outputValidation),
          Effect.as(decoded),
          Effect.mapError(
            () =>
              new WorkflowRuntimeError({
                operation: "state",
                runId: decoded.runId,
                message: "Invalid persisted workflow payload.",
              })
          )
        );
      }),
      Effect.map((decoded) => remember(fromRunState(decoded)))
    );
  const persist = (run: CommerceWorkflowRunRecord) =>
    Effect.gen(function* persistCloudflareWorkflowEffect() {
      // Save replay state before updating the query projection.
      if (stateStore) {
        const state = yield* Effect.try({
          try: () => toRunState(run),
          catch: () =>
            new WorkflowRuntimeError({
              operation: "state",
              runId: run.runId,
              message: "Invalid workflow state.",
            }),
        });
        yield* stateStore
          .upsertRunState(state)
          .pipe(Effect.tapError(() => observe("workflow.state.failed", run)));
        yield* observe("workflow.state.succeeded", run);
      }
      if (metadataStore) {
        yield* metadataStore.upsertRun(toMetadataRecord(run));
      }
      remember(run);
    }).pipe(Effect.withSpan("workflow.persistence"));
  const publish = (
    run: CommerceWorkflowRunRecord,
    name:
      | typeof WORKFLOW_LIFECYCLE_EVENT_NAMES.started
      | typeof WORKFLOW_LIFECYCLE_EVENT_NAMES.completed
      | typeof WORKFLOW_LIFECYCLE_EVENT_NAMES.failed,
    runError?: CommerceWorkflowRunError
  ) =>
    Effect.gen(function* publishCloudflareWorkflowEffect() {
      const event = createEventEnvelope({
        id: `workflow:${run.runId}:${name}:run:terminal`,
        name,
        emittedAt: run.updatedAt,
        correlationId: run.correlationId,
        causationId: run.causationId,
        traceId: run.traceId,
        workflowRunId: run.runId,
        subject: run.subject,
        payload: {
          correlationId: run.correlationId,
          occurredAt: run.updatedAt,
          runId: run.runId,
          status: run.status,
          workflowKey: run.workflowKey,
          workflowVersion: run.workflowVersion,
          causationId: run.causationId,
          idempotencyKey: run.idempotencyKey,
          subject: run.subject,
          traceId: run.traceId,
          type: name,
          ...(runError ? { error: runError } : {}),
          ...(name === WORKFLOW_LIFECYCLE_EVENT_NAMES.completed &&
          run.output !== undefined
            ? { output: run.output }
            : {}),
        },
      });
      yield* publisher
        .publish(event)
        .pipe(Effect.tapError(() => observe("workflow.event.failed", run)));
      if (metadataStore) {
        yield* metadataStore.appendEvent(event);
      }
      yield* observe("workflow.event.succeeded", run);
    }).pipe(Effect.withSpan("workflow.lifecycle"));
  const status = (
    runId: string,
    operation: WorkflowRuntimeError["operation"]
  ) =>
    platformCall(operation, runId, async () => {
      // Cloudflare create/get/status cannot be cancelled. A later reconcile reads
      // durable platform state rather than assuming interruption cancelled the run.
      const instance = await bindings.workflow.get(runId);
      return instance.status();
    });
  const dispatch = (registeredRun: CommerceWorkflowRunRecord) =>
    Effect.gen(function* dispatchCloudflareWorkflowEffect() {
      let run = registeredRun;
      if (
        run.dispatchStatus === undefined ||
        run.dispatchStatus === "registered"
      ) {
        const params = yield* Schema.decodeUnknownEffect(
          CloudflareWorkflowPayloadSchema
        )({
          causationId: run.causationId,
          correlationId: run.correlationId,
          idempotencyKey: run.idempotencyKey,
          input: run.input,
          metadata: run.metadata,
          runId: run.runId,
          schemaVersion: run.schemaVersion,
          subject: run.subject,
          traceId: run.traceId,
          workflowKey: run.workflowKey,
          workflowVersion: run.workflowVersion,
        }).pipe(
          Effect.mapError(
            () =>
              new WorkflowRuntimeError({
                operation: "validation",
                runId: run.runId,
                message: "Invalid Cloudflare workflow payload.",
              })
          )
        );
        const instance = yield* platformCall("start", run.runId, () =>
          bindings.workflow.create({ id: run.runId, params })
        ).pipe(Effect.tapError(() => observe("workflow.start.failed", run)));
        run = {
          ...run,
          dispatchStatus: "workflow-created",
          historyReference: `cloudflare:${instance.id}`,
          updatedAt: clock.now(),
        };
        yield* persist(run);
      }
      if (run.dispatchStatus === "workflow-created") {
        if (bindings.dispatchQueue) {
          const queue = bindings.dispatchQueue;
          const message = yield* Schema.decodeUnknownEffect(
            CloudflareWorkflowDispatchMessageSchema
          )({
            correlationId: run.correlationId,
            runId: run.runId,
            schemaVersion: run.schemaVersion,
            traceId: run.traceId,
            workflowKey: run.workflowKey,
            workflowVersion: run.workflowVersion,
          }).pipe(
            Effect.mapError(
              () =>
                new WorkflowRuntimeError({
                  operation: "validation",
                  runId: run.runId,
                  message: "Invalid Cloudflare queue payload.",
                })
            )
          );
          yield* platformCall("queue", run.runId, () =>
            queue.send(message)
          ).pipe(Effect.tapError(() => observe("workflow.queue.failed", run)));
          yield* observe("workflow.queue.succeeded", run);
        }
        run = {
          ...run,
          dispatchStatus: "queue-dispatched",
          updatedAt: clock.now(),
        };
        yield* persist(run);
      }
      if (run.dispatchStatus === "queue-dispatched") {
        if (bindings.coordinator) {
          const namespace = bindings.coordinator;
          yield* platformCall("coordinator", run.runId, async (signal) => {
            const stub = namespace.getByName(run.runId);
            const response = await stub.fetch(
              new Request(
                `https://workflow-coordinator.internal/runs/${run.runId}`,
                {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ runId: run.runId, status: "pending" }),
                  signal,
                }
              )
            );
            if (!response.ok) {
              throw new Error("Coordinator rejected request.");
            }
          }).pipe(
            Effect.tapError(() => observe("workflow.coordinator.failed", run))
          );
          yield* observe("workflow.coordinator.succeeded", run);
        }
        run = { ...run, dispatchStatus: "coordinated", updatedAt: clock.now() };
        yield* persist(run);
      }
      return run;
    });
  const recoverMetadata = (record: CommerceWorkflowMetadataRecord) =>
    Effect.gen(function* recoverMetadataWorkflowEffect() {
      if (stateStore) {
        const durable = yield* stateStore.getRunState(record.runId);
        if (Option.isSome(durable)) {
          return yield* decodeState(durable.value);
        }
      }
      const current = yield* status(record.runId, "lookup");
      const recovered = {
        ...fromMetadataRecord(record),
        status: CLOUDFLARE_TO_CORE_STATUS[current.status],
        output: current.output,
        updatedAt: clock.now(),
      };
      yield* persist(recovered);
      return recovered;
    });
  const get = (runId: string) =>
    Effect.gen(function* getCloudflareWorkflowEffect() {
      if (stateStore) {
        const durable = yield* stateStore.getRunState(runId);
        if (Option.isSome(durable)) {
          return Option.some(yield* decodeState(durable.value));
        }
      }
      const local = runs.get(runId);
      if (local) {
        return Option.some(local);
      }
      if (metadataStore) {
        const record = yield* metadataStore.getRun(runId);
        if (Option.isSome(record)) {
          return Option.some(yield* recoverMetadata(record.value));
        }
      }
      // A missing registration is absence. Arbitrary platform exceptions are never
      // interpreted as missing runs or fabricated workflow identities.
      return Option.none<CommerceWorkflowRunRecord>();
    }).pipe(Effect.withSpan("workflow.lookup"));
  const dedupe = (query: CommerceWorkflowDuplicateQuery) =>
    Effect.gen(function* dedupeCloudflareWorkflowEffect() {
      if (stateStore) {
        const durable = yield* stateStore.findRunStateByIdempotencyKey(query);
        if (Option.isSome(durable)) {
          return Option.some(yield* decodeState(durable.value));
        }
      }
      const localId = idempotencyIndex.get(makeDuplicateKey(query));
      if (localId) {
        return yield* get(localId);
      }
      if (metadataStore) {
        const record = yield* metadataStore.findRunByIdempotencyKey(query);
        if (Option.isSome(record)) {
          return Option.some(yield* recoverMetadata(record.value));
        }
      }
      return Option.none<CommerceWorkflowRunRecord>();
    });
  const runtime: CommerceWorkflowRuntime = {
    capabilities: cloudflareRuntimeCapabilities,
    get: <Output = unknown>(runId: string) =>
      get(runId) as Effect.Effect<
        Option.Option<CommerceWorkflowRunRecord<unknown, Output>>,
        WorkflowRuntimeError
      >,
    dedupe: <Output = unknown>(query: CommerceWorkflowDuplicateQuery) =>
      dedupe(query) as Effect.Effect<
        Option.Option<CommerceWorkflowRunRecord<unknown, Output>>,
        WorkflowRuntimeError
      >,
    reconcile: <Output = unknown>(request: CommerceWorkflowReconcileRequest) =>
      // Reconciliation resumes dispatch, validates platform state, and replays events.
      // oxlint-disable-next-line eslint/complexity
      Effect.gen(function* reconcile() {
        const found = yield* get(request.runId);
        if (Option.isNone(found)) {
          return Option.none<CommerceWorkflowRunRecord<unknown, Output>>();
        }
        const current =
          found.value.status === "pending" &&
          found.value.dispatchStatus !== "coordinated"
            ? yield* dispatch(found.value)
            : found.value;
        const currentIsTerminal =
          current.status === "completed" ||
          current.status === "failed" ||
          current.status === "compensated";
        if (currentIsTerminal) {
          if (current.status === "completed") {
            yield* publish(current, WORKFLOW_LIFECYCLE_EVENT_NAMES.completed);
          } else {
            let storedFailure: CommerceWorkflowRunError | undefined;
            for (const attempt of current.attempts ?? []) {
              if (attempt.status === "failed") {
                storedFailure = attempt.error;
              }
            }
            yield* publish(
              current,
              WORKFLOW_LIFECYCLE_EVENT_NAMES.failed,
              storedFailure ??
                createWorkflowRunError(
                  new Error("Cloudflare workflow terminated.")
                )
            );
          }
          yield* observe("workflow.reconcile.succeeded", current);
          return Option.some(
            current as CommerceWorkflowRunRecord<unknown, Output>
          );
        }
        const remote = yield* status(request.runId, "reconciliation").pipe(
          Effect.tapError(() => observe("workflow.reconcile.failed", current))
        );
        // A delayed platform projection must not regress a terminal durable run.
        const nextStatus = CLOUDFLARE_TO_CORE_STATUS[remote.status];
        const definition =
          definitions.get(current.runId) ??
          definitionsByKey.get(current.workflowKey);
        const decodedOutput =
          nextStatus === "completed"
            ? yield* definition
                ? Schema.decodeUnknownEffect(definition.outputSchema)(
                    remote.output
                  ).pipe(
                    Effect.mapError(
                      () =>
                        new WorkflowRuntimeError({
                          operation: "validation",
                          runId: current.runId,
                          workflowKey: current.workflowKey,
                          message: "Invalid Cloudflare workflow output.",
                        })
                    )
                  )
                : Effect.fail(
                    new WorkflowRuntimeError({
                      operation: "validation",
                      runId: current.runId,
                      workflowKey: current.workflowKey,
                      message: "Workflow definition unavailable for recovery.",
                    })
                  )
            : remote.output;
        const remoteError =
          nextStatus === "failed"
            ? createWorkflowRunError(remote.error)
            : undefined;
        const reconciled = {
          ...current,
          output: decodedOutput,
          status: nextStatus,
          updatedAt: clock.now(),
          attempts: remoteError
            ? [
                ...(current.attempts ?? []),
                {
                  attempt: 1,
                  completedAt: clock.now(),
                  error: remoteError,
                  phase: "run" as const,
                  startedAt: current.updatedAt,
                  status: "failed" as const,
                  stepId: `${current.runId}:cloudflare`,
                  stepName: "cloudflare-workflow",
                },
              ]
            : current.attempts,
        };
        yield* persist(reconciled);
        if (reconciled.status !== current.status) {
          if (reconciled.status === "completed") {
            yield* publish(
              reconciled,
              WORKFLOW_LIFECYCLE_EVENT_NAMES.completed
            );
          }
          if (reconciled.status === "failed") {
            yield* publish(
              reconciled,
              WORKFLOW_LIFECYCLE_EVENT_NAMES.failed,
              remoteError
            );
          }
        }
        yield* observe("workflow.reconcile.succeeded", reconciled);
        return Option.some(
          reconciled as CommerceWorkflowRunRecord<unknown, Output>
        );
      }).pipe(Effect.withSpan("workflow.reconciliation")),
    start: <Input, Output, Requirements = never, Error = unknown>(
      request: CommerceWorkflowStartRequest<
        Input,
        Output,
        Record<string, unknown>,
        Requirements,
        Error
      >
    ) =>
      starts.withPermit(
        // Start coordinates validation, atomic registration, recovery, and dispatch.
        // oxlint-disable-next-line eslint/complexity
        Effect.gen(function* start() {
          const decodedInput = yield* Schema.decodeUnknownEffect(
            request.workflow.inputSchema
          )(request.input).pipe(
            Effect.mapError(
              () =>
                new WorkflowRuntimeError({
                  operation: "validation",
                  workflowKey: request.workflow.key,
                  message: "Invalid workflow input.",
                })
            )
          );
          if (request.idempotencyKey) {
            const duplicate = yield* dedupe({
              workflowKey: request.workflow.key,
              idempotencyKey: request.idempotencyKey,
            });
            if (Option.isSome(duplicate)) {
              definitions.set(duplicate.value.runId, request.workflow);
              if (
                duplicate.value.workflowVersion !== request.workflow.version ||
                duplicate.value.schemaVersion !==
                  (request.workflow.schemaVersion ?? request.workflow.version)
              ) {
                return yield* Effect.fail(
                  new WorkflowRuntimeError({
                    operation: "validation",
                    runId: duplicate.value.runId,
                    workflowKey: request.workflow.key,
                    message: "Unsupported workflow recovery version.",
                  })
                );
              }
              yield* Schema.decodeUnknownEffect(request.workflow.inputSchema)(
                duplicate.value.input
              ).pipe(
                Effect.mapError(
                  () =>
                    new WorkflowRuntimeError({
                      operation: "validation",
                      runId: duplicate.value.runId,
                      workflowKey: request.workflow.key,
                      message: "Invalid persisted workflow input.",
                    })
                )
              );
              if (duplicate.value.status === "completed") {
                yield* Schema.decodeUnknownEffect(
                  request.workflow.outputSchema
                )(duplicate.value.output).pipe(
                  Effect.mapError(
                    () =>
                      new WorkflowRuntimeError({
                        operation: "validation",
                        runId: duplicate.value.runId,
                        workflowKey: request.workflow.key,
                        message: "Invalid persisted workflow output.",
                      })
                  )
                );
              }
              const resumed =
                duplicate.value.status === "pending" &&
                duplicate.value.dispatchStatus !== "coordinated"
                  ? yield* dispatch(duplicate.value)
                  : duplicate.value;
              if (resumed.status === "pending") {
                yield* publish(resumed, WORKFLOW_LIFECYCLE_EVENT_NAMES.started);
              }
              return resumed as CommerceWorkflowRunRecord<Input, Output>;
            }
          }
          const now = clock.now();
          const runId = request.runId ?? ids.nextId();
          const run: CommerceWorkflowRunRecord<Input, Output> = {
            runId,
            workflowKey: request.workflow.key,
            workflowVersion: request.workflow.version,
            schemaVersion:
              request.workflow.schemaVersion ?? request.workflow.version,
            input: decodedInput as Input,
            status: "pending",
            dispatchStatus: "registered",
            correlationId: request.correlationId,
            causationId: request.causationId,
            idempotencyKey: request.idempotencyKey,
            subject: request.subject,
            traceId: request.traceId,
            metadata: request.metadata,
            createdAt: now,
            updatedAt: now,
            historyReference: `cloudflare:${runId}`,
          };
          definitions.set(runId, request.workflow);
          const durable = yield* Effect.try({
            try: () => toRunState(run),
            catch: () =>
              new WorkflowRuntimeError({
                operation: "validation",
                runId,
                message: "Invalid workflow start request.",
              }),
          });
          if (stateStore) {
            const registration = yield* stateStore.registerRunState(durable);
            if (registration.status === "duplicate") {
              const existing = yield* decodeState(registration.state);
              if (
                existing.workflowKey !== request.workflow.key ||
                existing.workflowVersion !== request.workflow.version ||
                existing.schemaVersion !==
                  (request.workflow.schemaVersion ?? request.workflow.version)
              ) {
                return yield* Effect.fail(
                  new WorkflowRuntimeError({
                    operation: "validation",
                    runId: existing.runId,
                    workflowKey: request.workflow.key,
                    message: "Unsupported workflow recovery version.",
                  })
                );
              }
              const resumed =
                existing.status === "pending" &&
                existing.dispatchStatus !== "coordinated"
                  ? yield* dispatch(existing)
                  : existing;
              if (resumed.status === "pending") {
                yield* publish(resumed, WORKFLOW_LIFECYCLE_EVENT_NAMES.started);
              }
              return resumed as CommerceWorkflowRunRecord<Input, Output>;
            }
          }
          if (metadataStore) {
            const registration = yield* metadataStore.registerRun(
              toMetadataRecord(run)
            );
            if (registration.status === "duplicate" && !stateStore) {
              return (yield* recoverMetadata(
                registration.record
              )) as CommerceWorkflowRunRecord<Input, Output>;
            }
          }
          // Registration and every dispatch checkpoint are durable, so a repeated
          // idempotent start resumes only the incomplete platform operation.
          remember(run);
          const startedRun = (yield* dispatch(
            run
          )) as CommerceWorkflowRunRecord<Input, Output>;
          yield* publish(startedRun, WORKFLOW_LIFECYCLE_EVENT_NAMES.started);
          yield* observe("workflow.start.succeeded", startedRun);
          return startedRun;
        }).pipe(Effect.withSpan("workflow.start"))
      ),
  };
  return {
    runtime,
    release: Effect.sync(() => {
      runs.clear();
      idempotencyIndex.clear();
    }),
  };
};

/** Construct an isolated workflow adapter for an explicitly owned host lifetime. */
export const createCloudflareWorkflowRuntime = (
  options: CloudflareWorkflowRuntimeOptions
): CommerceWorkflowRuntime => acquireWorkflowRuntime(options).runtime;

/** Each Layer build acquires an isolated runtime; Effect owns its scope. */
export const createCloudflareWorkflowRuntimeLayer = (
  options: CloudflareWorkflowRuntimeOptions
) =>
  Layer.effect(
    WorkflowRuntimeService,
    Effect.acquireRelease(
      Effect.sync(() => acquireWorkflowRuntime(options)),
      (resource) => resource.release
    ).pipe(Effect.map((resource) => resource.runtime))
  );
