import { describe, expect, it } from "bun:test";

import { Effect, Layer, Redacted } from "effect";

import {
  createPostgresClientLayer,
  createPostgresDrizzleLayer,
  createPostgresInventoryRepositoryLayer,
  withPostgresInventoryTransaction,
} from "../index";
import { localPostgresContractUrlEnv } from "../repository-contract-harness";

const livePostgresUrl = process.env[localPostgresContractUrlEnv];

const createLiveDatabaseLayer = () =>
  createPostgresClientLayer({
    applicationName: "@ecommerce/db-postgres:inventory-repository",
    maxConnections: 2,
    url: Redacted.make(livePostgresUrl ?? "postgres://missing"),
  }).pipe((clientLayer) =>
    Layer.merge(
      clientLayer,
      createPostgresDrizzleLayer().pipe(Layer.provide(clientLayer))
    )
  );

describe("PostgreSQL inventory repository Layer", () => {
  it("constructs repository Layers without opening a connection", () => {
    const layer = createPostgresInventoryRepositoryLayer().pipe(
      Layer.provide(createLiveDatabaseLayer())
    );

    expect(Layer.isLayer(layer)).toBe(true);
  });

  it("exposes transaction wrapper as an Effect", () => {
    expect(Effect.isEffect(withPostgresInventoryTransaction(Effect.void))).toBe(
      true
    );
  });
});
