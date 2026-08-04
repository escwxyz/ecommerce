# Effect Telemetry Conventions

Effect logging, spans, metrics, and Causes are the backend telemetry model.
Runtime-neutral packages emit telemetry through Effect primitives; platform
composition provides exporters. The first Cloudflare exporter is
`createCloudflareTelemetryLayer` in `@ecommerce/platform-cloudflare`, which
emits structured Effect log and completed-span records to the Worker `console`
so Cloudflare Workers Logs can collect them without an additional credentialed
service.

## Structured logs and spans

- Use stable event names such as `commerce.operation.succeeded`; put details in
  structured annotations rather than interpolated messages.
- Register operations in the central `commerceOperationNames` vocabulary and
  wrap important boundaries with spans. Dynamic identifiers never become span
  names or operation metric labels; unknown runtime values collapse to the
  bounded `unknown` operation.
- Propagate request, trace, workflow, queue-message, actor-command, plugin-call,
  and provider-operation identifiers through correlation annotations.
- Correlation identifiers belong in logs and spans, not metric labels.

## Correlation and trace propagation

- `CorrelationContext` is the portable propagation shape. It carries the
  request id, optional operation/correlation id, optional causation id, and
  optional W3C trace identity fields.
- HTTP ingress reads `x-request-id`, `x-correlation-id`, `x-trace-id`, and
  `traceparent` through `correlationContextFromHeaders`.
- HTTP and Service Binding clients serialize context with
  `correlationContextToHeaders` or the SDK-equivalent header contract.
- SQL-backed outbox rows persist `trace_id` beside `correlation_id` so
  post-commit queue delivery does not lose trace identity.
- Workflow starts, metadata/state projections, lifecycle events, dispatch queue
  messages, keyed actor commands/results, sandbox plugin bridge context, and
  provider operation inputs carry optional trace identity. Runtime adapters may
  forward these values to external SDKs or HTTP-like transports, but must not
  treat them as authorization inputs.

## Metrics and Causes

- Metric names and label keys are centrally defined and low-cardinality through
  `telemetryAttributeCardinalityPolicy`.
- Never label metrics with entity IDs, user IDs, request IDs, URLs, raw routes,
  error messages, provider responses, or arbitrary plugin values.
- `commerce_operation_total` records completed operation outcomes using the
  bounded `success`, `typed_rejection`, `defect`, `interrupted`, and `mixed`
  vocabulary.
- `commerce_runtime_event_total` records runtime categories that must remain
  distinguishable outside ordinary request success/failure: `typed_rejection`,
  `defect`, `interruption`, `retry`, `compensation`, and `poison_message`.
- Record typed rejections, defects, interruptions, and mixed Causes as distinct
  bounded outcomes. Mixed operation outcomes additionally emit one runtime
  event for each Cause category present. Preserve the complete Cause for
  internal diagnostics.
- Ordinary telemetry recording is observational. The shared helper safely
  acquires an operation span, installs it as the parent for nested work, and
  finalizes it with the commerce Exit. Span acquisition/finalization and the
  completion log/metric are isolated so exporter failures, defects, and
  interruptions do not change a commerce result or Cause.
- The initial Cloudflare console exporter records logs and spans. Metric
  shipping to an external backend remains a later exporter concern; core
  records the bounded operation and runtime-event metrics through Effect.

## Cloudflare Workers Logs exporter

- `createCloudflareTelemetryLayer` installs an Effect logger and tracer Layer
  for Cloudflare runtime composition.
- Log records include level, timestamp, bounded message values, and sanitized
  annotations.
- Span records emit only on completion and include span name, trace/span IDs,
  sampled flag, duration, event count, sanitized attributes, and a bounded
  outcome.
- The exporter does not serialize Causes, stack traces, arbitrary objects, SQL,
  provider bodies, secrets, or raw request/response values.
- `withCloudflareTelemetry` is a convenience wrapper for platform tests and
  small runtime compositions.

## Redaction

- Pass annotations through `sanitizeTelemetryAttributes` before emitting them.
- Shared policy constants live in `telemetryRedactionPolicy` and
  `telemetryAttributeCardinalityPolicy`.
- Protected key names and `Redacted` values are masked. Objects, arrays,
  non-finite numbers, oversized strings, and other unbounded values are rejected
  rather than stringified.
- Ordinary telemetry attributes are capped by count, key length, and string
  length. Metric labels use the stricter `sanitizeMetricAttributes` path and
  preserve only the bounded label names declared by policy.
- Do not place secrets, authorization headers, cookies, SQL, provider bodies,
  personal data, or stack traces in ordinary attributes.
- Redaction is defense in depth; callers still avoid collecting protected data.

## Durable audit records

Telemetry and audit evidence have different delivery semantics. Logs, spans,
and metrics are best effort. Security or commerce records that must survive
exporter failure use the explicit `DurableAudit` service and its typed failure
channel. They participate in application policy rather than being hidden inside
a logger callback.

Current verification covers both sides of that boundary: Cloudflare telemetry
exporter defects do not replace ordinary commerce successes or typed failures,
and sandbox bridge operations fail before host dispatch when required
`DurableAudit` persistence is unavailable.

## Tests

New tests live under `__tests__/`. Deterministic loggers and test Layers capture
annotations and audit records. Tests cover redaction, correlation, bounded
outcomes, runtime metric taxonomy, Cause preservation, and durable audit failure
behavior without a production exporter.
