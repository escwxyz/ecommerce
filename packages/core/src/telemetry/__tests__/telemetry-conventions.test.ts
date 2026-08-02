import { describe, expect, it } from "bun:test";

import {
  Cause,
  Context,
  Effect,
  Exit,
  Layer,
  Logger,
  Redacted,
  References,
  Tracer,
} from "effect";

import {
  AuditPersistenceUnavailable,
  DurableAudit,
  correlationContextFromHeaders,
  correlationContextToHeaders,
  correlationContextToTelemetryAttributes,
  isCommerceOperationName,
  operationOutcomeFromCause,
  recordDurableAudit,
  sanitizeTelemetryAttributes,
  withOperationTelemetry,
} from "../index";

describe("Effect telemetry conventions", () => {
  it("parses, serializes, and sanitizes portable correlation context", () => {
    const context = correlationContextFromHeaders(
      {
        traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
        "x-correlation-id": "corr_1",
        "x-request-id": "req_1",
      },
      "req_generated"
    );

    expect(context).toEqual({
      operationId: "corr_1",
      parentSpanId: "00f067aa0ba902b7",
      requestId: "req_1",
      sampled: true,
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
    });
    expect(correlationContextToHeaders(context)).toEqual({
      traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
      "x-correlation-id": "corr_1",
      "x-request-id": "req_1",
      "x-trace-id": "4bf92f3577b34da6a3ce929d0e0e4736",
    });
    expect(correlationContextToTelemetryAttributes(context)).toEqual({
      operationId: "corr_1",
      parentSpanId: "00f067aa0ba902b7",
      requestId: "req_1",
      sampled: true,
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
    });
  });

  it("redacts protected keys and rejects unbounded attribute values", () => {
    const rawSecret = "postgres://commerce:secret@localhost/commerce";
    const attributes = sanitizeTelemetryAttributes({
      attempts: 2,
      accessToken: "access-token-secret",
      databaseUrl: rawSecret,
      infinite: Number.POSITIVE_INFINITY,
      longValue: "x".repeat(257),
      metadata: { rawSecret },
      provider: "postgres",
      refresh_token: "refresh-token-secret",
      stripeSecret: "stripe-secret",
      token: Redacted.make("provider-token"),
    });

    expect(attributes).toEqual({
      accessToken: "<redacted>",
      attempts: 2,
      databaseUrl: "<redacted>",
      infinite: "<unsupported>",
      longValue: "<unsupported>",
      metadata: "<unsupported>",
      provider: "postgres",
      refresh_token: "<redacted>",
      stripeSecret: "<redacted>",
      token: "<redacted>",
    });
    expect(JSON.stringify(attributes)).not.toContain(rawSecret);
    expect(JSON.stringify(attributes)).not.toContain("access-token-secret");
    expect(JSON.stringify(attributes)).not.toContain("provider-token");
    expect(JSON.stringify(attributes)).not.toContain("refresh-token-secret");
    expect(JSON.stringify(attributes)).not.toContain("stripe-secret");
  });

  it("accepts only centrally registered operation names", () => {
    expect(isCommerceOperationName("store.read")).toBe(true);
    expect(isCommerceOperationName("store.read.request_123")).toBe(false);
  });

  it("normalizes untrusted runtime operation names before telemetry use", async () => {
    const logs: Array<Readonly<Record<string, unknown>>> = [];
    const logger = Logger.make((options) => {
      logs.push(options.fiber.getRef(References.CurrentLogAnnotations));
    });
    const unsafeOptions = {
      correlation: { requestId: "request_123" },
      name: "store.read.request_123",
    };

    await Effect.runPromise(
      withOperationTelemetry(Effect.void, unsafeOptions).pipe(
        Effect.withLogger(logger)
      )
    );

    expect(logs).toContainEqual({
      operation: "unknown",
      requestId: "request_123",
    });
  });

  it("adds correlation to structured logs without changing success", async () => {
    const logs: Array<{
      readonly annotations: Readonly<Record<string, unknown>>;
      readonly message: unknown;
    }> = [];
    const logger = Logger.make((options) => {
      logs.push({
        annotations: options.fiber.getRef(References.CurrentLogAnnotations),
        message: options.message,
      });
    });
    const program = withOperationTelemetry(Effect.succeed("store_1"), {
      attributes: { module: "store", password: "must-not-leak" },
      correlation: {
        operationId: "operation_1",
        requestId: "request_1",
        traceId: "trace_1",
      },
      name: "store.read",
    }).pipe(Effect.withLogger(logger));

    const result = await Effect.runPromise(program);

    expect(result).toBe("store_1");
    expect(logs).toContainEqual({
      annotations: {
        module: "store",
        operation: "store.read",
        operationId: "operation_1",
        password: "<redacted>",
        requestId: "request_1",
        traceId: "trace_1",
      },
      message: ["commerce.operation.succeeded"],
    });
  });

  it("classifies Causes with a bounded outcome vocabulary", () => {
    expect(operationOutcomeFromCause(Cause.fail("not-found"))).toBe(
      "expected_failure"
    );
    expect(operationOutcomeFromCause(Cause.die("invariant"))).toBe("defect");
    expect(operationOutcomeFromCause(Cause.interrupt())).toBe("interrupted");
    expect(
      operationOutcomeFromCause(
        Cause.combine(Cause.fail("not-found"), Cause.die("invariant"))
      )
    ).toBe("mixed");
  });

  it("preserves the original failure Cause after telemetry observation", async () => {
    const source = Cause.combine(
      Cause.fail("not-found"),
      Cause.die("broken-finalizer")
    );
    const exit = await Effect.runPromiseExit(
      withOperationTelemetry(Effect.failCause(source), {
        correlation: { requestId: "request_1" },
        name: "store.read",
      }).pipe(Effect.withLogger(Logger.make(() => undefined)))
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(exit.cause.reasons).toHaveLength(2);
      const failure = exit.cause.reasons.find(Cause.isFailReason);
      const defect = exit.cause.reasons.find(Cause.isDieReason);
      expect(failure?.error).toBe("not-found");
      expect(defect?.defect).toBe("broken-finalizer");
    }
  });

  it("isolates commerce results from telemetry logger defects", async () => {
    const defectiveLogger = Logger.make(() => {
      throw new Error("exporter unavailable");
    });
    const successExit = await Effect.runPromiseExit(
      withOperationTelemetry(Effect.succeed("store_1"), {
        correlation: { requestId: "request_1" },
        name: "store.read",
      }).pipe(Effect.withLogger(defectiveLogger))
    );
    const source = Cause.fail("not-found");
    const failureExit = await Effect.runPromiseExit(
      withOperationTelemetry(Effect.failCause(source), {
        correlation: { requestId: "request_1" },
        name: "store.read",
      }).pipe(Effect.withLogger(defectiveLogger))
    );

    expect(successExit).toEqual(Exit.succeed("store_1"));
    expect(Exit.isFailure(failureExit)).toBe(true);
    if (Exit.isFailure(failureExit)) {
      expect(failureExit.cause.reasons).toHaveLength(1);
      const failure = failureExit.cause.reasons.find(Cause.isFailReason);
      expect(failure?.error).toBe("not-found");
    }
  });

  it("isolates commerce results from tracer defects", async () => {
    const defectiveTracer = Tracer.make({
      span: () => {
        throw new Error("tracer unavailable");
      },
    });
    const source = Cause.fail("not-found");
    const successExit = await Effect.runPromiseExit(
      withOperationTelemetry(Effect.succeed("store_1"), {
        correlation: { requestId: "request_1" },
        name: "store.read",
      }).pipe(Effect.withTracer(defectiveTracer))
    );
    const failureExit = await Effect.runPromiseExit(
      withOperationTelemetry(Effect.failCause(source), {
        correlation: { requestId: "request_1" },
        name: "store.read",
      }).pipe(Effect.withTracer(defectiveTracer))
    );

    expect(successExit).toEqual(Exit.succeed("store_1"));
    expect(Exit.isFailure(failureExit)).toBe(true);
    if (Exit.isFailure(failureExit)) {
      expect(failureExit.cause.reasons).toHaveLength(1);
      const failure = failureExit.cause.reasons.find(Cause.isFailReason);
      expect(failure?.error).toBe("not-found");
    }
  });

  it("runs commerce under the operation span and ends it with its Exit", async () => {
    const ended: Array<Exit.Exit<unknown, unknown>> = [];
    const tracer = Tracer.make({
      span: (options) => {
        let status: Tracer.SpanStatus = {
          _tag: "Started",
          startTime: options.startTime,
        };
        return {
          _tag: "Span",
          addLinks: () => undefined,
          annotations: Context.empty(),
          attribute: () => undefined,
          attributes: new Map(),
          end: (endTime, exit) => {
            ended.push(exit);
            status = {
              _tag: "Ended",
              endTime,
              exit,
              startTime: options.startTime,
            };
          },
          event: () => undefined,
          kind: options.kind,
          links: options.links,
          name: options.name,
          parent: options.parent,
          sampled: options.sampled,
          spanId: "span_1",
          get status() {
            return status;
          },
          traceId: "trace_1",
        };
      },
    });
    const parentName = await Effect.runPromise(
      withOperationTelemetry(
        Effect.currentParentSpan.pipe(
          Effect.map((span) =>
            span._tag === "Span" ? span.name : "external-span"
          )
        ),
        {
          correlation: { requestId: "request_1" },
          name: "store.read",
        }
      ).pipe(Effect.withTracer(tracer))
    );
    const failureExit = await Effect.runPromiseExit(
      withOperationTelemetry(Effect.fail("not-found"), {
        correlation: { requestId: "request_1" },
        name: "store.read",
      }).pipe(Effect.withTracer(tracer))
    );

    const successSpanExit = ended.at(0);
    const failureSpanExit = ended.at(1);
    expect(parentName).toBe("store.read");
    expect(successSpanExit).toEqual(Exit.succeed("store.read"));
    expect(failureSpanExit).toBeDefined();
    expect(Exit.isFailure(failureExit)).toBe(true);
    if (
      failureSpanExit &&
      Exit.isFailure(failureSpanExit) &&
      Exit.isFailure(failureExit)
    ) {
      expect(failureSpanExit.cause.reasons).toHaveLength(1);
      expect(failureExit.cause.reasons).toHaveLength(1);
      expect(failureSpanExit.cause.reasons[0]).toMatchObject({
        _tag: "Fail",
        error: "not-found",
      });
    }
  });

  it("keeps durable audit persistence explicit and typed", async () => {
    const recorded: Array<string> = [];
    const auditLayer = Layer.succeed(
      DurableAudit,
      DurableAudit.of({
        record: (event) =>
          event.eventType === "store.access.denied"
            ? Effect.sync(() => {
                recorded.push(event.eventId);
              })
            : Effect.fail(
                new AuditPersistenceUnavailable({
                  eventType: event.eventType,
                })
              ),
      })
    );
    const event = {
      attributes: { reason: "permission" },
      correlation: { requestId: "request_1" },
      eventId: "audit_1",
      eventType: "store.access.denied",
    };

    await Effect.runPromise(
      recordDurableAudit(event).pipe(Effect.provide(auditLayer))
    );
    const failedExit = await Effect.runPromiseExit(
      recordDurableAudit({
        ...event,
        eventId: "audit_2",
        eventType: "unsupported.audit",
      }).pipe(Effect.provide(auditLayer))
    );

    expect(recorded).toEqual(["audit_1"]);
    expect(Exit.isFailure(failedExit)).toBe(true);
    if (Exit.isFailure(failedExit)) {
      const failures = failedExit.cause.reasons
        .filter(Cause.isFailReason)
        .map((reason) => reason.error);
      expect(failures).toEqual([
        new AuditPersistenceUnavailable({
          eventType: "unsupported.audit",
        }),
      ]);
    }
  });
});
