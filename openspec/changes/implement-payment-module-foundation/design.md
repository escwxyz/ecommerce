## Context

Payment sits behind cart/checkout workflows and provider adapters. Provider SDKs and provider-specific webhook payloads must be translated at the adapter boundary.

## Scope

- Package boundary: `packages/modules/payment`, with provider contracts in module or `packages/payment-provider` as justified by implementation.
- Service contracts: payment collection/session/payment/capture/refund/account-holder/payment-method operations and status transitions.
- Data ownership: payment records, provider records, provider identifiers, and webhook-derived domain actions.
- Events/workflows: payment state events and checkout/order workflow steps; no checkout orchestration ownership.
- API/admin metadata: payment management procedures, permissions, navigation, and screens.
- Tests: fake-provider contract tests, webhook mapping tests, service/repository behavior, API assembly, admin metadata, and import-boundary checks.

## Non-Goals

- PayKit as public model, provider SDK adoption without an adapter, cart ownership, order ownership, or checkout orchestration.
