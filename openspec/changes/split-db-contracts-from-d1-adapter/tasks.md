## 1. Shared database boundary

- [x] 1.1 Define the shared database contract surface in `packages/db` for adapter-agnostic types, services, and schema coordination exports
- [x] 1.2 Remove direct D1 runtime construction and env reads from `packages/db`
- [x] 1.3 Narrow `packages/db` exports so downstream packages consume the shared boundary intentionally

## 2. D1 adapter extraction

- [x] 2.1 Create `packages/db-d1` with the D1-specific Drizzle client factory and runtime wiring
- [x] 2.2 Move D1 migration configuration and related adapter-owned artifacts out of `packages/db`
- [x] 2.3 Retarget root or workspace DB scripts so D1 generation and push commands still work through the new adapter package

## 3. Composition updates

- [x] 3.1 Update server-side database provisioning to use the D1 adapter package through explicit composition inputs
- [x] 3.2 Update any current DB consumers or tests that assume `packages/db` still constructs a D1 client directly
- [x] 3.3 Preserve current D1-backed behavior while keeping shared packages free of Cloudflare-only runtime imports

## 4. Verification

- [x] 4.1 Add boundary checks that fail if `packages/db` imports D1 runtime modules or server env helpers
- [x] 4.2 Add targeted tests or smoke checks that prove the D1 adapter still constructs a working client from explicit runtime inputs
- [x] 4.3 Run targeted typecheck and test verification for the touched packages and DB scripts

## 5. Follow-through

- [x] 5.1 Capture the next-adapter decision as a follow-up note or proposal without expanding this change into a second adapter implementation
- [x] 5.2 Update this change's OpenSpec task state as implementation lands
