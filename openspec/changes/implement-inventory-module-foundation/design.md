## Context

Inventory mutations are high-contention. D1/Kysely remains the record boundary; Durable Object coordination is used only for serialized aggregate coordination and idempotency where required.

## Scope

- Package boundary: `packages/modules/inventory`.
- Service contracts: inventory item management, stock-location scope, availability checks, reservations, and adjustments.
- Data ownership: inventory items, stock locations, inventory levels, reservations, availability records, and adjustment events.
- Events/workflows: reservation/adjustment events and workflow steps; no checkout orchestration ownership.
- API/admin metadata: inventory management procedures, permissions, navigation, and screens.
- Tests: idempotency, serialized coordination, service/repository behavior, API assembly, admin metadata, and import-boundary checks.

## Non-Goals

- Product catalog ownership, cart ownership, checkout orchestration, or order state.
