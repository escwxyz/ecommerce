## Context

Promotion is implemented after pricing so discount logic can use pricing/cart inputs without owning base prices or order financial records.

## Scope

- Package boundary: `packages/modules/promotion`.
- Service contracts: promotion validation, rule evaluation, discount application, and usage tracking.
- Data ownership: promotions, campaigns, rules, usage limits, redemption tracking, and metadata.
- Events/workflows: promotion usage and adjustment events; no cart total workflow ownership.
- API/admin metadata: management procedures, permissions, navigation, and screens.
- Tests: rule evaluation, service/repository behavior, API assembly, admin metadata, and import-boundary checks.

## Non-Goals

- Base price ownership, tax calculation, cart persistence, or order financial records.
