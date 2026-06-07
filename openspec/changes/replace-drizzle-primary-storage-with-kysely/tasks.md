## 1. Dependency and adapter setup

- [x] 1.1 Use EmDash's adapter descriptor and connection patterns from `refs/emdash/packages/core/src/db` and `refs/emdash/packages/core/src/database` as the local reference for Kysely adapter structure
- [x] 1.2 Add Kysely and the selected Cloudflare D1 Kysely dialect path used by Better Auth/Kysely relational support, documenting any Cloudflare Worker compatibility notes
- [x] 1.3 Remove Drizzle from the target primary storage plan, keeping it only for short-lived migration staging if implementation still needs an intermediate step

## 2. Shared database contracts

- [x] 2.1 Refactor `packages/db` to expose Kysely database type assembly, table contribution contracts, migration contribution contracts, and dialect helper contracts
- [x] 2.2 Remove Drizzle exports from shared commerce database contracts, except any explicitly documented temporary compatibility surface
- [x] 2.3 Add boundary verification that prevents Cloudflare runtime, D1 dialect wrapper, `drizzle-orm/d1`, server env, Hono, or concrete adapter imports from leaking into `packages/db`

## 3. D1 adapter and migrations

- [x] 3.1 Refactor `packages/db-d1` to create a D1-backed `Kysely<CommerceDatabase>` from explicit Worker binding inputs
- [x] 3.2 Replace Drizzle/D1 migration generation for commerce-owned primary data with a Kysely migration runner owned by the D1 adapter package
- [x] 3.3 Add D1-focused tests or smoke coverage for Kysely client creation, request-scoped behavior, and migration execution

## 4. Product persistence proof slice

- [x] 4.1 Replace product Drizzle table and repository code with product-owned Kysely table types, migration contribution, and SQL repository mapping
- [x] 4.2 Preserve product domain behavior for branded IDs, handle normalization, duplicate-handle rejection, status mapping, and timestamps
- [x] 4.3 Update product repository contract tests to run against the in-memory adapter and the Kysely SQL/D1-compatible adapter path
- [x] 4.4 Ensure server product routes compose the Kysely-backed repository and no longer depend on Drizzle runtime code

## 5. Auth Kysely alignment

- [x] 5.1 Configure Better Auth through its Kysely-compatible relational database path for the selected D1/Kysely adapter
- [x] 5.2 Migrate auth persistence factories and exported auth types away from the current Drizzle adapter path
- [x] 5.3 Verify Drizzle does not remain in the long-term `packages/auth` contract or shared commerce database contract

## 6. Documentation and planning sync

- [x] 6.1 Update `README.md`, `docs/architecture-roadmap.md`, package docs, and agent-facing architecture guidance to describe Kysely as the primary relational storage strategy
- [x] 6.2 Update or supersede Drizzle-era OpenSpec references in blueprint/data-adapter/product persistence docs so future changes do not treat Drizzle as strategic
- [x] 6.3 Audit existing Drizzle-oriented changes and decide which should be archived, explicitly superseded, or left as historical context
- [x] 6.4 Capture follow-up micro-changes for libSQL, PostgreSQL, additional modules, migration tooling hardening, and Drizzle cleanup if they remain outside this change

## 7. Verification

- [x] 7.1 Run targeted product repository tests and D1/Kysely adapter tests
- [x] 7.2 Run database boundary checks, typecheck, lint/format checks, and any affected server route tests
- [x] 7.3 Run `openspec status --change "replace-drizzle-primary-storage-with-kysely"` and confirm required artifacts and task state are ready for apply/archive flow
