import { describe, expect, it } from "bun:test";

import { Effect } from "effect";

import {
  PostgresPaymentRepositoryLayer,
  createPostgresPaymentRepositoryLayer,
  withPostgresPaymentTransaction,
} from "../index";

describe("PostgreSQL payment repository Layer", () => {
  it("constructs repository Layers without opening a connection", () => {
    expect(PostgresPaymentRepositoryLayer).toBeDefined();
    expect(createPostgresPaymentRepositoryLayer).toBeFunction();
  });

  it("exposes transaction wrapper as an Effect", () => {
    const effect = withPostgresPaymentTransaction(Effect.succeed("ok"));

    expect(effect).toBeDefined();
  });
});
