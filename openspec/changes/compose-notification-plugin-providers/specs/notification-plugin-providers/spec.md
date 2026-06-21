## ADDED Requirements

### Requirement: Notification plugins declare typed provider contributions
The platform SHALL define a stable notification provider contribution contract for native and sandboxed plugins that declares plugin-local provider identity, the notification provider contract key, supported normalized channels, display metadata, and the executable native implementation or sandbox entrypoint reference appropriate to the plugin tier.

#### Scenario: Native plugin declares a notification provider
- **WHEN** an active native plugin contributes a descriptor for the notification provider contract
- **THEN** the descriptor MUST include a plugin-local key, supported channel set, and an implementation satisfying the notification delivery contract

#### Scenario: Sandboxed plugin declares a notification provider
- **WHEN** a sandboxed plugin manifest contributes a descriptor for the notification provider contract
- **THEN** the descriptor MUST reference a declared provider-delivery entrypoint and MUST NOT contain an in-process implementation object

#### Scenario: Unrelated provider is composed
- **WHEN** a plugin contributes a payment, fulfillment, search, or another non-notification provider contract
- **THEN** notification provider composition MUST ignore it without weakening validation performed by its owning provider system

### Requirement: Plugin provider identities are canonical and collision safe
The host SHALL normalize each plugin-local notification provider key into a canonical runtime key containing plugin identity and MUST reject duplicate, malformed, or reserved provider identities before accepting notification work.

#### Scenario: Two plugins use the same local key
- **WHEN** two active plugins declare the same plugin-local provider key
- **THEN** composition MUST assign distinct canonical runtime keys because their plugin identities differ

#### Scenario: Plugin attempts to replace the built-in provider
- **WHEN** a plugin contribution resolves to the built-in `in-app` identity or another reserved host provider key
- **THEN** composition MUST reject the contribution and preserve the host-owned provider

#### Scenario: Canonical provider key collides
- **WHEN** two active contributions resolve to the same canonical runtime key
- **THEN** composition MUST fail before request or queue handling begins and identify both owners

### Requirement: Active native providers become executable notification providers
The notification runtime SHALL adapt only active native plugin contributions with valid notification implementations into executable providers and SHALL preserve plugin identity, version, tier, local key, canonical key, and supported channels as provider provenance.

#### Scenario: Active native provider delivers
- **WHEN** the queue consumer resolves a valid active native provider and invokes delivery
- **THEN** the host MUST call the contributed implementation through the normalized notification contract and validate its delivery result

#### Scenario: Native plugin is inactive
- **WHEN** a native plugin is inactive, deactivated, or uninstalled
- **THEN** its provider contributions MUST be absent from new request composition and queue-consumer resolution

#### Scenario: Native implementation is malformed
- **WHEN** a native contribution lacks a callable delivery implementation or returns an invalid result
- **THEN** composition or delivery MUST fail with a typed provider error and MUST NOT mark the dispatch delivered

### Requirement: Sandboxed provider delivery uses Worker Loader isolation
The Cloudflare platform SHALL adapt active sandboxed notification provider declarations into host-side notification providers whose delivery operation invokes only the declared provider entrypoint through the sandbox runner.

#### Scenario: Sandboxed provider delivers
- **WHEN** the queue consumer invokes an active sandboxed notification provider
- **THEN** the host adapter MUST invoke its immutable bundle through Worker Loader with normalized dispatch, template, provider provenance, tenant scope, and trace metadata
- **AND** it MUST validate the serializable delivery response before mapping it to the host notification result

#### Scenario: Worker Loader is unavailable
- **WHEN** an active sandboxed notification provider requires Worker Loader but the binding is unavailable
- **THEN** activation or composition MUST fail before the provider is advertised as executable

#### Scenario: Sandbox entrypoint response is invalid
- **WHEN** the provider entrypoint throws, times out, or returns a response outside the notification delivery schema
- **THEN** the host MUST reject the result, preserve retryable delivery state where appropriate, and emit typed plugin runtime diagnostics

### Requirement: Sandboxed delivery is capability and policy enforced
Sandboxed notification delivery SHALL require the granted `notification:deliver` capability and SHALL continue to enforce plugin lifecycle, tenant scope, outbound-host policy, storage grants, and audit policy for every invocation.

#### Scenario: Delivery capability is not granted
- **WHEN** a sandboxed plugin declares a notification provider but lacks the granted `notification:deliver` capability
- **THEN** activation or composition MUST reject the provider before notification work can target it

#### Scenario: Provider calls an undeclared host
- **WHEN** sandboxed provider code attempts delivery through an outbound host absent from its granted allowlist
- **THEN** the request MUST be blocked and the denied decision MUST be audited without exposing credentials or sensitive notification payloads

#### Scenario: Background delivery has no user session
- **WHEN** a queue consumer invokes a sandboxed provider outside an HTTP user request
- **THEN** the bridge context MUST use explicit system delivery authority scoped to plugin, tenant, provider, and dispatch rather than fabricating an administrator session

### Requirement: One lifecycle-aware registry controls request and consumer availability
Server composition SHALL build a lifecycle-aware notification provider registry from the built-in providers, active native plugin composition, and active sandbox plugin metadata, and each request or queue batch MUST use a coherent registry snapshot.

#### Scenario: Active plugin provider is available
- **WHEN** a registry snapshot contains an executable plugin provider
- **THEN** request-side notification composition MUST expose a queue-publishing wrapper for its canonical key and queue-consumer resolution MUST expose its concrete delivery adapter

#### Scenario: Plugin is deactivated
- **WHEN** plugin lifecycle state changes from active before a later registry snapshot
- **THEN** new requests MUST stop accepting its provider key and later queue batches MUST fail closed rather than invoke inactive plugin code

#### Scenario: Registry metadata cannot be loaded
- **WHEN** provider lifecycle or sandbox metadata lookup fails transiently
- **THEN** the runtime MUST treat the registry as unavailable and retry safely rather than silently composing an incomplete provider set

### Requirement: Queue work preserves plugin provider provenance
Queued notification work and delivery diagnostics SHALL preserve the canonical provider key, plugin identity, accepted plugin version, plugin tier, correlation metadata, and executing version where it differs, while dispatch idempotency remains authoritative for duplicate suppression.

#### Scenario: Plugin upgrades before queued work executes
- **WHEN** a dispatch accepted for one plugin version is consumed after a compatible newer version becomes active under the same canonical provider key
- **THEN** the current active provider MAY execute the work
- **AND** diagnostics MUST record both accepted and executing versions

#### Scenario: Duplicate queue message is received
- **WHEN** the queue consumer receives duplicate work for a plugin-backed dispatch already delivered
- **THEN** it MUST return success without invoking native or sandboxed provider code again

#### Scenario: Provider becomes unavailable after enqueue
- **WHEN** queued work references a provider whose plugin is no longer active or installed
- **THEN** the runtime MUST record an explicit terminal unavailable-provider outcome and MUST NOT repeatedly invoke or advertise the provider

### Requirement: Provider composition and execution are observable and secure
The implementation SHALL emit structured provider composition and delivery diagnostics and SHALL include regression tests for lifecycle exclusion, collision rejection, sandbox isolation, capability enforcement, response validation, queue consistency, idempotency, and sensitive-data redaction.

#### Scenario: Plugin provider delivery is audited
- **WHEN** a plugin-backed delivery starts, succeeds, fails, or is denied
- **THEN** diagnostics MUST identify plugin, version, tier, canonical provider, dispatch, decision, reason, and correlation metadata without logging recipient secrets, provider credentials, or unrestricted payload values

#### Scenario: Provider security tests run
- **WHEN** plugin-provider verification executes
- **THEN** tests MUST prove inactive providers are excluded, built-in keys cannot be replaced, sandbox code runs only through Worker Loader, ungranted capability and host access are denied, invalid responses are rejected, and request/consumer registries remain aligned

