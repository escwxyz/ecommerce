## Context

The current plugin foundation supports trusted native provider descriptors and a Cloudflare Worker Loader sandbox runner, but those surfaces are not connected to the notification module. Native descriptors are generic and carry an optional unknown implementation. Sandbox manifests can declare extension points, but provider-delivery entrypoints, capability vocabulary, delivery response types, and host notification adapters do not exist. The server consequently has no principled way to discover active plugin providers or keep request-side queue wrappers aligned with queue-consumer delivery implementations.

`add-built-in-in-app-notifications` is the prerequisite for this change. It establishes the host-owned in-app provider and a centralized provider-composition result. This change extends that result with plugin providers; it does not replace the built-in provider or implement any vendor integration.

## Goals / Non-Goals

**Goals:**

- Define a typed notification provider contribution vocabulary for native and sandbox plugin tiers.
- Normalize only active, valid contributions into executable notification providers.
- Execute sandboxed delivery through Worker Loader with capability, lifecycle, tenant, egress, storage, response, and audit enforcement.
- Derive request-side queue wrappers and consumer-side delivery resolution from coherent registry snapshots.
- Prevent built-in override, duplicate identity, stale activation, recursive queue publication, and sensitive audit leakage.
- Preserve queue idempotency and plugin/provider provenance through delivery.

**Non-Goals:**

- Implement Resend, SendGrid, SES, Twilio, webhook, push, or any other concrete provider plugin.
- Add provider credential storage, secret management UI, plugin marketplace installation, billing, or provider health dashboards.
- Permit sandbox plugins to receive raw Cloudflare bindings, environment secrets, D1 access, or unrestricted network access.
- Allow plugins to replace the built-in admin in-app provider.
- Add customer/storefront notification preferences or channel routing policy.

## Decisions

1. Keep generic provider declaration vocabulary in core and notification-specific validation in the notification module.

   `packages/core` will extend generic plugin declarations only enough to represent provider metadata and a sandbox entrypoint reference without importing notification domain types. `packages/modules/notification-event` will export the stable notification contract key, supported descriptor schema, provenance types, and normalization functions. It filters the provider contributions returned by native composition and rejects malformed notification-specific metadata.

   Alternative considered: move `NotificationProvider` into `packages/core`. Rejected because provider delivery input/result and channel semantics belong to the notification module, while core must remain domain-neutral.

2. Use plugin-local keys plus host-generated canonical keys.

   Plugins declare a local provider key. The host derives a canonical runtime key such as `plugin:<plugin-id>:<provider-key>`, validates allowed characters/length, and reserves host keys including `in-app`. Templates and dispatches bind to the canonical key; labels remain presentation metadata. Provenance retains local key, plugin ID, version, and tier.

   Alternative considered: let plugins publish global keys such as `email`. Rejected because installation order would determine ownership and one plugin could impersonate or replace another provider.

3. Require a strict native notification contribution shape.

   A native notification contribution must target the stable notification contract key, declare supported existing notification channels, and provide a delivery implementation satisfying the module contract. Normalization wraps the implementation to validate inputs/results and attach provenance. Only active plugins returned by `composeNativePlugins` participate.

   Alternative considered: cast every generic provider implementation to `NotificationProvider`. Rejected because malformed contributions would fail only during queue processing and could mark provider availability incorrectly.

4. Add an explicit sandbox provider-delivery entrypoint and response.

   Core sandbox contracts gain a provider entrypoint kind, generic provider declarations in manifest contributions, the `notification:deliver` capability, and a serializable provider-delivery response envelope. The notification Cloudflare adapter validates notification-specific declaration metadata and maps the response to `NotificationProviderDeliveryResult`. The entrypoint receives normalized operation input through the runner, not an imported host implementation.

   Alternative considered: model provider delivery as a generic hook. Rejected because hooks return control-flow decisions, while delivery requires strict input, result, retry, and provenance semantics.

5. Use system delivery authority for queue-triggered sandbox execution.

   Queue consumers construct a bridge context containing plugin identity/version, tenant scope, provider key, dispatch/correlation identities, granted capabilities, and an explicit system operation type. They do not fabricate user/session identity. Existing bridge checks continue to mediate storage, fetch, logging, and event operations.

   Alternative considered: reuse the administrator who originally caused the domain event. Rejected because events can be system-generated, actor identity may be unavailable or stale, and provider delivery authority is a host runtime concern.

6. Build an asynchronous registry snapshot per request composition and queue batch.

   A `NotificationProviderRegistryLoader` combines built-ins, static active native composition, and active sandbox metadata records. It validates all contributions and produces immutable descriptors plus concrete provider adapters. Request services derive queue wrappers from the snapshot's canonical keys; queue batches resolve concrete providers from a snapshot loaded for that batch. Metadata-load failure fails the whole snapshot rather than silently dropping providers.

   Alternative considered: create one module-level registry at Worker startup. Rejected because Cloudflare isolates can remain warm while sandbox plugin lifecycle changes in D1, producing stale availability.

7. Fail closed across lifecycle changes and classify provider resolution failures.

   New requests cannot target providers absent from the latest registry snapshot. If a plugin is deactivated after enqueue, the consumer records a terminal unavailable-provider failure without invoking plugin code or repeatedly retrying a permanent state. Transient metadata, Worker Loader, network, or provider failures remain retryable under existing queue policy.

   Alternative considered: continue delivering already queued messages after deactivation. Rejected because deactivation must stop provider execution and may represent credential revocation or a security response.

8. Execute the current active version while preserving accepted provenance.

   Queue messages include accepted plugin identity, version, tier, and canonical provider key. At consumption, the current active implementation under that canonical key may execute so compatible upgrades do not strand queued work. Diagnostics record accepted and executing versions. Dispatch idempotency prevents duplicate sends.

   Alternative considered: pin every delivery to the accepted plugin version. Rejected because old native code may no longer be loaded and retaining every historical sandbox bundle introduces lifecycle and security policy not justified by this slice.

9. Keep provider configuration and secrets outside delivery payloads.

   This change defines execution composition only. Native implementations arrive preconfigured by trusted host composition. Sandboxed providers can use only granted bridge operations and egress; raw credentials are never placed in queue messages, bridge context, or audit events. A later provider-configuration change must define host-mediated secret references before credentialed sandbox plugins ship.

   Alternative considered: include provider credentials in manifest or dispatch metadata. Rejected because manifests and queue records are not secret stores and would broaden exposure.

## Risks / Trade-offs

- Registry loading per request or batch adds D1/runtime overhead -> Cache only within a request or batch and introduce lifecycle-versioned caching later if profiling requires it.
- Provider deactivation can terminally fail queued work -> Make the outcome explicit and operator-visible; requeue requires deliberate reactivation or replay tooling.
- Current-version execution can change behavior after enqueue -> Preserve accepted/executing provenance and require provider plugins to maintain compatibility under a stable canonical key.
- Generic core descriptors can still carry malformed domain metadata -> Validate notification descriptors at activation/composition and reject the entire registry snapshot.
- Sandbox delivery may expose sensitive recipients or payload fields -> Pass only normalized delivery input required by the provider and redact audit/log values by default.
- Native plugins remain trusted in-process code -> Validate contract shape and lifecycle, but document that isolation guarantees apply only to sandboxed plugins.

## Migration Plan

1. Extend platform-neutral plugin declarations, sandbox entrypoint/capability/response schemas, and core validation with compatibility tests.
2. Add notification-specific plugin descriptor schemas, canonical identity/provenance, native adapter normalization, and registry contracts.
3. Add the Cloudflare sandbox notification adapter and Worker Loader contract/security tests.
4. Add lifecycle-aware registry loading from active native composition and sandbox metadata.
5. Wire server request composition and queue batches to the same registry snapshot contract established by the built-in in-app change.
6. Add queue integration tests for native and sandbox delivery, duplicate suppression, deactivation, upgrades, transient failures, and terminal unavailable-provider handling.
7. Document the provider-plugin author contract and verify no concrete vendor SDK or secret enters host/runtime packages. Roll back by disabling plugin provider loading; the built-in in-app provider remains available.

## Open Questions

- Which host-mediated secret/configuration contract should future credentialed sandbox providers use? Resolve in the first concrete external-provider proposal rather than exposing raw secrets here.
- Should terminally failed deliveries gain an operator replay API in a later change, or should replay remain tied to plugin reactivation tooling?
