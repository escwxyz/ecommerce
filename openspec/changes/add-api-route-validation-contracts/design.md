## Context

`compose-module-api-assembly` converted `packages/api` into a route-fragment assembler, but the resulting contract still allows contributors to register procedures without a standardized validation story. That is acceptable for the bootstrap health/private routes, but it is not a durable boundary for real commerce modules.

The stack already includes oRPC and Zod integration, and the server exports OpenAPI from the assembled router. That means the lowest-friction next step is to require schemas where route fragments declare procedure inputs and outputs, then verify those contracts through tests and generated behavior. The repo also uses Effect elsewhere, so the design should leave space for a future bridge or later reevaluation without blocking the first validation slice.

Constraints:

- Route validation must fit the existing API assembly contract rather than bypassing it.
- The first implementation should avoid introducing a second validation runtime when Zod is already present in the API stack.
- Validation requirements must be enforceable by tests or contract helpers, not left as documentation-only guidance.
- `apps/server` should continue to own transport wiring, while `packages/api` owns procedure contracts and schema requirements.

## Goals / Non-Goals

**Goals:**

- Define how API route fragments declare required request and response schemas.
- Standardize the first schema contract on Zod for procedure input/output validation and OpenAPI generation.
- Update the route fragment contract so built-in, module, and plugin contributors follow one validation pattern.
- Add verification that catches missing validation declarations and proves schema-backed procedure behavior.
- Keep the public API surface narrow so downstream packages consume assembled types rather than fragment internals.

**Non-Goals:**

- Rebuild the API assembly contract from scratch.
- Introduce Effect Schema as a second first-class validation runtime in the same slice.
- Implement every future commerce route; this change only hardens the contract they will use.
- Finalize a general-purpose schema translation layer between Zod and Effect.

## Decisions

1. Standardize the first route-validation contract on Zod.

   oRPC and the current server OpenAPI flow already use Zod tooling, so Zod is the lowest-risk way to make validation required before more routes land.

   Alternative considered: support both Zod and Effect Schema immediately. Rejected because it adds contract complexity before the repo has one stable validation convention.

2. Require schemas at the procedure-construction boundary, not as optional fragment metadata.

   Validation should be part of how procedures are declared, so route contributors cannot forget it while still satisfying the fragment interface.

   Alternative considered: attach optional schemas to fragment metadata. Rejected because optional metadata is too easy to bypass and weakens the contract.

3. Treat response schemas as part of the contract, not only input validation.

   The same contract should govern request parsing, response typing, and OpenAPI generation so route behavior stays explicit and testable.

   Alternative considered: validate inputs only. Rejected because output drift would still break clients and documentation silently.

4. Add contract helpers and tests that make the validated path the default path.

   `packages/api` should provide helpers that make validated procedure declaration straightforward, while tests enforce duplicate-route behavior plus schema-backed validation behavior.

   Alternative considered: rely on contributor discipline and examples. Rejected because the route boundary is architectural and should fail loudly when it regresses.

## Risks / Trade-offs

- [Risk] Zod-first validation could make later Effect alignment look inconsistent
  -> [Mitigation] keep the contract boundary narrow so a future schema adapter or migration can happen behind helper APIs rather than across every route.
- [Risk] Requiring response schemas may add verbosity to simple routes
  -> [Mitigation] provide small helpers and start by converting built-in routes so the preferred path is clear.
- [Risk] Validation helpers could leak too much procedure implementation detail into fragment registration
  -> [Mitigation] keep fragment registration separate from validated procedure construction and expose only the narrow public contract.

## Migration Plan

1. Extend `packages/api` procedure helpers or route-contract helpers so schema-backed declaration is the default path for public and protected procedures.
2. Convert built-in route fragments to use explicit input/output schemas.
3. Update assembly-level tests to cover validation success/failure behavior in addition to route merge behavior.
4. Verify OpenAPI generation and downstream typing still resolve through the assembled root router.
5. Leave Effect Schema evaluation to a later proposal if the repo needs a shared schema abstraction across API and core runtime boundaries.

Rollback is straightforward because this change only tightens route contract declarations and tests. Reverting the helper changes and validated built-in routes restores the current assembly shape.

## Open Questions

- Is a future Zod-to-Effect Schema bridge needed for shared domain contracts, or can API validation stay Zod-scoped even if core runtime types use Effect patterns?
- Should every response schema be explicit from the first slice, or are a few transport-level passthrough cases acceptable if documented?
