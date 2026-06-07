import {
  WORKFLOW_LIFECYCLE_EVENT_NAMES,
  createEventEnvelope,
  createWorkflowRunError,
} from "@ecommerce/core";
import type {
  CommerceWorkflowDuplicateQuery,
  CommerceWorkflowMetadataRecord,
  CommerceWorkflowMetadataStore,
  CommerceWorkflowReconcileRequest,
  CommerceWorkflowRunError,
  CommerceWorkflowRunRecord,
  CommerceWorkflowRunStatus,
  CommerceWorkflowRuntime,
  CommerceWorkflowRuntimeCapabilities,
  CommerceWorkflowStartRequest,
  EventPublisherServiceShape,
} from "@ecommerce/core";

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

const publishLifecycleEvent = async ({
  publisher,
  ids,
  metadataStore,
  run,
  name,
  status,
  error,
}: {
  publisher: EventPublisherServiceShape;
  ids: { nextId(): string };
  metadataStore?: CommerceWorkflowMetadataStore;
  run: CommerceWorkflowRunRecord;
  name:
    | typeof WORKFLOW_LIFECYCLE_EVENT_NAMES.started
    | typeof WORKFLOW_LIFECYCLE_EVENT_NAMES.completed
    | typeof WORKFLOW_LIFECYCLE_EVENT_NAMES.failed;
  status: CommerceWorkflowRunStatus;
  error?: CommerceWorkflowRunError;
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
    ...(error ? { error } : {}),
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

  await publisher.publish(event);
  await metadataStore?.appendEvent(event);
};

const persistMetadata = async (
  metadataStore: CommerceWorkflowMetadataStore | undefined,
  run: CommerceWorkflowRunRecord
) => {
  await metadataStore?.upsertRun(toMetadataRecord(run));
};

export const createCloudflareWorkflowRuntime = ({
  bindings,
  clock,
  ids,
  publisher,
  metadataStore,
}: CloudflareWorkflowRuntimeOptions): CommerceWorkflowRuntime => {
  const runs = new Map<string, CommerceWorkflowRunRecord>();
  const idempotencyIndex = new Map<string, string>();

  const recoverFromMetadata = async (
    record: CommerceWorkflowMetadataRecord
  ): Promise<CommerceWorkflowRunRecord> => {
    const local = runs.get(record.runId);
    if (local) {
      return local;
    }

    const instance = await bindings.workflow.get(record.runId);
    const status = await instance.status();
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
    return recovered;
  };

  const get = async (
    runId: string
  ): Promise<CommerceWorkflowRunRecord | null> => {
    const local = runs.get(runId);
    if (local) {
      return local;
    }

    const metadataRecord = (await metadataStore?.getRun(runId)) ?? null;
    if (metadataRecord) {
      return recoverFromMetadata(metadataRecord);
    }

    const instance = await bindings.workflow.get(runId);
    const status = await instance.status();
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

      const instance = await bindings.workflow.get(request.runId);
      const instanceStatus = await instance.status();
      const reconciled: CommerceWorkflowRunRecord = {
        ...current,
        output: instanceStatus.output,
        status: CLOUDFLARE_TO_CORE_STATUS[instanceStatus.status],
        updatedAt: clock.now(),
      };

      runs.set(request.runId, reconciled);
      await persistMetadata(metadataStore, reconciled);

      if (reconciled.status === "completed") {
        await publishLifecycleEvent({
          ids,
          metadataStore,
          name: WORKFLOW_LIFECYCLE_EVENT_NAMES.completed,
          publisher,
          run: reconciled,
          status: "completed",
        });
      }

      if (reconciled.status === "failed") {
        await publishLifecycleEvent({
          error: createWorkflowRunError(instanceStatus.error),
          ids,
          metadataStore,
          name: WORKFLOW_LIFECYCLE_EVENT_NAMES.failed,
          publisher,
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

      if (metadataStore) {
        const registration = await metadataStore.registerRun(
          toMetadataRecord(run)
        );

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

      const instance = await bindings.workflow.create({
        id: runId,
        params: payload,
      });

      if (bindings.dispatchQueue) {
        await bindings.dispatchQueue.send({
          correlationId: request.correlationId,
          runId,
          workflowKey: request.workflow.key,
          workflowVersion: request.workflow.version,
        });
      }

      if (bindings.coordinator) {
        const stub = bindings.coordinator.getByName(runId);
        await stub.fetch(createCoordinatorRequest(runId, "pending"));
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
      await publishLifecycleEvent({
        ids,
        metadataStore,
        name: WORKFLOW_LIFECYCLE_EVENT_NAMES.started,
        publisher,
        run: startedRun,
        status: "pending",
      });

      return startedRun;
    },
  };
};
