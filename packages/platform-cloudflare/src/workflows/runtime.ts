import {
  CommerceWorkflowRunStateSchema,
  WORKFLOW_LIFECYCLE_EVENT_NAMES,
  createEventEnvelope,
  createWorkflowRunError,
  workflowRuntimeLayer,
} from "@ecommerce/core";
import type {
  CommerceWorkflowDuplicateQuery,
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
  EventPublisherServiceShape,
} from "@ecommerce/core";
import { Schema } from "effect";

export interface CloudflareWorkflowRuntimeBindings {
  readonly workflow: Workflow<CloudflareWorkflowPayload>;
  readonly dispatchQueue?: Queue<CloudflareWorkflowDispatchMessage>;
  readonly coordinator?: DurableObjectNamespace;
}

export interface CloudflareWorkflowPayload {
  readonly workflowKey: string;
  readonly workflowVersion: number;
  readonly input: unknown;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly idempotencyKey?: string;
  readonly runId: string;
  readonly metadata?: Record<string, unknown>;
  readonly subject?: {
    readonly type: string;
    readonly id: string;
  };
}

export interface CloudflareWorkflowDispatchMessage {
  readonly runId: string;
  readonly workflowKey: string;
  readonly workflowVersion: number;
  readonly correlationId: string;
}

export interface CloudflareWorkflowRuntimeOptions {
  readonly bindings: CloudflareWorkflowRuntimeBindings;
  readonly clock: {
    now(): Date;
  };
  readonly ids: {
    nextId(): string;
  };
  readonly publisher: EventPublisherServiceShape;
  readonly metadataStore?: CommerceWorkflowMetadataStore;
  readonly stateStore?: CommerceWorkflowStateStore;
  readonly telemetry?: CloudflareWorkflowTelemetrySink;
}

export class CloudflareWorkflowRuntimeFailure extends Schema.TaggedErrorClass<CloudflareWorkflowRuntimeFailure>()(
  "CloudflareWorkflowRuntimeFailure",
  {
    cause: Schema.optional(Schema.Unknown),
    message: Schema.NonEmptyString,
    operation: Schema.Literals([
      "coordinator",
      "dedupe",
      "get",
      "metadata",
      "publish-event",
      "queue",
      "reconcile",
      "start",
      "state",
      "workflow-binding",
    ]),
    runId: Schema.optional(Schema.NonEmptyString),
    workflowKey: Schema.optional(Schema.NonEmptyString),
  }
) {}

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
  readonly workflowKey?: string;
  readonly workflowVersion?: number;
}

export interface CloudflareWorkflowTelemetrySink {
  record(event: CloudflareWorkflowTelemetryEvent): Promise<void> | void;
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

const toWorkflowRuntimeFailure = ({
  cause,
  message,
  operation,
  runId,
  workflowKey,
}: {
  readonly cause: unknown;
  readonly message: string;
  readonly operation: CloudflareWorkflowRuntimeFailure["operation"];
  readonly runId?: string;
  readonly workflowKey?: string;
}) =>
  new CloudflareWorkflowRuntimeFailure({
    cause,
    message,
    operation,
    runId,
    workflowKey,
  });

const recordWorkflowTelemetry = async (
  telemetry: CloudflareWorkflowTelemetrySink | undefined,
  event: CloudflareWorkflowTelemetryEvent
) => {
  try {
    await telemetry?.record(event);
  } catch {
    // Telemetry is observational and must not change workflow semantics.
  }
};

const createCoordinatorRequest = (
  runId: string,
  status: CommerceWorkflowRunStatus
) =>
  new Request(`https://workflow-coordinator.internal/runs/${runId}`, {
    body: JSON.stringify({ runId, status }),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });

const toMetadataRecord = (
  run: CommerceWorkflowRunRecord
): CommerceWorkflowMetadataRecord => ({
  runId: run.runId,
  workflowKey: run.workflowKey,
  workflowVersion: run.workflowVersion,
  status: run.status,
  correlationId: run.correlationId,
  causationId: run.causationId,
  idempotencyKey: run.idempotencyKey,
  subject: run.subject,
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
  updatedAt: record.updatedAt,
  workflowKey: record.workflowKey,
  workflowVersion: record.workflowVersion,
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
    historyReference: record.historyReference,
    idempotencyKey: record.idempotencyKey,
    input: record.input,
    metadata: record.metadata,
    nextStepIndex,
    output: record.output,
    runId: record.runId,
    schemaVersion: record.workflowVersion,
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
  historyReference: state.historyReference,
  idempotencyKey: state.idempotencyKey,
  input: state.input,
  metadata: state.metadata,
  output: state.output,
  runId: state.runId,
  status: state.status,
  subject: state.subject,
  updatedAt: fromIso(state.updatedAt),
  workflowKey: state.workflowKey,
  workflowVersion: state.workflowVersion,
});

const publishLifecycleEvent = async ({
  publisher,
  ids,
  metadataStore,
  telemetry,
  run,
  name,
  status,
  runError,
}: {
  publisher: EventPublisherServiceShape;
  ids: { nextId(): string };
  metadataStore?: CommerceWorkflowMetadataStore;
  telemetry?: CloudflareWorkflowTelemetrySink;
  run: CommerceWorkflowRunRecord;
  name:
    | typeof WORKFLOW_LIFECYCLE_EVENT_NAMES.started
    | typeof WORKFLOW_LIFECYCLE_EVENT_NAMES.completed
    | typeof WORKFLOW_LIFECYCLE_EVENT_NAMES.failed;
  status: CommerceWorkflowRunStatus;
  runError?: CommerceWorkflowRunError;
}) => {
  const payload = {
    correlationId: run.correlationId,
    occurredAt: run.updatedAt,
    runId: run.runId,
    status,
    workflowKey: run.workflowKey,
    workflowVersion: run.workflowVersion,
    causationId: run.causationId,
    idempotencyKey: run.idempotencyKey,
    subject: run.subject,
    type: name,
    ...(runError ? { error: runError } : {}),
    ...(run.output !== undefined &&
    name === WORKFLOW_LIFECYCLE_EVENT_NAMES.completed
      ? { output: run.output }
      : {}),
  };

  const event = createEventEnvelope({
    id: ids.nextId(),
    name,
    payload,
    emittedAt: run.updatedAt,
    correlationId: run.correlationId,
    causationId: run.causationId,
    workflowRunId: run.runId,
    subject: run.subject,
  });

  try {
    await publisher.publish(event);
    await metadataStore?.appendEvent(event);
    await recordWorkflowTelemetry(telemetry, {
      correlationId: run.correlationId,
      idempotencyKey: run.idempotencyKey,
      kind: "workflow.event.succeeded",
      runId: run.runId,
      status,
      workflowKey: run.workflowKey,
      workflowVersion: run.workflowVersion,
    });
  } catch (error) {
    await recordWorkflowTelemetry(telemetry, {
      correlationId: run.correlationId,
      idempotencyKey: run.idempotencyKey,
      kind: "workflow.event.failed",
      runId: run.runId,
      status,
      workflowKey: run.workflowKey,
      workflowVersion: run.workflowVersion,
    });
    throw toWorkflowRuntimeFailure({
      cause: error,
      message: `Failed to publish workflow lifecycle event ${name}.`,
      operation: "publish-event",
      runId: run.runId,
      workflowKey: run.workflowKey,
    });
  }
};

const persistMetadata = async (
  metadataStore: CommerceWorkflowMetadataStore | undefined,
  run: CommerceWorkflowRunRecord
) => {
  await metadataStore?.upsertRun(toMetadataRecord(run));
};

const persistState = async (
  stateStore: CommerceWorkflowStateStore | undefined,
  run: CommerceWorkflowRunRecord,
  telemetry: CloudflareWorkflowTelemetrySink | undefined
) => {
  if (!stateStore) {
    return;
  }

  try {
    await stateStore.upsertRunState(toRunState(run));
    await recordWorkflowTelemetry(telemetry, {
      correlationId: run.correlationId,
      idempotencyKey: run.idempotencyKey,
      kind: "workflow.state.succeeded",
      runId: run.runId,
      status: run.status,
      workflowKey: run.workflowKey,
      workflowVersion: run.workflowVersion,
    });
  } catch (error) {
    await recordWorkflowTelemetry(telemetry, {
      correlationId: run.correlationId,
      idempotencyKey: run.idempotencyKey,
      kind: "workflow.state.failed",
      runId: run.runId,
      status: run.status,
      workflowKey: run.workflowKey,
      workflowVersion: run.workflowVersion,
    });
    throw toWorkflowRuntimeFailure({
      cause: error,
      message: `Failed to persist Cloudflare workflow run state ${run.runId}.`,
      operation: "state",
      runId: run.runId,
      workflowKey: run.workflowKey,
    });
  }
};

export const createCloudflareWorkflowRuntime = ({
  bindings,
  clock,
  ids,
  publisher,
  metadataStore,
  stateStore,
  telemetry,
}: CloudflareWorkflowRuntimeOptions): CommerceWorkflowRuntime => {
  const runs = new Map<string, CommerceWorkflowRunRecord>();
  const idempotencyIndex = new Map<string, string>();

  const recoverFromState = (
    state: CommerceWorkflowRunState
  ): CommerceWorkflowRunRecord => {
    const local = runs.get(state.runId);
    if (local) {
      return local;
    }

    const recovered = fromRunState(state);
    runs.set(state.runId, recovered);
    if (state.idempotencyKey) {
      idempotencyIndex.set(
        makeDuplicateKey({
          idempotencyKey: state.idempotencyKey,
          workflowKey: state.workflowKey,
        }),
        state.runId
      );
    }
    return recovered;
  };

  const recoverFromMetadata = async (
    record: CommerceWorkflowMetadataRecord
  ): Promise<CommerceWorkflowRunRecord> => {
    const local = runs.get(record.runId);
    if (local) {
      return local;
    }

    let status: Awaited<ReturnType<WorkflowInstance["status"]>>;
    try {
      const instance = await bindings.workflow.get(record.runId);
      status = await instance.status();
    } catch (error) {
      throw toWorkflowRuntimeFailure({
        cause: error,
        message: `Failed to recover Cloudflare workflow instance ${record.runId}.`,
        operation: "workflow-binding",
        runId: record.runId,
        workflowKey: record.workflowKey,
      });
    }
    const recovered: CommerceWorkflowRunRecord =
      status.output === undefined
        ? {
            ...fromMetadataRecord(record),
            status: CLOUDFLARE_TO_CORE_STATUS[status.status],
            updatedAt: clock.now(),
          }
        : {
            ...fromMetadataRecord(record),
            output: status.output,
            status: CLOUDFLARE_TO_CORE_STATUS[status.status],
            updatedAt: clock.now(),
          };

    runs.set(record.runId, recovered);
    if (record.idempotencyKey) {
      idempotencyIndex.set(
        makeDuplicateKey({
          idempotencyKey: record.idempotencyKey,
          workflowKey: record.workflowKey,
        }),
        record.runId
      );
    }
    await persistState(stateStore, recovered, telemetry);
    return recovered;
  };

  const get = async (
    runId: string
  ): Promise<CommerceWorkflowRunRecord | null> => {
    const local = runs.get(runId);
    if (local) {
      return local;
    }

    const stateRecord = (await stateStore?.getRunState(runId)) ?? null;
    if (stateRecord) {
      return recoverFromState(stateRecord);
    }

    const metadataRecord = (await metadataStore?.getRun(runId)) ?? null;
    if (metadataRecord) {
      return recoverFromMetadata(metadataRecord);
    }

    let status: Awaited<ReturnType<WorkflowInstance["status"]>>;
    try {
      const instance = await bindings.workflow.get(runId);
      status = await instance.status();
    } catch (error) {
      throw toWorkflowRuntimeFailure({
        cause: error,
        message: `Failed to read Cloudflare workflow instance ${runId}.`,
        operation: "get",
        runId,
      });
    }
    const now = clock.now();

    const recoveredBase: CommerceWorkflowRunRecord = {
      attempts: undefined,
      correlationId: runId,
      createdAt: now,
      historyReference: `cloudflare:${runId}`,
      input: undefined,
      runId,
      status: CLOUDFLARE_TO_CORE_STATUS[status.status],
      updatedAt: now,
      workflowKey: "unknown",
      workflowVersion: 0,
    };
    const recovered =
      status.output === undefined
        ? recoveredBase
        : {
            ...recoveredBase,
            output: status.output,
          };

    runs.set(runId, recovered);
    return recovered;
  };

  const findDuplicate = async <Output = unknown>(
    query: CommerceWorkflowDuplicateQuery
  ): Promise<CommerceWorkflowRunRecord<unknown, Output> | null> => {
    const duplicateKey = makeDuplicateKey(query);
    const localRunId = idempotencyIndex.get(duplicateKey);

    if (localRunId) {
      return (
        ((await get(localRunId)) as CommerceWorkflowRunRecord<
          unknown,
          Output
        >) ?? null
      );
    }

    const stateRecord =
      (await stateStore?.findRunStateByIdempotencyKey(query)) ?? null;
    if (stateRecord) {
      return (await recoverFromState(stateRecord)) as CommerceWorkflowRunRecord<
        unknown,
        Output
      >;
    }

    const record =
      (await metadataStore?.findRunByIdempotencyKey(query)) ?? null;
    if (!record) {
      return null;
    }

    return (await recoverFromMetadata(record)) as CommerceWorkflowRunRecord<
      unknown,
      Output
    >;
  };

  return {
    capabilities: cloudflareRuntimeCapabilities,
    dedupe: <Output = unknown>(query: CommerceWorkflowDuplicateQuery) =>
      findDuplicate<Output>(query),
    get: async <Output = unknown>(runId: string) =>
      (await get(runId)) as CommerceWorkflowRunRecord<unknown, Output> | null,
    reconcile: async <Output = unknown>(
      request: CommerceWorkflowReconcileRequest
    ): Promise<CommerceWorkflowRunRecord<unknown, Output> | null> => {
      const current = await get(request.runId);
      if (!current) {
        return null;
      }

      let instanceStatus: Awaited<ReturnType<WorkflowInstance["status"]>>;
      try {
        const instance = await bindings.workflow.get(request.runId);
        instanceStatus = await instance.status();
      } catch (error) {
        await recordWorkflowTelemetry(telemetry, {
          correlationId: current.correlationId,
          idempotencyKey: current.idempotencyKey,
          kind: "workflow.reconcile.failed",
          runId: current.runId,
          status: current.status,
          workflowKey: current.workflowKey,
          workflowVersion: current.workflowVersion,
        });
        throw toWorkflowRuntimeFailure({
          cause: error,
          message: `Failed to reconcile Cloudflare workflow run ${request.runId}.`,
          operation: "reconcile",
          runId: request.runId,
          workflowKey: current.workflowKey,
        });
      }
      const reconciled: CommerceWorkflowRunRecord = {
        ...current,
        output: instanceStatus.output,
        status: CLOUDFLARE_TO_CORE_STATUS[instanceStatus.status],
        updatedAt: clock.now(),
      };

      runs.set(request.runId, reconciled);
      await persistMetadata(metadataStore, reconciled);
      await persistState(stateStore, reconciled, telemetry);
      await recordWorkflowTelemetry(telemetry, {
        correlationId: reconciled.correlationId,
        idempotencyKey: reconciled.idempotencyKey,
        kind: "workflow.reconcile.succeeded",
        runId: reconciled.runId,
        status: reconciled.status,
        workflowKey: reconciled.workflowKey,
        workflowVersion: reconciled.workflowVersion,
      });

      if (reconciled.status === "completed") {
        await publishLifecycleEvent({
          ids,
          metadataStore,
          telemetry,
          name: WORKFLOW_LIFECYCLE_EVENT_NAMES.completed,
          publisher,
          run: reconciled,
          status: "completed",
        });
      }

      if (reconciled.status === "failed") {
        await publishLifecycleEvent({
          ids,
          metadataStore,
          telemetry,
          name: WORKFLOW_LIFECYCLE_EVENT_NAMES.failed,
          publisher,
          runError: createWorkflowRunError(instanceStatus.error),
          run: reconciled,
          status: "failed",
        });
      }

      return reconciled as CommerceWorkflowRunRecord<unknown, Output>;
    },
    start: async <Input, Output>(
      request: CommerceWorkflowStartRequest<Input, Output>
    ): Promise<CommerceWorkflowRunRecord<Input, Output>> => {
      if (request.idempotencyKey) {
        const duplicate = await findDuplicate<Output>({
          idempotencyKey: request.idempotencyKey,
          workflowKey: request.workflow.key,
        });

        if (duplicate) {
          return duplicate as CommerceWorkflowRunRecord<Input, Output>;
        }
      }

      const createdAt = clock.now();
      const runId = request.runId ?? ids.nextId();
      const run: CommerceWorkflowRunRecord<Input, Output> = {
        correlationId: request.correlationId,
        createdAt,
        historyReference: `cloudflare:${runId}`,
        input: request.input,
        metadata: request.metadata,
        runId,
        status: "pending",
        updatedAt: createdAt,
        workflowKey: request.workflow.key,
        workflowVersion: request.workflow.version,
        causationId: request.causationId,
        idempotencyKey: request.idempotencyKey,
        subject: request.subject,
      };

      if (stateStore) {
        try {
          const registration = await stateStore.registerRunState(
            toRunState(run)
          );

          if (registration.status === "duplicate") {
            return (await recoverFromState(
              registration.state
            )) as CommerceWorkflowRunRecord<Input, Output>;
          }
        } catch (error) {
          await recordWorkflowTelemetry(telemetry, {
            correlationId: run.correlationId,
            idempotencyKey: run.idempotencyKey,
            kind: "workflow.state.failed",
            runId: run.runId,
            status: run.status,
            workflowKey: run.workflowKey,
            workflowVersion: run.workflowVersion,
          });
          throw toWorkflowRuntimeFailure({
            cause: error,
            message: `Failed to register Cloudflare workflow run state ${run.runId}.`,
            operation: "state",
            runId: run.runId,
            workflowKey: run.workflowKey,
          });
        }
      }

      if (metadataStore) {
        let registration: Awaited<ReturnType<typeof metadataStore.registerRun>>;
        try {
          registration = await metadataStore.registerRun(toMetadataRecord(run));
        } catch (error) {
          throw toWorkflowRuntimeFailure({
            cause: error,
            message: `Failed to register Cloudflare workflow metadata ${run.runId}.`,
            operation: "metadata",
            runId: run.runId,
            workflowKey: run.workflowKey,
          });
        }

        if (registration.status === "duplicate") {
          return (await recoverFromMetadata(
            registration.record
          )) as CommerceWorkflowRunRecord<Input, Output>;
        }
      }

      const payload: CloudflareWorkflowPayload = {
        correlationId: request.correlationId,
        input: request.input,
        metadata: request.metadata,
        runId,
        workflowKey: request.workflow.key,
        workflowVersion: request.workflow.version,
        causationId: request.causationId,
        idempotencyKey: request.idempotencyKey,
        subject: request.subject,
      };

      let instance: WorkflowInstance;
      try {
        instance = await bindings.workflow.create({
          id: runId,
          params: payload,
        });
      } catch (error) {
        await recordWorkflowTelemetry(telemetry, {
          correlationId: run.correlationId,
          idempotencyKey: run.idempotencyKey,
          kind: "workflow.start.failed",
          runId: run.runId,
          status: run.status,
          workflowKey: run.workflowKey,
          workflowVersion: run.workflowVersion,
        });
        throw toWorkflowRuntimeFailure({
          cause: error,
          message: `Failed to create Cloudflare workflow instance ${runId}.`,
          operation: "workflow-binding",
          runId,
          workflowKey: request.workflow.key,
        });
      }

      if (bindings.dispatchQueue) {
        try {
          await bindings.dispatchQueue.send({
            correlationId: request.correlationId,
            runId,
            workflowKey: request.workflow.key,
            workflowVersion: request.workflow.version,
          });
          await recordWorkflowTelemetry(telemetry, {
            correlationId: run.correlationId,
            idempotencyKey: run.idempotencyKey,
            kind: "workflow.queue.succeeded",
            runId: run.runId,
            status: run.status,
            workflowKey: run.workflowKey,
            workflowVersion: run.workflowVersion,
          });
        } catch (error) {
          await recordWorkflowTelemetry(telemetry, {
            correlationId: run.correlationId,
            idempotencyKey: run.idempotencyKey,
            kind: "workflow.queue.failed",
            runId: run.runId,
            status: run.status,
            workflowKey: run.workflowKey,
            workflowVersion: run.workflowVersion,
          });
          throw toWorkflowRuntimeFailure({
            cause: error,
            message: `Failed to enqueue Cloudflare workflow dispatch ${runId}.`,
            operation: "queue",
            runId,
            workflowKey: request.workflow.key,
          });
        }
      }

      if (bindings.coordinator) {
        try {
          const stub = bindings.coordinator.getByName(runId);
          await stub.fetch(createCoordinatorRequest(runId, "pending"));
          await recordWorkflowTelemetry(telemetry, {
            correlationId: run.correlationId,
            idempotencyKey: run.idempotencyKey,
            kind: "workflow.coordinator.succeeded",
            runId: run.runId,
            status: run.status,
            workflowKey: run.workflowKey,
            workflowVersion: run.workflowVersion,
          });
        } catch (error) {
          await recordWorkflowTelemetry(telemetry, {
            correlationId: run.correlationId,
            idempotencyKey: run.idempotencyKey,
            kind: "workflow.coordinator.failed",
            runId: run.runId,
            status: run.status,
            workflowKey: run.workflowKey,
            workflowVersion: run.workflowVersion,
          });
          throw toWorkflowRuntimeFailure({
            cause: error,
            message: `Failed to coordinate Cloudflare workflow run ${runId}.`,
            operation: "coordinator",
            runId,
            workflowKey: request.workflow.key,
          });
        }
      }

      const startedRun: CommerceWorkflowRunRecord<Input, Output> = {
        ...run,
        historyReference: `cloudflare:${instance.id}`,
      };

      runs.set(runId, startedRun);
      if (request.idempotencyKey) {
        idempotencyIndex.set(
          makeDuplicateKey({
            idempotencyKey: request.idempotencyKey,
            workflowKey: request.workflow.key,
          }),
          runId
        );
      }

      await persistMetadata(metadataStore, startedRun);
      await persistState(stateStore, startedRun, telemetry);
      await publishLifecycleEvent({
        ids,
        metadataStore,
        telemetry,
        name: WORKFLOW_LIFECYCLE_EVENT_NAMES.started,
        publisher,
        run: startedRun,
        status: "pending",
      });
      await recordWorkflowTelemetry(telemetry, {
        correlationId: startedRun.correlationId,
        idempotencyKey: startedRun.idempotencyKey,
        kind: "workflow.start.succeeded",
        runId: startedRun.runId,
        status: startedRun.status,
        workflowKey: startedRun.workflowKey,
        workflowVersion: startedRun.workflowVersion,
      });

      return startedRun;
    },
  };
};

/**
 * Exposes the Cloudflare workflow adapter through the runtime-neutral Effect
 * workflow service tag. The service itself keeps the existing Promise-shaped
 * workflow contract while normalizing platform rejections to schema-backed
 * `CloudflareWorkflowRuntimeFailure` instances at the adapter boundary.
 */
export const createCloudflareWorkflowRuntimeLayer = (
  options: CloudflareWorkflowRuntimeOptions
) => workflowRuntimeLayer(createCloudflareWorkflowRuntime(options));
