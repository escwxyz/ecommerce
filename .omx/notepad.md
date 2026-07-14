# Project Notes

- Current architecture source of truth: `openspec/changes/adopt-effect-4-backend-architecture/`. The completed Cloudflare blueprint is historical context.
- Backend target: Effect 4 throughout services, Layers, tagged errors, Schema, HTTP/`HttpApi`, Effect SQL PostgreSQL, workflows, configuration, resource safety, concurrency, and telemetry. Drizzle ORM 1.0 RC supplies the Effect-native PostgreSQL schema/query/migration layer.
- Permanent backend removals: Hono, oRPC, Zod, and Kysely. Frontend-only choices are independent.
- Runtime: Cloudflare first with deterministic test Layers for portability; PostgreSQL first through a Cloudflare platform connection expected to use Hyperdrive; Durable Objects first for actors; Rivet deferred.
- Storefront SDK: one Effect API contract with browser HTTP and server-only Cloudflare Service Binding transports.
- Auth exception: Better Auth stays temporarily behind an Effect adapter; do not reimplement auth. Review direct wrapping, `effectify`, and future official support later.
- Migration: pre-production clean break with no backfill or legacy API compatibility; verified vertical slices start with `store` and delete their legacy implementations.
- Current reviewed application cohort: Effect `4.0.0-beta.93`, exact-pinned in the root catalog. Reconfirm the catalog, resolved lockfile cohort, and architecture canaries on every upgrade.
- Effect HTTP task 4.2 baseline: `@ecommerce/api` now owns shared pagination, request identity, success-envelope, paginated-success, and sanitized serialized-error Effect Schemas in `packages/api/src/http-api-schemas.ts`; auth-specific identity/session contracts remain deferred to task 5.1.
- Effect HTTP task 4.3 baseline: `packages/api/src/effect-http-middleware.ts` owns request-scoped context/auth/permission/deadline/telemetry wrappers plus `HttpApiMiddleware.Service` contracts; Better Auth implementation remains deferred behind `EffectHttpAuthService` for task 5.
- Effect HTTP task 4.4 baseline: `packages/api/src/effect-http-api-assembly.ts` deterministically assembles admin/storefront `HttpApi` group contributions, records route fingerprints, and rejects duplicate method/path pairs or group identifiers before Worker/OpenAPI/SDK generation.
- Effect HTTP task 4.5 baseline: `apps/server/src/effect-http-worker.ts` is the native Alchemy v2 Effect Worker entrypoint, while `effect-http-worker-runtime.ts` composes canonical admin/storefront APIs, group handler Layers, isolate runtime Layers, and Worker HTTP support. The legacy Hono entrypoint remains deployed until migrated module groups are ready.
- Effect HTTP task 4.6 baseline: `packages/api/src/effect-http-openapi.ts` derives deterministic admin/storefront OpenAPI snapshots from canonical Effect `HttpApi` assemblies via `OpenApi.fromApi`; snapshots live in `packages/api/src/__tests__/__snapshots__/effect-http-openapi.test.ts.snap` and are generated contract artifacts, not hand-authored API definitions.
