## 1. Core Contract Preparation

- [x] 1.1 Refine `packages/core` module contribution contracts so a concrete module can export typed API and admin contributions instead of string-only placeholders.
- [x] 1.2 Add or update core composition tests to prove the refined module contract still validates dependencies and supports product module registration.

## 2. Product Module Package

- [x] 2.1 Create `packages/modules/product` with the standard module SOP folder structure, product domain types, module key, repository contract, and public exports.
- [x] 2.2 Implement the product schema contribution and wire it into the shared `packages/db` schema assembly without moving ownership out of the product module.
- [x] 2.3 Implement product repository and service logic for list, read-by-id, and draft-capable create flows using shared core services rather than adapter-specific imports.
- [x] 2.4 Define the product module's contract-first API exports, route metadata, and admin metadata exports through the shared module contract.

## 3. Runtime and App Integration

- [x] 3.1 Register the product API fragment in `packages/api` and extend API tests to cover product route assembly and conflict protection.
- [x] 3.2 Update `apps/server` composition only as needed to include the product-enabled assembled router without introducing domain logic into the Worker.
- [x] 3.3 Add the first admin product surface in `apps/web` that consumes shared typed API clients and module-provided metadata to list or create products.

## 4. Verification and Guardrails

- [x] 4.1 Add product-focused service and repository tests that run without Cloudflare runtime imports in the module package.
- [x] 4.2 Add boundary checks that fail if `packages/modules/product` imports Cloudflare bindings, Hono server types, frontend app code, or `@ecommerce/db-d1`.
- [x] 4.3 Run repo-relevant verification for the slice, including targeted tests plus lint/typecheck or equivalent checks for touched packages.
