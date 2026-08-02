import { Clock, Context, Effect, Exit, Layer, Schema } from "effect";
import type { Effect as EffectType } from "effect/Effect";

import type {
  AuditPersistenceUnavailable,
  DurableAudit,
  DurableAuditEvent,
} from "../telemetry/index";
import { recordDurableAudit, withOperationTelemetry } from "../telemetry/index";
import {
  SandboxBridgeContextSchema,
  SandboxBridgeOperationSchema,
} from "./sandbox-plugin-schema";
import type {
  SandboxBridgeContext,
  SandboxBridgeOperation,
} from "./sandbox-plugin-schema";

export class SandboxBridgeFailure extends Schema.TaggedErrorClass<SandboxBridgeFailure>()(
  "SandboxBridgeFailure",
  {
    code: Schema.Literals([
      "capability-denied",
      "deadline-exceeded",
      "invalid-input",
      "quota-exceeded",
    ]),
    correlationId: Schema.optional(Schema.NonEmptyString),
    message: Schema.NonEmptyString,
    operationType: Schema.NonEmptyString,
    pluginId: Schema.NonEmptyString,
    reason: Schema.optional(Schema.NonEmptyString),
    resource: Schema.optional(Schema.NonEmptyString),
    tenantId: Schema.NonEmptyString,
    traceId: Schema.optional(Schema.NonEmptyString),
  }
) {}

export interface SandboxBridgeQuota {
  readonly key: string;
  readonly limit: number;
}

export interface SandboxCapabilityBridgeInvocation {
  readonly context: unknown;
  readonly deadlineEpochMillis?: number;
  readonly nowEpochMillis?: number;
  readonly operation: unknown;
  readonly payload?: unknown;
  readonly quota?: SandboxBridgeQuota;
}

export interface SandboxCapabilityBridgeHandlerInput {
  readonly context: SandboxBridgeContext;
  readonly operation: SandboxBridgeOperation;
  readonly payload?: unknown;
}

export type SandboxCapabilityBridgeHandler = (
  input: SandboxCapabilityBridgeHandlerInput
) => EffectType<unknown, SandboxBridgeFailure>;

export interface SandboxCapabilityBridgeOptions {
  readonly handler: SandboxCapabilityBridgeHandler;
}

export interface SandboxCapabilityBridgeService {
  readonly invoke: (
    input: SandboxCapabilityBridgeInvocation
  ) => EffectType<
    unknown,
    AuditPersistenceUnavailable | SandboxBridgeFailure,
    DurableAudit
  >;
}

export type SandboxCapabilityBridgeServiceShape =
  SandboxCapabilityBridgeService;

export const SandboxCapabilityBridgeService =
  Context.Service<SandboxCapabilityBridgeService>(
    "@ecommerce/core/SandboxCapabilityBridgeService"
  );

const UNKNOWN_VALUE = "unknown";

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getStringProperty = (value: unknown, key: string): string | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const property = value[key];
  return typeof property === "string" && property.length > 0
    ? property
    : undefined;
};

const fallbackContext = (context: unknown): SandboxBridgeFailureContext => ({
  correlationId: getStringProperty(context, "correlationId"),
  lifecycleState: getStringProperty(context, "lifecycleState"),
  pluginId: getStringProperty(context, "pluginId") ?? UNKNOWN_VALUE,
  tenantId: getStringProperty(context, "tenantId") ?? UNKNOWN_VALUE,
  traceId: getStringProperty(context, "traceId"),
});

const fallbackOperationType = (operation: unknown): string =>
  getStringProperty(operation, "type") ?? UNKNOWN_VALUE;

interface SandboxBridgeFailureContext {
  readonly correlationId?: string;
  readonly lifecycleState?: string;
  readonly pluginId: string;
  readonly tenantId: string;
  readonly traceId?: string;
}

const contextFromDecoded = (
  context: SandboxBridgeContext
): SandboxBridgeFailureContext => ({
  correlationId: context.correlationId,
  lifecycleState: context.lifecycleState,
  pluginId: context.pluginId,
  tenantId: context.tenantId,
  traceId: context.traceId,
});

const createAuditEvent = ({
  context,
  decision,
  operation,
  reason,
  resource,
}: {
  readonly context: SandboxBridgeFailureContext;
  readonly decision: "allow" | "deny";
  readonly operation: string;
  readonly reason: string;
  readonly resource?: string;
}): DurableAuditEvent => ({
  attributes: {
    decision,
    operationType: operation,
    pluginId: context.pluginId,
    reason,
    tenantId: context.tenantId,
    ...(context.lifecycleState
      ? { lifecycleState: context.lifecycleState }
      : {}),
    ...(resource ? { resource } : {}),
  },
  correlation: {
    requestId: context.correlationId ?? UNKNOWN_VALUE,
    traceId: context.traceId,
  },
  eventId: [
    "sandbox-bridge",
    context.pluginId,
    context.correlationId ?? UNKNOWN_VALUE,
    operation,
    decision,
  ].join(":"),
  eventType: `sandbox.bridge.${decision}`,
  subjectId: context.pluginId,
});

const audit = (
  event: DurableAuditEvent
): EffectType<void, AuditPersistenceUnavailable, DurableAudit> =>
  recordDurableAudit(event);

const failWithAudit = ({
  code,
  context,
  operation,
  reason,
  resource,
}: {
  readonly code: SandboxBridgeFailure["code"];
  readonly context: SandboxBridgeFailureContext;
  readonly operation: string;
  readonly reason: string;
  readonly resource?: string;
}): EffectType<
  never,
  AuditPersistenceUnavailable | SandboxBridgeFailure,
  DurableAudit
> =>
  audit(
    createAuditEvent({
      context,
      decision: "deny",
      operation,
      reason,
      resource,
    })
  ).pipe(
    Effect.flatMap(() =>
      Effect.fail(
        new SandboxBridgeFailure({
          code,
          correlationId: context.correlationId,
          message: reason,
          operationType: operation,
          pluginId: context.pluginId,
          reason,
          resource,
          tenantId: context.tenantId,
          traceId: context.traceId,
        })
      )
    )
  );

const decodeContext = (
  context: unknown
): EffectType<SandboxBridgeContext, SandboxBridgeFailure> =>
  Effect.try({
    try: () => Schema.decodeUnknownSync(SandboxBridgeContextSchema)(context),
    catch: () =>
      new SandboxBridgeFailure({
        code: "invalid-input",
        correlationId: fallbackContext(context).correlationId,
        message: "Sandbox bridge context failed schema decoding.",
        operationType: UNKNOWN_VALUE,
        pluginId: fallbackContext(context).pluginId,
        reason: "context",
        tenantId: fallbackContext(context).tenantId,
        traceId: fallbackContext(context).traceId,
      }),
  });

const decodeOperation = (
  operation: unknown,
  context: SandboxBridgeContext
): EffectType<SandboxBridgeOperation, SandboxBridgeFailure> =>
  Effect.try({
    try: () =>
      Schema.decodeUnknownSync(SandboxBridgeOperationSchema)(operation),
    catch: () =>
      new SandboxBridgeFailure({
        code: "invalid-input",
        correlationId: context.correlationId,
        message: "Sandbox bridge message failed schema decoding.",
        operationType: fallbackOperationType(operation),
        pluginId: context.pluginId,
        reason: "operation",
        tenantId: context.tenantId,
        traceId: context.traceId,
      }),
  });

const getCurrentMillis = (
  input: SandboxCapabilityBridgeInvocation
): EffectType<number> =>
  typeof input.nowEpochMillis === "number"
    ? Effect.succeed(input.nowEpochMillis)
    : Clock.currentTimeMillis;

const enforceDeadline = ({
  context,
  input,
  operation,
}: {
  readonly context: SandboxBridgeContext;
  readonly input: SandboxCapabilityBridgeInvocation;
  readonly operation: SandboxBridgeOperation;
}): EffectType<
  void,
  AuditPersistenceUnavailable | SandboxBridgeFailure,
  DurableAudit
> => {
  const deadline = input.deadlineEpochMillis;
  if (typeof deadline !== "number") {
    return Effect.void;
  }

  return getCurrentMillis(input).pipe(
    Effect.flatMap((now) =>
      now > deadline
        ? failWithAudit({
            code: "deadline-exceeded",
            context: contextFromDecoded(context),
            operation: operation.type,
            reason: "Sandbox bridge operation deadline exceeded.",
            resource: operation.resource,
          })
        : Effect.void
    )
  );
};

const enforceCapability = ({
  context,
  operation,
}: {
  readonly context: SandboxBridgeContext;
  readonly operation: SandboxBridgeOperation;
}): EffectType<
  void,
  AuditPersistenceUnavailable | SandboxBridgeFailure,
  DurableAudit
> =>
  context.grantedCapabilities.includes(operation.capability)
    ? Effect.void
    : failWithAudit({
        code: "capability-denied",
        context: contextFromDecoded(context),
        operation: operation.type,
        reason: `Capability "${operation.capability}" is not granted.`,
        resource: operation.resource,
      });

const enforceQuota = ({
  context,
  counters,
  input,
  operation,
}: {
  readonly context: SandboxBridgeContext;
  readonly counters: Map<string, number>;
  readonly input: SandboxCapabilityBridgeInvocation;
  readonly operation: SandboxBridgeOperation;
}): EffectType<
  void,
  AuditPersistenceUnavailable | SandboxBridgeFailure,
  DurableAudit
> => {
  if (!input.quota) {
    return Effect.void;
  }

  const current = counters.get(input.quota.key) ?? 0;
  if (current >= input.quota.limit) {
    return failWithAudit({
      code: "quota-exceeded",
      context: contextFromDecoded(context),
      operation: operation.type,
      reason: "Sandbox bridge operation quota exceeded.",
      resource: operation.resource,
    });
  }

  counters.set(input.quota.key, current + 1);
  return Effect.void;
};

const auditAllowed = ({
  context,
  operation,
}: {
  readonly context: SandboxBridgeContext;
  readonly operation: SandboxBridgeOperation;
}): EffectType<void, AuditPersistenceUnavailable, DurableAudit> =>
  audit(
    createAuditEvent({
      context: contextFromDecoded(context),
      decision: "allow",
      operation: operation.type,
      reason: `Capability "${operation.capability}" granted.`,
      resource: operation.resource,
    })
  );

const invokeWithDecodedInput = (
  counters: Map<string, number>,
  handler: SandboxCapabilityBridgeHandler,
  input: SandboxCapabilityBridgeInvocation,
  context: SandboxBridgeContext,
  operation: SandboxBridgeOperation
): EffectType<
  unknown,
  AuditPersistenceUnavailable | SandboxBridgeFailure,
  DurableAudit
> =>
  Effect.gen(function* invokeDecodedSandboxBridgeOperation() {
    yield* enforceDeadline({ context, input, operation });
    yield* enforceCapability({ context, operation });
    yield* enforceQuota({ context, counters, input, operation });
    yield* auditAllowed({ context, operation });
    return yield* handler({
      context,
      operation,
      payload: input.payload,
    });
  });

export const createSandboxCapabilityBridgeService = ({
  handler,
}: SandboxCapabilityBridgeOptions): SandboxCapabilityBridgeService => {
  const counters = new Map<string, number>();

  return {
    invoke: (input) => {
      const program = Effect.gen(function* invokeSandboxBridge() {
        const contextExit = yield* Effect.exit(decodeContext(input.context));
        if (Exit.isFailure(contextExit)) {
          return yield* failWithAudit({
            code: "invalid-input",
            context: fallbackContext(input.context),
            operation: fallbackOperationType(input.operation),
            reason: "Sandbox bridge context failed schema decoding.",
          });
        }

        const context = contextExit.value;
        const operationExit = yield* Effect.exit(
          decodeOperation(input.operation, context)
        );
        if (Exit.isFailure(operationExit)) {
          return yield* failWithAudit({
            code: "invalid-input",
            context: contextFromDecoded(context),
            operation: fallbackOperationType(input.operation),
            reason: "Sandbox bridge message failed schema decoding.",
          });
        }

        return yield* invokeWithDecodedInput(
          counters,
          handler,
          input,
          context,
          operationExit.value
        );
      });

      return withOperationTelemetry(program, {
        attributes: {
          pluginId:
            getStringProperty(input.context, "pluginId") ?? UNKNOWN_VALUE,
        },
        correlation: {
          requestId:
            getStringProperty(input.context, "correlationId") ?? UNKNOWN_VALUE,
          traceId: getStringProperty(input.context, "traceId"),
        },
        name: "plugin.sandbox.bridge",
      });
    },
  };
};

export const createSandboxCapabilityBridgeLayer = (
  options: SandboxCapabilityBridgeOptions
): Layer.Layer<SandboxCapabilityBridgeService> =>
  Layer.succeed(
    SandboxCapabilityBridgeService,
    SandboxCapabilityBridgeService.of(
      createSandboxCapabilityBridgeService(options)
    )
  );

export const invokeSandboxBridgeOperation = (
  input: SandboxCapabilityBridgeInvocation
): EffectType<
  unknown,
  AuditPersistenceUnavailable | SandboxBridgeFailure,
  DurableAudit | SandboxCapabilityBridgeService
> => SandboxCapabilityBridgeService.use((service) => service.invoke(input));
