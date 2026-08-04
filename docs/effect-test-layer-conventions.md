# Effect Test Layer Conventions

Runtime-neutral backend services must have deterministic test Layers before a
Cloudflare, PostgreSQL, queue, actor, or provider adapter is treated as the only
executable implementation.

## Shared test fixtures

- Use `createDeterministicClockLayer` for tests that need both Effect
  `Clock.Clock` and the legacy `ClockService` during migration.
- Use `createSequenceIdGeneratorLayer` for deterministic IDs. Configure enough
  IDs for the test path; repeated fallback IDs are acceptable only when the test
  does not assert uniqueness.
- Use `createTestConfigLayer` instead of reading `process.env` or Worker
  bindings in runtime-neutral tests.
- Use `createTestTelemetry` for logs, spans, and durable audit capture. Exporter
  tests may replace it with platform-specific Layers, but commerce tests should
  assert against captured records.

## Repository fixtures

`createInMemoryRepositoryTestLayer` is a generic state harness for future
repository contracts. It gives tests a service Layer plus `reset` and `snapshot`
effects backed by an Effect `Ref`.

Concrete repository contracts, PostgreSQL contract suites, and module-specific
in-memory repositories are intentionally deferred to the persistence foundation
and vertical-slice tasks. This helper only standardizes how those future
fixtures expose deterministic state control.
