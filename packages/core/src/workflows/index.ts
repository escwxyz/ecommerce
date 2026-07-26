import { Schema, type Effect } from "effect";

import type { CommerceEventEnvelope } from "../events/index";

export type CommerceWorkflowKey = string;
export type CommerceWorkflowVersion = number;
export type CommerceWorkflowSchemaVersion = number;
export type CommerceWorkflowRunId = string;
export type CommerceWorkflowIdempotencyKey = string;
export type CommerceWorkflowHistoryReference = string;

const isCanonicalIsoDateTime = (value: string): boolean => {
  const parsed = new Date(value);
  return (
    !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value
  );
};

const isPositiveInteger = (value: number): boolean =>
  Number.isInteger(value) && value > 0;

const isNonNegativeInteger = (value: number): boolean =>
  Number.isInteger(value) && value >= 0;

export const CommerceWorkflowTrimmedStringSchema = Schema.NonEmptyString.pipe(
  Schema.check(Schema.makeFilter((value: string) => value.trim() === value))
);

export const CommerceWorkflowKeySchema =
  CommerceWorkflowTrimmedStringSchema.pipe(
    Schema.brand("CommerceWorkflowKey")
  );

export const CommerceWorkflowVersionSchema = Schema.Number.pipe(
  Schema.check(Schema.makeFilter(isPositiveInteger))
);

export const CommerceWorkflowSchemaVersionSchema = Schema.Number.pipe(
  Schema.check(Schema.makeFilter(isPositiveInteger))
);

export const CommerceWorkflowNonNegativeIntegerSchema = Schema.Number.pipe(
  Schema.check(Schema.makeFilter(isNonNegativeInteger))
);

export const CommerceWorkflowIsoDateTimeStringSchema =
  CommerceWorkflowTrimmedStringSchema.pipe(
    Schema.check(Schema.makeFilter(isCanonicalIsoDateTime))
  );

export const CommerceWorkflowMetadataSchema = Schema.Record(
  Schema.String,
  Schema.Unknown
);

export const CommerceWorkflowSubjectSchema = Schema.Struct({
  id: CommerceWorkflowTrimmedStringSchema,
  type: CommerceWorkflowTrimmedStringSchema,
});

export type CommerceWorkflowRunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "compensating"
  | "compensated";

export type CommerceWorkflowStepStatus =
  | "running"
  | "completed"
  | "failed"
  | "compensated";

export const CommerceWorkflowRunStatusSchema = Schema.Literals([
  "pending",
  "running",
  "completed",
  "failed",
  "compensating",
  "compensated",
]);

export const CommerceWorkflowStepStatusSchema = Schema.Literals([
  "running",
  "completed",
  "failed",
  "compensated",
]);

export const CommerceWorkflowRunErrorSchema = Schema.Struct({
  message: CommerceWorkflowTrimmedStringSchema,
  name: CommerceWorkflowTrimmedStringSchema,
  retryable: Schema.optional(Schema.Boolean),
  tag: Schema.optional(CommerceWorkflowTrimmedStringSchema),
});

export type CommerceWorkflowRetryDisposition =
  | "retry"
  | "do-not-retry"
  | "compensate";

export const CommerceWorkflowRetryDispositionSchema = Schema.Literals([
  "retry",
  "do-not-retry",
  "compensate",
]);

export const CommerceWorkflowRetryPolicySchema = Schema.Struct({
  backoffMillis: Schema.optional(
    Schema.Array(CommerceWorkflowNonNegativeIntegerSchema)
  ),
  maxAttempts: CommerceWorkflowVersionSchema,
  maxDelayMillis: Schema.optional(CommerceWorkflowNonNegativeIntegerSchema),
  retryableErrorTags: Schema.optional(
    Schema.Array(CommerceWorkflowTrimmedStringSchema)
  ),
});

export type CommerceWorkflowRetryPolicy =
  typeof CommerceWorkflowRetryPolicySchema.Type;

export const CommerceWorkflowCompensationPolicySchema = Schema.Struct({
  idempotencyScope: Schema.optional(
    Schema.Literals(["workflow", "step", "subject"])
  ),
  required: Schema.Boolean,
  stepName: Schema.optional(CommerceWorkflowTrimmedStringSchema),
});

export type CommerceWorkflowCompensationPolicy =
  typeof CommerceWorkflowCompensationPolicySchema.Type;

export const CommerceWorkflowStepDefinitionSchema = Schema.Struct({
  compensation: Schema.optional(CommerceWorkflowCompensationPolicySchema),
  name: CommerceWorkflowTrimmedStringSchema,
  retryPolicy: Schema.optional(CommerceWorkflowRetryPolicySchema),
  schemaVersion: CommerceWorkflowSchemaVersionSchema,
});

export type CommerceWorkflowStepDefinition =
  typeof CommerceWorkflowStepDefinitionSchema.Type;

export const CommerceWorkflowDefinitionDescriptorSchema = Schema.Struct({
  key: CommerceWorkflowKeySchema,
  schemaVersion: CommerceWorkflowSchemaVersionSchema,
  steps: Schema.Array(CommerceWorkflowStepDefinitionSchema),
  version: CommerceWorkflowVersionSchema,
});

export type CommerceWorkflowDefinitionDescriptor =
  typeof CommerceWorkflowDefinitionDescriptorSchema.Type;

export const CommerceWorkflowStepOutcomeSchema = Schema.Struct({
  attempt: CommerceWorkflowVersionSchema,
  completedAt: Schema.optional(CommerceWorkflowIsoDateTimeStringSchema),
  error: Schema.optional(CommerceWorkflowRunErrorSchema),
  output: Schema.optional(Schema.Unknown),
  phase: Schema.Literals(["run", "compensation"]),
  retryDisposition: Schema.optional(CommerceWorkflowRetryDispositionSchema),
  scheduledRetryAt: Schema.optional(CommerceWorkflowIsoDateTimeStringSchema),
  startedAt: CommerceWorkflowIsoDateTimeStringSchema,
  status: CommerceWorkflowStepStatusSchema,
  stepId: CommerceWorkflowTrimmedStringSchema,
  stepName: CommerceWorkflowTrimmedStringSchema,
});

export type CommerceWorkflowStepOutcome =
  typeof CommerceWorkflowStepOutcomeSchema.Type;

export const CommerceWorkflowRunStateSchema = Schema.Struct({
  attempts: Schema.Array(CommerceWorkflowStepOutcomeSchema),
  causationId: Schema.optional(CommerceWorkflowTrimmedStringSchema),
  completedAt: Schema.optional(CommerceWorkflowIsoDateTimeStringSchema),
  correlationId: CommerceWorkflowTrimmedStringSchema,
  createdAt: CommerceWorkflowIsoDateTimeStringSchema,
  historyReference: Schema.optional(CommerceWorkflowTrimmedStringSchema),
  idempotencyKey: Schema.optional(CommerceWorkflowTrimmedStringSchema),
  input: Schema.Unknown,
  metadata: Schema.optional(CommerceWorkflowMetadataSchema),
  nextStepIndex: CommerceWorkflowNonNegativeIntegerSchema,
  output: Schema.optional(Schema.Unknown),
  runId: CommerceWorkflowTrimmedStringSchema,
  schemaVersion: CommerceWorkflowSchemaVersionSchema,
  status: CommerceWorkflowRunStatusSchema,
  subject: Schema.optional(CommerceWorkflowSubjectSchema),
  updatedAt: CommerceWorkflowIsoDateTimeStringSchema,
  workflowKey: CommerceWorkflowKeySchema,
  workflowVersion: CommerceWorkflowVersionSchema,
});

export type CommerceWorkflowRunState =
  typeof CommerceWorkflowRunStateSchema.Type;

export interface CommerceWorkflowSubject {
  readonly type: string;
  readonly id: string;
}

export interface CommerceWorkflowRuntimeCapabilities {
  readonly adapter: string;
  readonly supportsPause: boolean;
  readonly supportsEvents: boolean;
  readonly supportsDurableHistory: boolean;
  readonly supportsCompensation: boolean;
  readonly supportsMetadataProjection: boolean;
}

export interface CommerceWorkflowContext {
  readonly workflowId: CommerceWorkflowRunId;
  readonly workflowKey: CommerceWorkflowKey;
  readonly workflowVersion: CommerceWorkflowVersion;
  readonly stepId: string;
  readonly stepName: string;
  readonly attempt: number;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly idempotencyKey?: CommerceWorkflowIdempotencyKey;
  readonly subject?: CommerceWorkflowSubject;
}

export interface CommerceWorkflowStepResult<Output = unknown> {
  readonly output: Output;
}

export interface CommerceWorkflowRunError {
  readonly name: string;
  readonly message: string;
  readonly retryable?: boolean;
  readonly tag?: string;
}

export interface CommerceWorkflowStepAttempt<
  Output = unknown,
  Error = CommerceWorkflowRunError,
> {
  readonly stepName: string;
  readonly stepId: string;
  readonly attempt: number;
  readonly status: CommerceWorkflowStepStatus;
  readonly startedAt: Date;
  readonly completedAt?: Date;
  readonly output?: Output;
  readonly error?: Error;
}

export type WorkflowStepHandler<
  Input = unknown,
  Output = unknown,
  Error = never,
> = (
  input: Input,
  context: CommerceWorkflowContext
) => Effect.Effect<CommerceWorkflowStepResult<Output>, Error>;

export type WorkflowCompensationHandler<
  Input = unknown,
  Output = unknown,
  Error = never,
> = (
  input: Input,
  output: Output,
  context: CommerceWorkflowContext
) => Effect.Effect<void, Error>;

export interface CommerceWorkflowCompensation<
  Input = unknown,
  Output = unknown,
  Error = never,
> {
  readonly name: string;
  readonly policy?: CommerceWorkflowCompensationPolicy;
  readonly compensate: WorkflowCompensationHandler<Input, Output, Error>;
}

export interface CommerceWorkflowStep<
  Input = unknown,
  Output = unknown,
  Error = never,
> {
  readonly name: string;
  readonly retryPolicy?: CommerceWorkflowRetryPolicy;
  readonly schemaVersion?: CommerceWorkflowSchemaVersion;
  readonly run: WorkflowStepHandler<Input, Output, Error>;
  readonly compensation?: CommerceWorkflowCompensation<Input, Output, Error>;
}

export interface CommerceWorkflowDefinition<Input = unknown, Output = unknown> {
  readonly key: CommerceWorkflowKey;
  readonly version: CommerceWorkflowVersion;
  readonly schemaVersion?: CommerceWorkflowSchemaVersion;
  // oxlint-disable-next-line typescript/no-explicit-any
  readonly steps: readonly CommerceWorkflowStep<Input, any, any>[];
  readonly resolveOutput?: (
    attempts: readonly CommerceWorkflowStepAttempt[]
  ) => Output;
}

export interface CommerceWorkflowRunRecord<
  Input = unknown,
  Output = unknown,
  Metadata extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly runId: CommerceWorkflowRunId;
  readonly workflowKey: CommerceWorkflowKey;
  readonly workflowVersion: CommerceWorkflowVersion;
  readonly status: CommerceWorkflowRunStatus;
  readonly input: Input;
  readonly output?: Output;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly idempotencyKey?: CommerceWorkflowIdempotencyKey;
  readonly subject?: CommerceWorkflowSubject;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly completedAt?: Date;
  readonly attempts?: readonly CommerceWorkflowStepAttempt[];
  readonly historyReference?: CommerceWorkflowHistoryReference;
  readonly metadata?: Metadata;
}

export interface CommerceWorkflowStartRequest<
  Input = unknown,
  Output = unknown,
  Metadata extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly workflow: CommerceWorkflowDefinition<Input, Output>;
  readonly input: Input;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly idempotencyKey?: CommerceWorkflowIdempotencyKey;
  readonly runId?: CommerceWorkflowRunId;
  readonly subject?: CommerceWorkflowSubject;
  readonly metadata?: Metadata;
}

export interface CommerceWorkflowDuplicateQuery {
  readonly workflowKey: CommerceWorkflowKey;
  readonly idempotencyKey: CommerceWorkflowIdempotencyKey;
}

export interface CommerceWorkflowReconcileRequest {
  readonly runId: CommerceWorkflowRunId;
}

export interface CommerceWorkflowMetadataRecord {
  readonly runId: CommerceWorkflowRunId;
  readonly workflowKey: CommerceWorkflowKey;
  readonly workflowVersion: CommerceWorkflowVersion;
  readonly status: CommerceWorkflowRunStatus;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly idempotencyKey?: CommerceWorkflowIdempotencyKey;
  readonly subject?: CommerceWorkflowSubject;
  readonly metadata?: Record<string, unknown>;
  readonly updatedAt: Date;
}

export interface CommerceWorkflowMetadataRegistrationResult {
  readonly status: "created" | "duplicate";
  readonly record: CommerceWorkflowMetadataRecord;
}

export interface CommerceWorkflowMetadataStore {
  getRun(
    runId: CommerceWorkflowRunId
  ):
    | Promise<CommerceWorkflowMetadataRecord | null>
    | CommerceWorkflowMetadataRecord
    | null;
  findRunByIdempotencyKey(
    query: CommerceWorkflowDuplicateQuery
  ):
    | Promise<CommerceWorkflowMetadataRecord | null>
    | CommerceWorkflowMetadataRecord
    | null;
  registerRun(
    record: CommerceWorkflowMetadataRecord
  ):
    | Promise<CommerceWorkflowMetadataRegistrationResult>
    | CommerceWorkflowMetadataRegistrationResult;
  upsertRun(record: CommerceWorkflowMetadataRecord): Promise<void> | void;
  appendEvent(
    event: CommerceEventEnvelope<string, unknown>
  ): Promise<void> | void;
}

export interface CommerceWorkflowRuntime {
  readonly capabilities: CommerceWorkflowRuntimeCapabilities;
  start<Input, Output>(
    request: CommerceWorkflowStartRequest<Input, Output>
  ): Promise<CommerceWorkflowRunRecord<Input, Output>>;
  get<Output = unknown>(
    runId: CommerceWorkflowRunId
  ): Promise<CommerceWorkflowRunRecord<unknown, Output> | null>;
  dedupe<Output = unknown>(
    query: CommerceWorkflowDuplicateQuery
  ): Promise<CommerceWorkflowRunRecord<unknown, Output> | null>;
  reconcile<Output = unknown>(
    request: CommerceWorkflowReconcileRequest
  ): Promise<CommerceWorkflowRunRecord<unknown, Output> | null>;
}

export const WORKFLOW_LIFECYCLE_EVENT_NAMES = {
  started: "workflow.started",
  stepSucceeded: "workflow.step-succeeded",
  stepFailed: "workflow.step-failed",
  compensationStarted: "workflow.compensation-started",
  compensationCompleted: "workflow.compensation-completed",
  completed: "workflow.completed",
  failed: "workflow.failed",
} as const;

export type WorkflowLifecycleEventName =
  (typeof WORKFLOW_LIFECYCLE_EVENT_NAMES)[keyof typeof WORKFLOW_LIFECYCLE_EVENT_NAMES];

interface WorkflowLifecycleEventBase<
  Name extends WorkflowLifecycleEventName,
  Status extends CommerceWorkflowRunStatus,
> {
  readonly type: Name;
  readonly runId: CommerceWorkflowRunId;
  readonly workflowKey: CommerceWorkflowKey;
  readonly workflowVersion: CommerceWorkflowVersion;
  readonly status: Status;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly idempotencyKey?: CommerceWorkflowIdempotencyKey;
  readonly subject?: CommerceWorkflowSubject;
  readonly occurredAt: Date;
}

export type WorkflowStartedEventPayload = WorkflowLifecycleEventBase<
  typeof WORKFLOW_LIFECYCLE_EVENT_NAMES.started,
  "pending" | "running"
>;

export interface WorkflowStepSucceededEventPayload extends WorkflowLifecycleEventBase<
  typeof WORKFLOW_LIFECYCLE_EVENT_NAMES.stepSucceeded,
  "running"
> {
  readonly stepName: string;
  readonly stepId: string;
  readonly attempt: number;
}

export interface WorkflowStepFailedEventPayload extends WorkflowLifecycleEventBase<
  typeof WORKFLOW_LIFECYCLE_EVENT_NAMES.stepFailed,
  "failed" | "compensating"
> {
  readonly stepName: string;
  readonly stepId: string;
  readonly attempt: number;
  readonly error: CommerceWorkflowRunError;
}

export interface WorkflowCompensationEventPayload extends WorkflowLifecycleEventBase<
  | typeof WORKFLOW_LIFECYCLE_EVENT_NAMES.compensationStarted
  | typeof WORKFLOW_LIFECYCLE_EVENT_NAMES.compensationCompleted,
  "compensating" | "compensated"
> {
  readonly stepName: string;
  readonly stepId: string;
}

export interface WorkflowCompletedEventPayload<
  Output = unknown,
> extends WorkflowLifecycleEventBase<
  typeof WORKFLOW_LIFECYCLE_EVENT_NAMES.completed,
  "completed"
> {
  readonly output?: Output;
}

export interface WorkflowFailedEventPayload extends WorkflowLifecycleEventBase<
  typeof WORKFLOW_LIFECYCLE_EVENT_NAMES.failed,
  "failed" | "compensated"
> {
  readonly error: CommerceWorkflowRunError;
}

export type WorkflowLifecycleEventPayload<Output = unknown> =
  | WorkflowStartedEventPayload
  | WorkflowStepSucceededEventPayload
  | WorkflowStepFailedEventPayload
  | WorkflowCompensationEventPayload
  | WorkflowCompletedEventPayload<Output>
  | WorkflowFailedEventPayload;

export const defineWorkflowStep = <
  Input = unknown,
  Output = unknown,
  Error = never,
>(
  step: CommerceWorkflowStep<Input, Output, Error>
): CommerceWorkflowStep<Input, Output, Error> => step;

export const defineWorkflow = <Input = unknown, Output = unknown>(
  definition: CommerceWorkflowDefinition<Input, Output>
): CommerceWorkflowDefinition<Input, Output> => definition;

/**
 * Creates the durable, schema-versioned descriptor for a workflow definition.
 *
 * Executable Effect handlers stay on `CommerceWorkflowDefinition`; this
 * descriptor is the adapter-neutral shape that can be stored, replayed, and
 * compared across in-memory, Cloudflare, or future workflow runtimes.
 */
export const describeWorkflowDefinition = (
  definition: CommerceWorkflowDefinition
): CommerceWorkflowDefinitionDescriptor => ({
  key: Schema.decodeUnknownSync(CommerceWorkflowKeySchema)(definition.key),
  schemaVersion: definition.schemaVersion ?? definition.version,
  steps: definition.steps.map((step) => ({
    compensation:
      step.compensation?.policy ??
      (step.compensation
        ? {
            required: true,
            stepName: step.compensation.name,
          }
        : undefined),
    name: step.name,
    retryPolicy: step.retryPolicy,
    schemaVersion: step.schemaVersion ?? definition.schemaVersion ?? 1,
  })),
  version: definition.version,
});

export const createWorkflowRunError = (
  error: unknown
): CommerceWorkflowRunError => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return {
    name: "WorkflowError",
    message: String(error),
  };
};
