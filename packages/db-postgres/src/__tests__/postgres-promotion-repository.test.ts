import { describe, expect, it } from "bun:test";

import { Effect, Layer, Redacted } from "effect";

import {
  createPostgresClientLayer,
  createPostgresDrizzleLayer,
  createPostgresPromotionRepositoryLayer,
  withPostgresPromotionTransaction,
} from "../index";
import { localPostgresContractUrlEnv } from "../repository-contract-harness";

const livePostgresUrl = process.env[localPostgresContractUrlEnv];

const createLiveDatabaseLayer = () =>
  createPostgresClientLayer({
    applicationName: "@ecommerce/db-postgres:promotion-repository",
    maxConnections: 2,
    url: Redacted.make(livePostgresUrl ?? "postgres://missing"),
  }).pipe((clientLayer) =>
    Layer.merge(
      clientLayer,
      createPostgresDrizzleLayer().pipe(Layer.provide(clientLayer))
    )
  );

describe("PostgreSQL promotion repository Layer", () => {
  it("constructs repository Layers without opening a connection", () => {
    const layer = createPostgresPromotionRepositoryLayer().pipe(
      Layer.provide(createLiveDatabaseLayer())
    );

    expect(Layer.isLayer(layer)).toBe(true);
  });

  it("exposes transaction wrapper as an Effect", () => {
    expect(Effect.isEffect(withPostgresPromotionTransaction(Effect.void))).toBe(
      true
    );
  });
});
