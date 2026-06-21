## 1. Prerequisite and Core Plugin Contracts

- [ ] 1.1 Confirm `add-built-in-in-app-notifications` has established the centralized built-in provider registry and aligned request/consumer composition; capture any prerequisite mismatch in this change before editing plugin runtime code.
- [ ] 1.2 Add failing core contract tests for generic native and sandbox provider declarations, sandbox provider entrypoint validation, `notification:deliver` grant policy, serializable provider-delivery responses, and rejection of in-process implementations in sandbox manifests.
- [ ] 1.3 Extend platform-neutral plugin contracts with provider declaration metadata, provider entrypoint kind, delivery capability, response envelope, normalization, and public JSDoc without importing notification or Cloudflare implementation types into core.
- [ ] 1.4 Update sandbox manifest, lifecycle, capability, and response validators and run core plugin tests, import-boundary checks, static analysis, and typecheck.

## 2. Notification Provider Descriptor and Native Composition

- [ ] 2.1 Add failing notification-module tests for contract-key filtering, supported-channel validation, canonical key generation, reserved built-in rejection, duplicate owner diagnostics, inactive native exclusion, malformed implementation rejection, and delivery-result validation.
- [ ] 2.2 Define the stable notification provider contract key, native and sandbox notification contribution schemas, canonical identity/provenance types, typed provider errors, and registry snapshot contracts in the notification module's public extension boundary.
- [ ] 2.3 Implement native contribution normalization from active `composeNativePlugins` output into executable notification providers while ignoring unrelated provider contracts and preserving plugin ID, version, tier, local key, canonical key, label, and supported channels.
- [ ] 2.4 Add native delivery adapter tests for successful delivery, thrown and failed results, invalid result shape, duplicate dispatch idempotency interaction, and sensitive diagnostic redaction.

## 3. Sandboxed Notification Delivery Adapter

- [ ] 3.1 Add failing Cloudflare platform tests for sandbox provider declaration/entrypoint matching, missing Worker Loader, missing `notification:deliver` grant, inactive lifecycle, denied outbound host, normalized background bridge context, invalid response, and audit redaction.
- [ ] 3.2 Implement the host-side sandbox notification provider adapter that invokes only the declared immutable Worker Loader entrypoint with normalized delivery input, provider provenance, tenant scope, and trace metadata.
- [ ] 3.3 Validate sandbox delivery responses before mapping them to notification results and classify invalid input, invalid response, denied policy, platform capability, timeout/throw, provider failure, and successful delivery outcomes as typed errors.
- [ ] 3.4 Ensure queue-triggered sandbox execution uses explicit system delivery authority and existing capability, storage, egress, lifecycle, and audit enforcement without fabricating an administrator session or exposing raw bindings/secrets.
- [ ] 3.5 Run platform-cloudflare sandbox/security tests, import-boundary checks, static analysis, and typecheck.

## 4. Lifecycle-Aware Provider Registry

- [ ] 4.1 Add failing registry-loader tests that combine the built-in provider, active native contributions, and active sandbox metadata while rejecting malformed snapshots, canonical collisions, reserved keys, unavailable platform capabilities, and transient metadata lookup failures.
- [ ] 4.2 Implement asynchronous immutable registry snapshots with descriptors, concrete delivery adapters, canonical-key lookup, supported-channel lookup, and provenance lookup; cache only within one request composition or queue batch.
- [ ] 4.3 Exclude inactive, deactivated, failed, uninstalling, and uninstalled plugins from snapshots and make sandbox metadata-load failure fail the complete snapshot rather than silently omitting providers.
- [ ] 4.4 Add lifecycle transition tests proving activation makes a provider available in the next snapshot, deactivation removes it, built-in `in-app` remains available, and unrelated plugin contributions do not affect notification composition.

## 5. Request, Queue, and Server Composition

- [ ] 5.1 Add failing server regressions proving request-side queue wrappers and queue-consumer concrete providers derive from the same registry snapshot contract for built-in, native, and sandbox providers.
- [ ] 5.2 Refactor notification route/service composition to load the current executable provider snapshot before accepting dispatch work and reject unavailable external canonical keys before enqueueing.
- [ ] 5.3 Refactor queue batch composition to resolve concrete providers from one batch snapshot, never register queue wrappers as consumers, and treat transient registry failures as retryable batch failures.
- [ ] 5.4 Extend queued notification provenance with canonical provider key, plugin ID, accepted version, and tier; record the executing version when it differs without placing credentials or unrestricted payloads in queue metadata.
- [ ] 5.5 Add terminal unavailable-provider handling for work whose plugin is no longer active, while preserving retry behavior for transient metadata, Worker Loader, network, and provider failures.
- [ ] 5.6 Add server and queue integration tests for native delivery, sandbox delivery, duplicate suppression, compatible upgrade provenance, deactivation after enqueue, collision startup failure, unavailable provider rejection, and built-in provider continuity.

## 6. Verification and Provider Author Handoff

- [ ] 6.1 Run changed-file formatting/static analysis and package-local tests/typechecks for core, notification-event, platform-cloudflare, api, and server.
- [ ] 6.2 Run repository `bun run check-types`, `bun run test`, and `bun run check`, then run ordinary server integration coverage and record credential-gated deployment smoke separately.
- [ ] 6.3 Verify pure core and notification module boundaries remain free of Cloudflare Worker Loader, server transport, concrete database adapter, and plugin-private implementation imports.
- [ ] 6.4 Document the native and sandbox notification provider author contract with canonical key examples, supported channels, lifecycle behavior, system delivery context, response schema, retry classification, egress policy, audit redaction, and the explicit absence of raw secret access.
- [ ] 6.5 Capture provider configuration/secret mediation and operator replay as follow-up changes before implementing the first credentialed external provider plugin.
- [ ] 6.6 Sync accepted requirement changes, complete the checklist, and confirm `openspec status --change "compose-notification-plugin-providers"` is apply-ready before implementation closure.
