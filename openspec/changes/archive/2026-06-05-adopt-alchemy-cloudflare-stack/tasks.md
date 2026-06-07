## 1. Baseline and API Confirmation

- [x] 1.1 Confirm the installed `alchemy` package exports and v2 API shape against the current docs and package types before editing infra code.
- [x] 1.2 Review relevant Alchemy docs and examples for Cloudflare Worker, Vite/TanStack Start, D1, testing, local dev, CI, monorepo, and Layers patterns.
- [x] 1.3 Inventory existing Better-T-Stack runtime assumptions in `apps/server`, `apps/web`, `packages/env`, `packages/db`, and `packages/auth`.
- [x] 1.4 Document any implementation-time API mismatch between current `alchemy` beta package types and v2 documentation before choosing a fallback.

## 2. Alchemy Stack Migration

- [x] 2.1 Rewrite `packages/infra/alchemy.run.ts` as an Alchemy v2 Effect stack using `Effect` and `Layer` for lifecycle and wiring.
- [x] 2.2 Add Cloudflare provider/state configuration for stage-aware deploys without hardcoding developer-specific state paths.
- [x] 2.3 Define the D1 database resource with migration directory wiring and explicit retention/delete behavior.
- [x] 2.4 Define the API Worker resource with Hono entrypoint, Cloudflare compatibility settings, D1 binding, auth secret, auth URL, and CORS origin.
- [x] 2.5 Define the TanStack Start admin resource with Cloudflare Vite/TanStack support, required compatibility flags, backend URL binding, and frontend-visible server URL.
- [x] 2.6 Expose stack outputs for API URL, admin URL, and database binding metadata needed by tests and deployment reporting.
- [x] 2.7 Keep new abstractions limited to real boundaries: resource layer, runtime binding layer, and test/deploy output layer.

## 3. Runtime Binding and Server Wiring

- [x] 3.1 Update `packages/env` types or helpers so Worker runtime bindings match the Alchemy stack contract.
- [x] 3.2 Ensure `packages/db` creates Drizzle clients from the D1 binding exposed by `@ecommerce/env/server`.
- [x] 3.3 Ensure `packages/auth` reads Better Auth secret, base URL, trusted origins, and database access through the typed runtime environment boundary.
- [x] 3.4 Preserve Hono routes for `/`, `/api/auth/*`, `/rpc`, and `/api-reference`.
- [x] 3.5 Remove or replace runtime `console.error` handling if Ultracite flags it, using the project-preferred logging or error interceptor pattern.
- [x] 3.6 Verify no frontend files under `apps/web/src` import `effect`, `alchemy`, or infra-only modules.

## 4. Scripts and Local Development

- [x] 4.1 Update infra package scripts for `alchemy dev`, `alchemy deploy`, `alchemy destroy`, and integration tests.
- [x] 4.2 Update root scripts and `turbo.json` so repo-level `dev`, `deploy`, `destroy`, `check-types`, `build`, and test commands route to the right packages.
- [x] 4.3 Configure local development ports and URL reporting for API and admin app.
- [x] 4.4 Update README deployment and development notes to describe the Alchemy-managed Cloudflare workflow and required environment variables.

## 5. Tests

- [x] 5.1 Add backend runtime tests for health route and oRPC protected/public behavior where they can run without cloud credentials.
- [x] 5.2 Add an Alchemy integration test that deploys an isolated stage and reads API/admin stack outputs.
- [x] 5.3 Add HTTP assertions for deployed health and oRPC endpoints.
- [x] 5.4 Add cleanup behavior that destroys the isolated test stage in CI or reports the stage name if cleanup fails.
- [x] 5.5 Add a static test or lint check that Effect imports remain absent from frontend source files.

## 6. Verification

- [x] 6.1 Run `bun run check-types` and fix type errors.
- [x] 6.2 Run `bun run check` and fix Ultracite issues.
- [x] 6.3 Run `bun run build` and fix build failures.
- [x] 6.4 Run targeted backend tests and local no-credential tests.
- [x] 6.5 Run Alchemy deploy/integration smoke tests when Cloudflare credentials are available.
- [x] 6.6 Record any skipped credential-gated checks and the exact reason they could not run.

## Verification Notes

- `bun run test:integration` ran successfully, but the deploy smoke test was skipped because `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` were not present in the environment.
