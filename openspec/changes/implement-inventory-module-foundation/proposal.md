## Why

Inventory must be ready before cart reservation and checkout completion can prevent oversell. This change follows `inventory-module-map`.

## What Changes

- Implement inventory items, stock locations, inventory levels, reservations, availability checks, and adjustment events.
- Use shared stateful coordination only where serialized mutations are required.
- Contribute inventory API/admin metadata and tests.

## Capabilities

### New Capabilities

- `inventory-module-foundation`: Implements the first inventory contracts from `inventory-module-map`.

### Modified Capabilities

- None.

## Impact

- Affected areas: `packages/modules/inventory`, shared database schema assembly, stateful coordination contracts, `packages/api`, `apps/web`, and tests.
- Map traceability: derived from `inventory-module-map`.
