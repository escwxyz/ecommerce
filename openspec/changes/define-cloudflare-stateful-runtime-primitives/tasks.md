## 1. Stateful Coordination Contracts

- [x] 1.1 Add platform-free coordination request/result contracts in `packages/core`.
- [x] 1.2 Add idempotency, correlation, causation, subject, and operation metadata to the coordination contract.
- [x] 1.3 Add import-boundary tests proving `packages/core` and pure modules do not import Cloudflare DO runtime types.

## 2. Cloudflare Durable Object Adapter

- [x] 2.1 Define a Cloudflare DO namespace/stub adapter in `packages/platform-cloudflare`.
- [x] 2.2 Add a fake DO harness for contract tests that models serialized mutation and duplicate idempotency handling.
- [x] 2.3 Capture the `refs/merchant/src/do.ts` pattern as infrastructure guidance without copying cart, inventory, or payment business schemas.

## 3. Queue Contracts and Adapter

- [x] 3.1 Add platform-free queue message, publisher, consumer, retry, and dead-letter contracts.
- [x] 3.2 Implement a Cloudflare Queue adapter boundary in `packages/platform-cloudflare`.
- [x] 3.3 Add tests proving queue messages preserve correlation, causation, workflow run, subject, and idempotency metadata.

## 4. Workflow, Queue, and DO Integration

- [x] 4.1 Extend adapter contract tests so a workflow can publish a queue message and coordinate a serialized DO mutation through shared contracts.
- [x] 4.2 Verify duplicate workflow starts or duplicate queue deliveries do not produce duplicate serialized mutations for the same idempotency key.
- [x] 4.3 Keep workflow execution state separate from optional database projections.

## 5. Payment Provider Foundation

- [x] 5.1 Create a provider-neutral payment foundation package, proposed as `packages/payment-provider`.
- [x] 5.2 Define normalized provider operations for customers, payment methods, checkout sessions, payment intents/authorizations, captures, refunds, subscriptions/invoices where needed, and webhook processing.
- [x] 5.3 Define normalized payment provider events inspired by PayKit's webhook model without importing PayKit.
- [x] 5.4 Add fake-provider contract tests for provider operations and webhook normalization.
- [x] 5.5 Add import-boundary tests proving future payment module code cannot import PayKit or provider SDKs directly.

## 6. Verification

- [x] 6.1 Run targeted tests for `packages/core`, `packages/platform-cloudflare`, and `packages/payment-provider`.
- [x] 6.2 Run `bun run check-types`.
- [x] 6.3 Run `bun run test`.
- [x] 6.4 Run `openspec status --change "define-cloudflare-stateful-runtime-primitives" --json`.
