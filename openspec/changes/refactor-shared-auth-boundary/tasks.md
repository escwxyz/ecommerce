## 1. Shared auth contracts

- [x] 1.1 Add explicit shared auth/session/user/permission types and auth service interfaces to `packages/auth`
- [x] 1.2 Parameterize the Better Auth factory so runtime dependencies are injected instead of read inside shared auth code
- [x] 1.3 Narrow the public exports so downstream packages consume the shared boundary intentionally

## 2. Server-owned provisioning

- [x] 2.1 Move auth instance creation into `apps/server` composition so the Worker owns runtime provisioning
- [x] 2.2 Mount the Better Auth handler from the server-owned auth instance without recreating it in shared code
- [x] 2.3 Update any server tests that need to construct the auth runtime explicitly

## 3. API context wiring

- [x] 3.1 Update `packages/api` context construction to accept the shared auth instance or accessor as input
- [x] 3.2 Remove local auth construction from `packages/api` request handling
- [x] 3.3 Preserve protected procedure behavior with the shared context shape

## 4. Boundary verification

- [x] 4.1 Add targeted tests or import checks that ensure `packages/auth` remains the shared source of truth
- [x] 4.2 Add coverage that fails if `packages/api` starts reconstructing auth locally again
- [x] 4.3 Verify the touched packages with targeted typecheck and test runs

## 5. Follow-through

- [x] 5.1 Update the roadmap or implementation notes if the first permission model needs to be referenced elsewhere
- [x] 5.2 Mark the OpenSpec tasks complete as implementation lands
