import {
  operationOutcomeFromCause,
  sanitizeTelemetryAttributes,
} from "@ecommerce/core";
import type {
  OperationOutcome,
  TelemetryAttributes,
  TelemetryAttributeValue,
} from "@ecommerce/core";
import { Effect, Exit, Layer, Logger, References, Tracer } from "effect";

/**
 * Console-compatible sink available in Cloudflare Workers.
 *
 * Workers Logs consumes structured console payloads without a separate
 * credentialed exporter. This is the first Cloudflare telemetry exporter Layer;
 * remote OTLP/observability vendors can be added later behind another Layer.
 */
export interface CloudflareTelemetryConsole {
  readonly debug?: (payload: CloudflareTelemetryRecord) => void;
  readonly error?: (payload: CloudflareTelemetryRecord) => void;
  readonly info?: (payload: CloudflareTelemetryRecord) => void;
  readonly log?: (payload: CloudflareTelemetryRecord) => void;
  readonly warn?: (payload: CloudflareTelemetryRecord) => void;
}

export type CloudflareTelemetryMessage =
  | TelemetryAttributeValue
  | readonly TelemetryAttributeValue[];

export interface CloudflareTelemetryLogRecord {
  readonly annotations: TelemetryAttributes;
  readonly kind: "effect.log";
  readonly level: string;
  readonly message: CloudflareTelemetryMessage;
  readonly timestamp: string;
}

export interface CloudflareTelemetrySpanRecord {
  readonly attributes: TelemetryAttributes;
  readonly durationMillis: number;
  readonly endTimeNanos: string;
  readonly eventCount: number;
  readonly kind: "effect.span";
  readonly name: string;
  readonly outcome: OperationOutcome;
  readonly sampled: boolean;
  readonly spanId: string;
  readonly startTimeNanos: string;
  readonly traceId: string;
}

export type CloudflareTelemetryRecord =
  | CloudflareTelemetryLogRecord
  | CloudflareTelemetrySpanRecord;

export interface CloudflareTelemetryLayerOptions {
  readonly console?: CloudflareTelemetryConsole;
}

const UNSUPPORTED_MESSAGE = "<unsupported>";
const NANOS_PER_MILLI = 1_000_000n;

const defaultConsole: CloudflareTelemetryConsole = console;

const isTelemetryAttributeValue = (
  value: unknown
): value is TelemetryAttributeValue =>
  typeof value === "boolean" ||
  typeof value === "string" ||
  (typeof value === "number" && Number.isFinite(value));

const toTelemetryMessage = (message: unknown): CloudflareTelemetryMessage => {
  if (isTelemetryAttributeValue(message)) {
    return message;
  }
  if (Array.isArray(message)) {
    return message.map((entry) =>
      isTelemetryAttributeValue(entry) ? entry : UNSUPPORTED_MESSAGE
    );
  }
  return UNSUPPORTED_MESSAGE;
};

const attributesFromMap = (
  attributes: ReadonlyMap<string, unknown>
): TelemetryAttributes =>
  sanitizeTelemetryAttributes(Object.fromEntries(attributes.entries()));

const spanOutcome = (exit: Exit.Exit<unknown, unknown>): OperationOutcome =>
  Exit.isSuccess(exit) ? "success" : operationOutcomeFromCause(exit.cause);

const durationMillis = (startTime: bigint, endTime: bigint): number =>
  Number((endTime - startTime) / NANOS_PER_MILLI);

const emit = (
  target: CloudflareTelemetryConsole,
  method: keyof CloudflareTelemetryConsole,
  payload: CloudflareTelemetryRecord
): void => {
  try {
    (target[method] ?? target.log)?.(payload);
  } catch {
    // Export is observational; platform console defects must not escape.
  }
};

const consoleMethodForLevel = (
  level: string
): keyof CloudflareTelemetryConsole => {
  switch (level) {
    case "Fatal":
    case "Error": {
      return "error";
    }
    case "Warn": {
      return "warn";
    }
    case "Debug":
    case "Trace": {
      return "debug";
    }
    default: {
      return "info";
    }
  }
};

const createCloudflareConsoleLogger = (target: CloudflareTelemetryConsole) =>
  Logger.make((options) => {
    const annotations = sanitizeTelemetryAttributes(
      options.fiber.getRef(References.CurrentLogAnnotations)
    );
    const level = options.logLevel;
    emit(target, consoleMethodForLevel(level), {
      annotations,
      kind: "effect.log",
      level,
      message: toTelemetryMessage(options.message),
      timestamp: options.date.toISOString(),
    });
  });

const createSpanId = (prefix: string, index: number): string =>
  `${prefix}_${index.toString(36).padStart(8, "0")}`;

const createCloudflareConsoleTracer = (
  target: CloudflareTelemetryConsole
): Tracer.Tracer => {
  let spanSequence = 0;

  return Tracer.make({
    span: (options) => {
      spanSequence += 1;
      const attributes = new Map<string, unknown>();
      const links = [...options.links];
      const events: {
        readonly attributes: Record<string, unknown>;
        readonly name: string;
        readonly startTime: bigint;
      }[] = [];
      const { startTime } = options;
      let status: Tracer.SpanStatus = {
        _tag: "Started",
        startTime,
      };
      const traceId =
        options.parent._tag === "Some"
          ? options.parent.value.traceId
          : createSpanId("trace", spanSequence);
      const spanId = createSpanId("span", spanSequence);

      return {
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
            startTime,
          };
          emit(target, "info", {
            attributes: attributesFromMap(attributes),
            durationMillis: durationMillis(startTime, endTime),
            endTimeNanos: endTime.toString(),
            eventCount: events.length,
            kind: "effect.span",
            name: options.name,
            outcome: spanOutcome(exit),
            sampled: options.sampled,
            spanId,
            startTimeNanos: startTime.toString(),
            traceId,
          });
        },
        event: (name, eventStartTime, eventAttributes = {}) => {
          events.push({
            attributes: eventAttributes,
            name,
            startTime: eventStartTime,
          });
        },
        get status() {
          return status;
        },
        kind: options.kind,
        links,
        name: options.name,
        parent: options.parent,
        sampled: options.sampled,
        spanId,
        traceId,
      };
    },
  });
};

/**
 * First Cloudflare telemetry exporter Layer.
 *
 * The Layer emits Effect logs and completed spans as structured console
 * records, which Cloudflare Workers Logs can collect natively. It deliberately
 * does not implement durable audit persistence; required audit records continue
 * to use the explicit `DurableAudit` service.
 */
export const createCloudflareTelemetryLayer = ({
  console: target = defaultConsole,
}: CloudflareTelemetryLayerOptions = {}): Layer.Layer<never> =>
  Layer.mergeAll(
    Logger.layer([createCloudflareConsoleLogger(target)]),
    Layer.succeed(Tracer.Tracer, createCloudflareConsoleTracer(target))
  );

/**
 * Convenience wrapper for running an Effect with the Cloudflare console
 * telemetry exporter installed.
 */
export const withCloudflareTelemetry = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  options?: CloudflareTelemetryLayerOptions
): Effect.Effect<A, E, R> =>
  effect.pipe(Effect.provide(createCloudflareTelemetryLayer(options)));
