# Stateful Runtime Primitives

## Purpose

Synced from completed OpenSpec changes. This spec captures the current accepted requirements for Cloudflare stateful coordination, queue, workflow, Durable Object, and provider-neutral payment foundation primitives.

## Requirements

### Requirement: Platform-free stateful coordination contracts

`packages/core` SHALL expose contracts for serialized stateful coordination without importing Cloudflare runtime types.

#### Scenario: Module uses stateful coordination without Cloudflare imports

- **GIVEN** a future commerce module needs serialized mutation for a high-contention aggregate
- **WHEN** it depends on the shared stateful coordination contract
- **THEN** the module package MUST NOT import `cloudflare:workers`, `DurableObjectNamespace`, `DurableObjectStub`, Hono server types, or Worker binding types

### Requirement: Durable Object adapter boundary

`packages/platform-cloudflare` SHALL provide a Durable Object adapter boundary that maps platform-free coordination requests to Cloudflare Durable Object namespaces or stubs.

#### Scenario: Serialized mutation is dispatched through the platform adapter

- **GIVEN** a stateful coordination request with a coordinator key, operation name, payload, correlation id, and idempotency key
- **WHEN** the Cloudflare adapter dispatches the request
- **THEN** it MUST resolve the correct Durable Object target and return a typed serializable result
- **AND** it MUST keep Cloudflare binding details out of `packages/core` and pure module packages

### Requirement: Queue publishing and consuming contracts

The foundation SHALL define queue message contracts with stable identity, correlation metadata, causation metadata, subject metadata, retry metadata, and error/dead-letter shape.

#### Scenario: Workflow publishes asynchronous work

- **GIVEN** a workflow step needs asynchronous follow-up work
- **WHEN** it publishes a queue message through the shared queue port
- **THEN** the message MUST include a stable message id, correlation id, optional causation id, optional workflow run id, and an idempotency key
- **AND** consumers MUST be able to detect duplicate delivery from that metadata

### Requirement: Workflow, Queue, and Durable Object adapter verification

The Cloudflare foundation SHALL include adapter-level tests that exercise Workflow, Queue, and Durable Object integration behind shared contracts.

#### Scenario: Workflow coordinates state through queue and DO adapters

- **GIVEN** a workflow run started through the shared runtime contract
- **WHEN** the run emits a lifecycle event, publishes a queue message, and performs a serialized coordination operation
- **THEN** tests MUST verify the correlation metadata is preserved across all three surfaces
- **AND** duplicate workflow or queue delivery MUST NOT produce a second serialized mutation for the same idempotency key

### Requirement: Provider-neutral payment foundation

The project SHALL define a provider-neutral payment foundation package before implementing payment business logic.

#### Scenario: Payment module depends on normalized provider contracts

- **GIVEN** the future payment module needs to create checkout sessions, attach payment methods, process webhooks, or handle refunds
- **WHEN** it calls the provider foundation contract
- **THEN** it MUST depend on normalized provider operations and events
- **AND** it MUST NOT import PayKit, Stripe, or another concrete provider SDK directly

### Requirement: PayKit remains an adapter candidate

PayKit SHALL be treated as an adapter/reference candidate, not as the public commerce payment API.

#### Scenario: PayKit integration is added later

- **GIVEN** the provider-neutral contract is implemented and tested with fake providers
- **WHEN** a later change adds a PayKit adapter
- **THEN** PayKit-specific customer, subscription, invoice, checkout, webhook, and entitlement concepts MUST be mapped into normalized commerce provider types at the adapter boundary
