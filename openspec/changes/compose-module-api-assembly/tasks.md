## 1. API assembly contracts

- [x] 1.1 Define the route fragment and API assembly contract surface in `packages/api`
- [x] 1.2 Convert the current hardcoded router into built-in fragments that exercise the new assembly path
- [x] 1.3 Export the assembled root router and shared client typing from a narrow public API surface

## 2. Server integration

- [x] 2.1 Update `apps/server` to mount RPC and OpenAPI handlers from the assembled API surface
- [x] 2.2 Keep Better Auth mounting, CORS, and request-context wiring in `apps/server` while removing any server-local business procedure ownership
- [x] 2.3 Add a registration path for future module and plugin route fragments without requiring direct edits to server transport code

## 3. Verification

- [x] 3.1 Add targeted tests for successful fragment assembly and duplicate-key failure behavior
- [x] 3.2 Verify protected procedures still rely on the shared auth-aware request context after assembly
- [x] 3.3 Add or update architectural boundary checks so `packages/api` stays transport-focused and `apps/server` remains composition-only
