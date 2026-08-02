import type { Cause } from "effect";
import { Clock, Context, Effect, Exit, Metric, Redacted } from "effect";

import { classifyCause } from "../errors/effect-error-policy";
import type { AuditPersistenceUnavailable } from "./audit-persistence-unavailable";

export { AuditPersistenceUnavailable } from "./audit-persistence-unavailable";

const REDACTED_VALUE = "<redacted>";
const UNSUPPORTED_VALUE = "<unsupported>";
const MAX_ATTRIBUTE_STRING_LENGTH = 256;

export const commerceOperationNames = [
  "plugin.lifecycle",
  "plugin.sandbox.bridge",
  "store.read",
  "unknown",
] as const;

export type CommerceOperationName = (typeof commerceOperationNames)[number];

const exactProtectedAttributeNames = new Set([
  "apikey",
  "authorization",
  "connectionstring",
  "cookie",
  "databaseurl",
  "password",
  "privatekey",
  "secret",
  "setcookie",
  "token",
]);

const compoundProtectedAttributeFragments = [
  "apikey",
  "authorization",
  "connectionstring",
  "cookie",
  "databaseurl",
  "password",
  "privatekey",
  "secret",
  "setcookie",
  "token",
] as const;

export type TelemetryAttributeValue = boolean | number | string;

export type TelemetryAttributes = Readonly<
  Record<string, TelemetryAttributeValue>
>;

export type OperationOutcome =
  | "defect"
  | "expected_failure"
  | "interrupted"
  | "mixed"
  | "success";

export interface CorrelationContext {
  readonly operationId?: string;
  readonly requestId: string;
  readonly traceId?: string;
}

export interface OperationTelemetryOptions {
  readonly attributes?: Readonly<Record<string, unknown>>;
  readonly correlation: CorrelationContext;
  readonly name: string;
}

const operationCounter = Metric.counter("commerce_operation_total", {
  description: "Completed commerce operations by stable operation and outcome",
});

const normalizeAttributeName = (name: string): string =>
  name.replaceAll(/[^a-zA-Z0-9]/gu, "").toLowerCase();

const isProtectedAttributeName = (name: string): boolean => {
  const normalized = normalizeAttributeName(name);

  return (
    exactProtectedAttributeNames.has(normalized) ||
    compoundProtectedAttributeFragments.some((fragment) =>
      normalized.includes(fragment)
    )
  );
};

const sanitizeTelemetryValue = (value: unknown): TelemetryAttributeValue => {
  if (Redacted.isRedacted(value)) {
    return REDACTED_VALUE;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : UNSUPPORTED_VALUE;
  }
  if (typeof value === "string") {
    return value.length <= MAX_ATTRIBUTE_STRING_LENGTH
      ? value
      : UNSUPPORTED_VALUE;
  }
  return UNSUPPORTED_VALUE;
};

/** Guards runtime values before they become metric labels or span names. */
export const isCommerceOperationName = (
  value: string
): value is CommerceOperationName =>
  commerceOperationNames.some((name) => name === value);

const normalizeCommerceOperationName = (value: string): CommerceOperationName =>
  isCommerceOperationName(value) ? value : "unknown";

/** Removes protected and unbounded values before telemetry export. */
export const sanitizeTelemetryAttributes = (
  attributes: Readonly<Record<string, unknown>>
): TelemetryAttributes => {
  const sanitized: Record<string, TelemetryAttributeValue> = {};
  for (const [name, value] of Object.entries(attributes)) {
    if (value === undefined) {
      continue;
    }
    sanitized[name] = isProtectedAttributeName(name)
      ? REDACTED_VALUE
      : sanitizeTelemetryValue(value);
  }
  return sanitized;
};

/** Maps a complete Cause to a bounded metric outcome vocabulary. */
export const operationOutcomeFromCause = <E>(
  cause: Cause.Cause<E>
): Exclude<OperationOutcome, "success"> => {
  const classification = classifyCause(cause);
  const categoryCount = [
    classification.hasDefect,
    classification.hasExpectedFailure,
    classification.hasInterruption,
  ].filter(Boolean).length;

  if (categoryCount > 1) {
    return "mixed";
  }
  if (classification.hasDefect) {
    return "defect";
  }
  if (classification.hasInterruption) {
    return "interrupted";
  }
  return "expected_failure";
};

const recordOperationOutcome = (
  name: CommerceOperationName,
  outcome: OperationOutcome
): Effect.Effect<void> =>
  Metric.update(
    Metric.withAttributes(operationCounter, { operation: name, outcome }),
    1
  );

const runWithIsolatedSpan = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  name: CommerceOperationName,
  attributes: TelemetryAttributes
): Effect.Effect<A, E, R> =>
  Effect.gen(function* executeWithIsolatedSpan() {
    const spanExit = yield* Effect.exit(Effect.makeSpan(name, { attributes }));
    if (Exit.isFailure(spanExit)) {
      return yield* effect;
    }

    const span = spanExit.value;
    const operationExit = yield* Effect.exit(
      effect.pipe(Effect.withParentSpan(span))
    );
    yield* Effect.exit(
      Effect.gen(function* finalizeIsolatedSpan() {
        const endTime = yield* Clock.currentTimeNanos;
        span.end(endTime, operationExit);
      })
    );

    return Exit.isSuccess(operationExit)
      ? operationExit.value
      : yield* Effect.failCause(operationExit.cause);
  });

/**
 * Adds safe correlation to logs and spans and records a bounded operation
 * outcome without changing the operation's success or Cause.
 */
export const withOperationTelemetry = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  options: OperationTelemetryOptions
): Effect.Effect<A, E, R> => {
  const operationName = normalizeCommerceOperationName(options.name);
  const annotations = sanitizeTelemetryAttributes({
    ...options.attributes,
    operation: operationName,
    operationId: options.correlation.operationId,
    requestId: options.correlation.requestId,
    traceId: options.correlation.traceId,
  });

  const observeExit = (exit: Exit.Exit<A, E>): Effect.Effect<void> => {
    let telemetry: Effect.Effect<unknown>;
    if (Exit.isSuccess(exit)) {
      telemetry = Effect.all([
        recordOperationOutcome(operationName, "success"),
        Effect.logInfo("commerce.operation.succeeded"),
      ]);
    } else {
      const outcome = operationOutcomeFromCause(exit.cause);
      telemetry = Effect.all([
        recordOperationOutcome(operationName, outcome),
        Effect.logError("commerce.operation.failed", { outcome }),
      ]);
    }

    // Exporters are observational. Capturing their complete Exit prevents a
    // logger or metric defect/interruption from contaminating commerce logic.
    return telemetry.pipe(
      Effect.annotateLogs(annotations),
      Effect.exit,
      Effect.asVoid
    );
  };

  return runWithIsolatedSpan(effect, operationName, annotations).pipe(
    Effect.onExit(observeExit)
  );
};

export class DurableAudit extends Context.Service<
  DurableAudit,
  {
    readonly record: (
      event: DurableAuditEvent
    ) => Effect.Effect<void, AuditPersistenceUnavailable>;
  }
>()("@ecommerce/core/DurableAudit") {}

/** Security or commerce evidence that must be durably persisted. */
export interface DurableAuditEvent {
  readonly actorId?: string;
  readonly attributes: TelemetryAttributes;
  readonly correlation: CorrelationContext;
  readonly eventId: string;
  readonly eventType: string;
  readonly subjectId?: string;
}

/** Records required audit evidence through its explicit durable service. */
export const recordDurableAudit = (
  event: DurableAuditEvent
): Effect.Effect<void, AuditPersistenceUnavailable, DurableAudit> =>
  DurableAudit.use((audit) => audit.record(event));
