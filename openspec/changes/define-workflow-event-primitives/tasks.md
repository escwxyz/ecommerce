## 1. Core Workflow Contracts

- [x] 1.1 Extend `packages/core` workflow types to define workflow keys, workflow versions, durable run statuses, step attempt records, and idempotency metadata.
- [x] 1.2 Add workflow runtime and observation contracts in `packages/core` for starting, observing, reconciling, and deduplicating workflow runs.
- [x] 1.3 Update `packages/core` exports and module contribution types so modules can declare workflow definitions against the shared contract.

## 2. Event Contract Expansion

- [x] 2.1 Extend the shared event envelope contract with correlation, causation, workflow-run, and subject metadata.
- [x] 2.2 Define the required workflow lifecycle event names and payload shapes that are published through the shared event publisher service.
- [x] 2.3 Verify the expanded event and workflow contracts preserve the `packages/core` platform boundary with no Cloudflare or adapter-specific imports.

## 3. Persistence and Execution Adapters

- [x] 3.1 Add an in-memory workflow runtime implementation for unit and contract tests.
- [x] 3.2 Implement the first Cloudflare workflow runtime adapter by wrapping native Workflow, Queue, and Durable Object primitives behind the shared contract.
- [x] 3.3 Add optional metadata projection or storage hooks so workflow adapters can persist searchable run metadata in D1, PostgreSQL, or another supported database without redefining workflow execution semantics.
- [x] 3.4 Wire workflow execution state transitions and lifecycle event publication through the shared runtime and publisher contracts.

## 4. Verification

- [x] 4.1 Add targeted tests for duplicate-trigger handling, durable workflow status transitions, and reverse-order compensation expectations.
- [x] 4.2 Add adapter contract tests that run the workflow runtime behavior against both the in-memory and Cloudflare-backed implementations where practical.
- [x] 4.3 Verify optional metadata storage remains database-agnostic and does not leak database-specific execution assumptions into `packages/core`.
- [x] 4.4 Run the relevant typecheck, lint, and targeted test commands for `packages/core` and the Cloudflare runtime adapter package.
