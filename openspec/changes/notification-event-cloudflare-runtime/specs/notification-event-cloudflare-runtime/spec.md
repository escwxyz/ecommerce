## ADDED Requirements

### Requirement: Cloudflare runtime adapter preserves module boundaries
The system SHALL implement Cloudflare-specific notification/event runtime behavior in platform and server composition packages without importing Cloudflare bindings into pure notification-event module code.

#### Scenario: Pure module package remains platform independent
- **WHEN** maintainers run import-boundary tests for `packages/modules/notification-event`
- **THEN** the tests MUST fail if module source imports `cloudflare:workers`, Cloudflare Queue types, Durable Object types, server Worker files, or platform adapter implementation files

#### Scenario: Server composes Cloudflare runtime
- **WHEN** the server Worker starts in the Cloudflare deployment
- **THEN** it MUST compose notification-event route options, queue publishers or consumers, and realtime Durable Object bindings through public package exports

### Requirement: Event and notification work uses Cloudflare Queues
The Cloudflare runtime SHALL publish event distribution and notification dispatch work to Cloudflare Queue bindings while preserving event envelope metadata, idempotency keys, retry metadata, and workflow trace metadata.

#### Scenario: Event outbox record is queued
- **WHEN** a module publishes an event envelope through the notification-event service in the Cloudflare runtime
- **THEN** the runtime MUST persist the module-owned outbox record before queueing event distribution work
- **AND** the queued message MUST include event id, event name, source module, correlation id, optional causation id, optional workflow run id, and idempotency metadata

#### Scenario: Notification dispatch is queued
- **WHEN** notification dispatch is requested in the Cloudflare runtime
- **THEN** the runtime MUST enqueue provider delivery work with template, recipient, provider, channel, idempotency, and trace metadata from the notification-event contract
- **AND** dependent modules MUST NOT call notification provider SDKs directly

### Requirement: Queue consumers update durable delivery state
Cloudflare Queue consumers SHALL process notification-event messages idempotently, update module-owned dispatch or outbox state, and map exhausted delivery failures to dead-letter handling.

#### Scenario: Queue consumer retries failed delivery
- **WHEN** a provider delivery attempt fails and retry attempts remain
- **THEN** the consumer MUST update retry metadata and allow Cloudflare Queue retry or delay behavior to schedule another attempt

#### Scenario: Queue consumer records dead letter
- **WHEN** event distribution or notification dispatch exhausts its retry policy or is received from the configured dead-letter queue
- **THEN** the consumer MUST record a module-owned dead-letter record with failure reason, attempts, event or dispatch identity, and trace metadata

#### Scenario: Queue consumer receives duplicate message
- **WHEN** a queue consumer receives a duplicate message with an already-processed idempotency key
- **THEN** the consumer MUST return success without sending a duplicate provider message or mutating event state twice

### Requirement: Realtime stream uses hibernatable Durable Object WebSockets
The Cloudflare runtime SHALL expose realtime notification/event observability through a Durable Object that accepts hibernatable WebSocket connections for deterministic stream scopes.

#### Scenario: Admin opens realtime stream
- **WHEN** an authorized admin opens the notification-event realtime endpoint for a stream scope
- **THEN** the Worker MUST authenticate and authorize the request before routing the WebSocket upgrade to a Durable Object stub selected with a deterministic stream name
- **AND** the Durable Object MUST accept the server WebSocket using the hibernation API

#### Scenario: Durable Object wakes after hibernation
- **WHEN** a hibernated realtime Durable Object receives a WebSocket message or close event
- **THEN** it MUST restore required per-socket identity and stream metadata from WebSocket attachments or durable storage rather than relying only on in-memory state

#### Scenario: Runtime broadcasts delivery update
- **WHEN** a queue consumer records an event delivery, retry, dead-letter, notification dispatch, or provider delivery result
- **THEN** it MUST notify the stream-scoped Durable Object, which SHOULD batch compatible updates into WebSocket frames when multiple updates are pending

### Requirement: Realtime stream storage is not canonical audit storage
The realtime Durable Object SHALL NOT replace the notification-event module's canonical outbox, dispatch, provider, template, retry, or dead-letter storage.

#### Scenario: Realtime broadcast fails
- **WHEN** event or notification delivery state is persisted but realtime broadcast to a Durable Object fails
- **THEN** the delivery operation MUST remain successful
- **AND** clients MUST be able to recover state through module-owned API or reconnect cursor behavior

#### Scenario: Durable Object stores local stream metadata
- **WHEN** the realtime Durable Object stores connection cursors, subscription metadata, or a small recent-event cache
- **THEN** that storage MUST be scoped to the stream object and MUST NOT become the source of truth for notification dispatch or event outbox records

### Requirement: Cloudflare resources are declared and verified
The infrastructure package SHALL declare the Queues, dead-letter queue behavior, Durable Object namespace, migrations, and Worker bindings required by the notification-event Cloudflare runtime.

#### Scenario: Infrastructure defines runtime resources
- **WHEN** maintainers inspect the Alchemy stack or equivalent Cloudflare resource graph
- **THEN** they MUST find notification-event Queue bindings, dead-letter queue configuration, the realtime Durable Object namespace, and Worker environment wiring

#### Scenario: Runtime resource tests run
- **WHEN** targeted platform, server, and infrastructure tests run
- **THEN** they MUST verify queue publication, queue consumer idempotency, Durable Object WebSocket routing, Worker exports, binding configuration, and import boundaries
