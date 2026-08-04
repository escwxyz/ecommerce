import { Effect, Layer, Ref } from "effect";
import type { Context } from "effect";

/** One repository behavior that every adapter for a module must satisfy. */
export interface RepositoryContractCase<Identifier> {
  readonly name: string;
  readonly run: Effect.Effect<void, unknown, Identifier>;
}

/** Runtime-neutral harness used to run the same repository cases per adapter. */
export interface RepositoryContractHarness<Identifier, State = never> {
  readonly adapter: string;
  readonly layer: Layer.Layer<Identifier, unknown, never>;
  readonly repositoryName: string;
  readonly reset: Effect.Effect<void, unknown, never>;
  readonly runAll: (
    cases: readonly RepositoryContractCase<Identifier>[]
  ) => Effect.Effect<void, unknown, never>;
  readonly runCase: (
    contractCase: RepositoryContractCase<Identifier>
  ) => Effect.Effect<void, unknown, never>;
  readonly snapshot?: Effect.Effect<State, unknown, never>;
}

/** Options for constructing a generic repository contract harness. */
export interface RepositoryContractHarnessOptions<Identifier, State = never> {
  readonly adapter: string;
  readonly layer: Layer.Layer<Identifier, unknown, never>;
  readonly repositoryName: string;
  readonly reset?: Effect.Effect<void, unknown, never>;
  readonly snapshot?: Effect.Effect<State, unknown, never>;
}

/** Options for constructing a resettable in-memory repository contract harness. */
export interface InMemoryRepositoryContractHarnessOptions<
  Identifier,
  Service,
  State,
> {
  readonly initialState: () => State;
  readonly makeRepository: (state: Ref.Ref<State>) => Service;
  readonly repositoryName: string;
  readonly service: Context.Key<Identifier, Service>;
}

/**
 * Creates an adapter-agnostic repository contract harness.
 *
 * The harness resets adapter state before each case and provides only the
 * repository service Layer to the case. Module contract suites can therefore
 * run identical cases against in-memory, PostgreSQL, and future dialects
 * without importing concrete adapter details into module services.
 */
export const createRepositoryContractHarness = <Identifier, State = never>({
  adapter,
  layer,
  repositoryName,
  reset = Effect.void,
  snapshot,
}: RepositoryContractHarnessOptions<
  Identifier,
  State
>): RepositoryContractHarness<Identifier, State> => {
  const runCase = (contractCase: RepositoryContractCase<Identifier>) =>
    reset.pipe(Effect.andThen(contractCase.run), Effect.provide(layer));

  return {
    adapter,
    layer,
    repositoryName,
    reset,
    runAll: (cases) =>
      Effect.forEach(cases, runCase, {
        discard: true,
      }),
    runCase,
    snapshot,
  };
};

/**
 * Creates the canonical in-memory repository contract harness.
 *
 * This builds on the resettable in-memory Layer primitive and gives module
 * contract tests the same adapter-harness shape used by PostgreSQL.
 */
export const createInMemoryRepositoryContractHarness = <
  Identifier,
  Service,
  State,
>({
  initialState,
  makeRepository,
  repositoryName,
  service,
}: InMemoryRepositoryContractHarnessOptions<
  Identifier,
  Service,
  State
>): RepositoryContractHarness<Identifier, State> => {
  const stateRef = Ref.makeUnsafe(initialState());

  return createRepositoryContractHarness({
    adapter: "in-memory",
    layer: Layer.succeed(service, makeRepository(stateRef)),
    repositoryName,
    reset: Effect.flatMap(Effect.sync(initialState), (nextState) =>
      Ref.set(stateRef, nextState)
    ),
    snapshot: Ref.get(stateRef),
  });
};
