import { describe, expect, it } from "bun:test";

import { Effect, Layer } from "effect";

import {
  PostgresDrizzleService,
  PostgresFulfillmentRepositoryLayer,
  withPostgresFulfillmentTransaction,
} from "../index";

describe("PostgreSQL fulfillment repository Layer", () => {
  it("constructs repository Layers without opening a connection", () => {
    const layer = Layer.provideMerge(
      PostgresFulfillmentRepositoryLayer,
      Layer.succeed(PostgresDrizzleService, {
        database: {},
        withTransaction: (effect: Effect.Effect<unknown>) => effect,
      } as never)
    );

    expect(Layer.isLayer(layer)).toBe(true);
  });

  it("exposes transaction wrapper as an Effect", () => {
    expect(
      Effect.isEffect(withPostgresFulfillmentTransaction(Effect.void))
    ).toBe(true);
  });
});
