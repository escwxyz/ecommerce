## Context

Cart totals need tax lines that remain distinct from pricing and promotion outputs. Region and store policy must be inputs, not tax-owned market state.

## Scope

- Package boundary: `packages/modules/tax`.
- Service contracts: tax configuration, provider selection, tax calculation, and tax line output.
- Data ownership: tax regions, tax rates, tax categories, provider configuration, calculation policy, and tax line outputs.
- Events/workflows: durable events cover tax configuration mutations; calculated tax remains a synchronous service output rather than a request-rate outbox record.
- API/admin metadata: tax management procedures, permissions, navigation, and screens.
- Tests: calculation behavior, provider contract behavior, API assembly, admin metadata, and import-boundary checks.

## Non-Goals

- Region, currency, market, sales-channel availability, pricing, promotion, cart, or order ownership.
