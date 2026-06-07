## Why

The current Better-T-Stack bootstrap has the right application pieces but its infrastructure entrypoint still uses an older async Alchemy style and lacks a tested, Effect-native Cloudflare deployment contract. We need an idiomatic Alchemy v2 foundation before building the commerce platform so runtime code, infrastructure resources, local development, testing, and deployment are one coherent program.

## What Changes

- Replace the bootstrap Alchemy entrypoint with an Alchemy v2 Effect `Stack` that owns the Cloudflare API Worker, TanStack Start admin app, D1 database, bindings, outputs, and lifecycle.
- Introduce infrastructure Layers for Cloudflare resources and runtime bindings so backend code depends on typed service interfaces and infrastructure/runtime wiring remains colocated.
- Keep Effect usage scoped to backend logic and infrastructure code; frontend React/TanStack Start code remains ordinary frontend code.
- Wire the Hono server and oRPC handlers for Cloudflare Worker runtime with typed environment access, Better Auth, D1/Drizzle, CORS, health checks, and API reference routes.
- Add local development, integration testing, deployment, and teardown workflows around `alchemy dev`, `alchemy deploy`, Alchemy test utilities, and Turborepo scripts.
- Document the initial Cloudflare commerce platform conventions for future features such as product catalog, carts, orders, inventory, and background workflows.

## Capabilities

### New Capabilities

- `alchemy-cloudflare-stack`: Defines the Effect-native Alchemy stack that provisions and binds Cloudflare resources for the ecommerce platform.
- `backend-runtime-wiring`: Defines how backend runtime code uses Hono, oRPC, Better Auth, Drizzle/D1, and typed bindings on Cloudflare Workers.
- `infra-dev-test-deploy`: Defines the local development, integration test, deployment, and teardown workflow for the Alchemy-managed stack.

### Modified Capabilities

- None.

## Impact

- Affected code: `packages/infra/alchemy.run.ts`, `packages/infra/package.json`, root scripts, `turbo.json`, `apps/server/src/index.ts`, `packages/api`, `packages/db`, `packages/auth`, `packages/env`, and test files added for infra/runtime verification.
- Affected systems: Cloudflare Workers, Cloudflare D1, TanStack Start Cloudflare deployment, Alchemy state, local `.env`/secret binding flow, and CI deployment configuration.
- Dependencies: continue using the existing catalog entries for `alchemy`, `effect`, `@effect/platform-bun`, `@effect/platform-node`, `hono`, `@orpc/*`, `better-auth`, `drizzle-orm`, `wrangler`, and Cloudflare worker types unless implementation proves an explicit new dependency is required.
