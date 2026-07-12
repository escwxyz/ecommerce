import { describe, expect, it } from "bun:test";

import { Context, Effect, Ref } from "effect";

import {
  createInMemoryRepositoryContractHarness,
  createRepositoryContractHarness,
  type RepositoryContractCase,
} from "../index";

class ProductRepository extends Context.Service<
  ProductRepository,
  {
    readonly list: Effect.Effect<readonly string[]>;
    readonly put: (name: string) => Effect.Effect<void>;
  }
>()("test/RepositoryContractHarness/ProductRepository") {}

const productContractCases: readonly RepositoryContractCase<ProductRepository>[] =
  [
    {
      name: "writes and reads one product",
      run: Effect.gen(function* () {
        const repository = yield* ProductRepository;
        yield* repository.put("hat");
        const products = yield* repository.list;
        expect(products).toEqual(["hat"]);
      }),
    },
  ];

describe("repository contract harness", () => {
  it("runs shared repository cases through a resettable in-memory harness", async () => {
    const harness = createInMemoryRepositoryContractHarness({
      initialState: () => [] as string[],
      makeRepository: (state) =>
        ProductRepository.of({
          list: Ref.get(state),
          put: (name) => Ref.update(state, (items) => [...items, name]),
        }),
      repositoryName: "ProductRepository",
      service: ProductRepository,
    });

    await Effect.runPromise(harness.runAll(productContractCases));

    expect(harness.adapter).toBe("in-memory");
    expect(harness.snapshot).toBeDefined();

    if (!harness.snapshot) {
      throw new Error("Expected in-memory harness snapshot.");
    }

    expect(await Effect.runPromise(harness.snapshot)).toEqual(["hat"]);
  });

  it("resets adapter state before each contract case", async () => {
    const harness = createInMemoryRepositoryContractHarness({
      initialState: () => [] as string[],
      makeRepository: (state) =>
        ProductRepository.of({
          list: Ref.get(state),
          put: (name) => Ref.update(state, (items) => [...items, name]),
        }),
      repositoryName: "ProductRepository",
      service: ProductRepository,
    });
    const caseExpectingEmptyState: RepositoryContractCase<ProductRepository> = {
      name: "starts from clean state",
      run: ProductRepository.use((repository) =>
        repository.list.pipe(
          Effect.map((products) => {
            expect(products).toEqual([]);
          })
        )
      ),
    };

    const writesAndReadsProduct = productContractCases[0];

    if (!writesAndReadsProduct) {
      throw new Error("Expected repository contract case.");
    }

    await Effect.runPromise(harness.runCase(writesAndReadsProduct));
    await Effect.runPromise(harness.runCase(caseExpectingEmptyState));
  });

  it("creates custom adapter harnesses without coupling tests to adapter internals", () => {
    const harness = createRepositoryContractHarness({
      adapter: "custom-adapter",
      layer: createInMemoryRepositoryContractHarness({
        initialState: () => [] as string[],
        makeRepository: (state) =>
          ProductRepository.of({
            list: Ref.get(state),
            put: (name) => Ref.update(state, (items) => [...items, name]),
          }),
        repositoryName: "ProductRepository",
        service: ProductRepository,
      }).layer,
      repositoryName: "ProductRepository",
    });

    const writesAndReadsProduct = productContractCases[0];

    if (!writesAndReadsProduct) {
      throw new Error("Expected repository contract case.");
    }

    expect(Effect.isEffect(harness.runCase(writesAndReadsProduct))).toBe(true);
    expect(harness.adapter).toBe("custom-adapter");
  });
});
