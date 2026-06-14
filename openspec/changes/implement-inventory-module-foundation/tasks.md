## 1. Module Contract

- [x] 1.1 Reference accepted `inventory-module-map` requirements and confirm no divergence.
- [x] 1.2 Define inventory package boundaries, service contracts, data ownership, events/workflow steps, API/admin metadata, coordination use, and extension points.

## 2. Implementation

- [x] 2.1 Create `packages/modules/inventory` with domain, repository, service, coordination, API, admin, module declaration, and test folders.
- [x] 2.2 Add inventory-owned schema contributions through shared database assembly.
- [x] 2.3 Implement foundation operations for availability, reservation, and adjustment flows with idempotency metadata.
- [x] 2.4 Compose API fragments and admin metadata through shared module contracts.

## 3. Verification

- [x] 3.1 Add service, repository, idempotency, coordination, API assembly, admin metadata, and import-boundary tests.
- [x] 3.2 Run targeted tests plus repo-relevant typecheck/lint.
