> Superseded storage note: `replace-drizzle-primary-storage-with-kysely` replaces the Drizzle-specific parts of this completed change with Kysely-based primary storage. Keep the boundary split, but do not use this artifact as current guidance for Drizzle.

## Why

This change implements the database boundary defined by `define-cloudflare-commerce-blueprint`. The repo currently treats Drizzle and D1 as the same concern, which blocks additional adapters and causes runtime details to leak into domain code.

## What Changes

- Split shared database contracts from the Cloudflare D1 adapter.
- Define adapter contract tests that can run against D1 and non-D1 implementations.
- Preserve D1 as the first production adapter while documenting the next adapter decision.

## Capabilities

### New Capabilities

- `database-adapter-boundary`: Defines shared database contracts, adapter-specific runtime code, and adapter verification expectations.

### Modified Capabilities

- None.

## Impact

- Affected areas: `packages/db`, planned adapter packages, infra bindings, and test setup.
- Blueprint traceability: derived from `define-cloudflare-commerce-blueprint` tasks `1.5`, `2.3`, `3.3`, and the next-adapter open question.
