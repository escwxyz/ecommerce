## Context

This repository is an initial Better-T-Stack bootstrap for an ecommerce platform. It already contains a TanStack Start admin app in `apps/web`, a Hono server in `apps/server`, oRPC contracts in `packages/api`, Better Auth in `packages/auth`, Drizzle/D1 access in `packages/db`, typed environment access in `packages/env`, and an Alchemy package in `packages/infra`.

The current infrastructure file provisions D1, a TanStack Start app, and a Worker, but it uses the older top-level async `alchemy(...)` / `await app.finalize()` style. The target architecture is Alchemy v2 Infrastructure-as-Effects: infrastructure resources, platform bindings, runtime code, tests, and deploy lifecycle are expressed as an Effect program. Alchemy docs also recommend starting monorepos with a single stack for backend and frontend deployment, using `Cloudflare.Vite` for Vite-based frameworks such as TanStack Start, using Alchemy test utilities for deploy-and-hit integration tests, and using Layers to encapsulate resources and bindings behind typed service contracts.

## Goals / Non-Goals

**Goals:**

- Make `packages/infra/alchemy.run.ts` the single Alchemy v2 Effect stack for this project.
- Provision the Cloudflare D1 database, API Worker, and TanStack Start admin app from the same stack.
- Bind secrets, env vars, and resources through Alchemy instead of hand-maintained Wrangler config.
- Keep infrastructure and backend runtime wiring Effect-friendly using `Effect` and `Layer`.
- Preserve Hono as the HTTP server, oRPC as the API contract layer, Better Auth for authentication, and Drizzle over D1 for database access.
- Add enough verification to prove local dev, stack deployment, Worker routing, auth wiring, database binding, and teardown paths.
- Keep frontend React/TanStack Start code free of Effect imports and Effect runtime concepts.

**Non-Goals:**

- Build Medusa-equivalent commerce domain features in this change.
- Replace Hono, oRPC, Better Auth, Drizzle, TanStack Start, or Turborepo.
- Introduce a new database provider, queue, object storage, workflow engine, or payment dependency.
- Add Effect to frontend UI components, routes, or client-side state code.
- Implement production observability, custom domains, or multi-region policy beyond the baseline deploy shape.

## Decisions

1. Use one repo-level Alchemy stack package for both backend and admin app.

   Start with a single stack because the backend API and admin app are deployed together during bootstrap, the frontend needs the backend URL, and avoiding cross-stack references keeps initial iteration simpler. A future split into separate backend/frontend stacks can be proposed when deployment cadence or ownership requires it.

   Alternative considered: keep separate stack entrypoints per package. Rejected because it adds stage/reference ordering before there is enough platform surface to justify it.

2. Migrate the infrastructure entrypoint to Alchemy v2 `Stack` + `Effect` + `Layer`.

   The stack should return an Effect and compose providers/resources through Layers. Resource lifecycle code must return Effects instead of running ad hoc top-level side effects. Infrastructure Layers should expose typed services such as database binding metadata, backend platform outputs, and web platform outputs where that improves testability or keeps implementation readable.

   Alternative considered: keep the current async Alchemy entrypoint and add tests around it. Rejected because it does not satisfy the target Infrastructure-as-Effects model and would leave future platform work on the wrong abstraction.

3. Keep Cloudflare bindings as the runtime boundary.

   The Worker and TanStack Start deployment must receive D1, Better Auth secrets, CORS origin, and URLs via Alchemy bindings. Backend modules should read runtime values through the existing `@ecommerce/env/server` boundary, preserving Cloudflare `env` typing and avoiding direct `process.env` access in Worker runtime code.

   Alternative considered: read `.env` directly in server/auth/db modules. Rejected because Cloudflare Workers provide runtime bindings, and direct environment reads are brittle after deploy.

4. Preserve the current Hono + oRPC server shape.

   Hono remains the HTTP router, Better Auth stays mounted under `/api/auth/*`, oRPC RPC remains under `/rpc`, the OpenAPI reference remains under `/api-reference`, and `/` remains a simple health endpoint. Implementation may extract small helpers around context creation or error handling, but it should not replatform the API.

   Alternative considered: move backend routing to Effect HTTP or Effect RPC now. Rejected because the project explicitly chose Hono and oRPC, and Effect should only be used for backend business logic and infrastructure wiring where it adds value.

5. Use Alchemy-managed local dev and integration tests.

   `alchemy dev` should be the Cloudflare runtime development path for infrastructure-bound apps. Integration tests should deploy a temporary/test stage, read stack outputs, hit the live Worker/admin endpoints, and destroy test resources when running in CI or explicit cleanup mode.

   Alternative considered: rely only on unit tests and local Hono handler tests. Rejected because binding correctness, D1 availability, and Worker/TanStack deployment are the core risks of this change.

## Risks / Trade-offs

- Alchemy v2 APIs are beta and may differ from existing v1 examples -> verify against `https://v2.alchemy.run/llms.txt`, current docs pages, and installed package types before implementation.
- Cloudflare D1 migrations may be missing or not generated yet -> add migration verification and make database setup explicit before deploy tests.
- Better Auth cookie settings can differ between localhost and `*.workers.dev` -> validate auth route behavior with environment-specific URL/CORS settings and keep deploy-domain cookie tuning in config, not scattered code.
- TanStack Start SSR may require `nodejs_compat` -> set compatibility through the Alchemy Cloudflare frontend resource and smoke-test the deployed admin app.
- Integration tests create cloud resources -> use isolated stages, deterministic names, and teardown in CI; document manual cleanup for interrupted runs.
- Moving to Layers can over-abstract a small bootstrap -> keep Layers focused on real boundaries: resources, bindings, runtime services, and test handles.

## Migration Plan

1. Confirm installed Alchemy v2 package exports and update imports/API usage accordingly.
2. Rewrite `packages/infra/alchemy.run.ts` to an Effect Stack with Cloudflare providers/state, D1, API Worker, TanStack Start app, bindings, and outputs.
3. Add or adjust environment typing so Cloudflare bindings match the stack.
4. Adjust package scripts and Turborepo tasks for `alchemy dev`, deploy, destroy, and integration tests.
5. Add targeted backend/runtime tests and Alchemy integration tests.
6. Run typecheck, lint, build, local smoke checks, and deployment smoke tests where credentials are available.
7. Roll back by restoring the previous Alchemy entrypoint and scripts if deploy fails before production traffic depends on the new stack.

## Open Questions

- Which Cloudflare stage names should be reserved for shared environments beyond local developer stages, staging, production, and PR previews?
- Should CI manage Alchemy remote state immediately, or should the first implementation keep state local until Cloudflare credentials and repository secrets are confirmed?
- Should Better Auth deploy-domain cookie configuration be enabled in this change or deferred until the first production custom domain is chosen?
