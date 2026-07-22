import { describe, expect, it } from "bun:test";

import { Effect, Layer } from "effect";

import {
  PostgresDrizzleService,
  PostgresTaxRepositoryLayer,
  withPostgresTaxTransaction,
} from "../index";

describe("PostgreSQL tax repository Layer", () => {
  it("constructs repository Layers without opening a connection", () => {
    const layer = Layer.provideMerge(
      PostgresTaxRepositoryLayer,
      Layer.succeed(PostgresDrizzleService, {
        database: {},
        withTransaction: (effect: Effect.Effect<unknown>) => effect,
      } as never)
    );

    expect(Layer.isLayer(layer)).toBe(true);
  });

  it("exposes transaction wrapper as an Effect", () => {
    expect(Effect.isEffect(withPostgresTaxTransaction(Effect.void))).toBe(true);
  });
});
