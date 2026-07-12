# Effect 4 Dependency Policy

## Reviewed baseline

The first migration baseline is the `4.0.0-beta.93` release cohort:

- `effect@4.0.0-beta.93`
- `@effect/platform-bun@4.0.0-beta.93`
- `@effect/platform-node@4.0.0-beta.93`
- `@effect/sql-pg@4.0.0-beta.93`

The workspace lockfile already resolved the core and platform cohort together
before the Effect-native migration began. The selected platform and SQL PostgreSQL
packages declare
`effect@^4.0.0-beta.93` as their peer range in the lockfile, so the exact
`effect@4.0.0-beta.93` pin satisfies the reviewed set.

The baseline intentionally does not follow the `effect-smol` `main` branch.
Upstream experimental packages advance independently, and a current checkout
can contain newer versions than those verified by this repository. New Effect
packages, including SQL clients, must be added at an exact version shown to be
compatible with this baseline or must trigger a dedicated cohort upgrade.

## Source

- Upstream repository: `https://github.com/Effect-TS/effect-smol`
- Reviewed release tag: `effect@4.0.0-beta.93`
- Local evidence: the root catalog and `bun.lock` resolved Effect and both
  platform packages at `4.0.0-beta.93`
- Review date: 2026-07-12

## Rule

Effect packages must use exact versions in the root workspace catalog. Do not
use `latest`, Git branches, caret/tilde ranges, or compound ranges. Effect
upgrades are isolated changes that update this document, run the architecture
canaries, and complete the verification workflow defined by this change.

## Upgrade workflow

1. Create a dedicated OpenSpec change whose only dependency changes are the
   Effect cohort, Drizzle RC when required for compatibility, and directly
   coupled drivers.
2. Read the selected `effect-smol` release metadata and Drizzle release notes.
   Record package peer ranges and the reviewed upstream revision here.
3. Update exact catalog versions together and run `bun install` to refresh the
   lockfile. Reject duplicate or incompatible Effect resolutions.
4. Run the focused architecture canaries:

   ```sh
   bun test packages/core/src/effect-4-schema-canary.test.ts
   bun test packages/core/src/effect-4-runtime-canary.test.ts
   bun test packages/core/src/effect-4-http-api-canary.test.ts
   bun test packages/db-postgres/src/effect-postgres-canary.test.ts
   bun test apps/server/src/effect-worker-canary.test.ts
   ```

5. Run package and workspace verification:

   ```sh
   bun run --cwd packages/core check-types
   bun run --cwd packages/db-postgres check-types
   bun run --cwd apps/server check-types
   bun check-types
   bun test
   bun run check
   bun run build
   ```

6. Run credential-free Cloudflare startup and PostgreSQL adapter smoke tests.
   Run credential-gated integration tests when the change affects Hyperdrive,
   deployed Workers, queues, Durable Objects, or production exporters.
7. Review generated OpenAPI/schema snapshots, migration output, transaction
   rollback behavior, typed error serialization, and browser/server SDK
   boundaries before accepting the upgrade.

No unrelated feature or refactor work belongs in an Effect cohort upgrade.
