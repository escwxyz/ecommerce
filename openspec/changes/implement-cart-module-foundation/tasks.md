## 1. Module Contract

- [x] 1.1 Reference accepted `cart-module-map` requirements and confirm prerequisite module contracts are accepted.
- [x] 1.2 Define cart package boundaries, service contracts, data ownership, events/workflow steps, API/admin metadata, coordination use, and extension points.

## 2. Implementation

- [x] 2.1 Create `packages/modules/cart` with domain, repository, service, coordination, API, admin, module declaration, and test folders.
- [x] 2.2 Add cart-owned schema contributions through shared database assembly.
- [x] 2.3 Implement foundation operations for cart aggregate creation and mutation with idempotency metadata where required.
- [x] 2.4 Compose API fragments and admin metadata through shared module contracts.

## 3. Verification

- [x] 3.1 Add service, repository, coordination, dependency-contract, API assembly, admin metadata, and import-boundary tests.
- [x] 3.2 Run targeted tests plus repo-relevant typecheck/lint.
