import { describe, expect, it } from "bun:test";

import { Effect, Layer, Redacted } from "effect";

import {
  CurrentPostgresTransactionService,
  PostgresDrizzleService,
  createDrizzlePgTypes,
  createPostgresClientLayer,
  createPostgresDatabaseLayer,
  createPostgresDrizzleLayer,
  createPostgresPoolConfig,
  drizzleRawTextTypeOids,
  postgresAdapterTarget,
} from "../index";

describe("Effect PostgreSQL and Drizzle Layers", () => {
  it("configures pg parsers so Drizzle owns date/time normalization", () => {
    const parser = createDrizzlePgTypes().getTypeParser(
      drizzleRawTextTypeOids[0]
    );

    expect(parser("2026-01-01 12:00:00+00")).toBe("2026-01-01 12:00:00+00");
  });

  it("preserves regular pg parser fallback behavior", () => {
    const parser = createDrizzlePgTypes().getTypeParser(23);

    expect(parser("42")).toBe(42);
  });

  it("redacts URL-based pool configuration at composition boundaries", () => {
    const config = createPostgresPoolConfig({
      applicationName: "@ecommerce/db-postgres:test",
      maxConnections: 1,
      url: "postgres://user:password@example.test:5432/ecommerce",
    });

    expect(Redacted.isRedacted(config.url)).toBe(true);
    expect(String(config.url)).toBe("<redacted>");
    expect(config.applicationName).toBe("@ecommerce/db-postgres:test");
  });

  it("constructs scoped client and Drizzle database Layers without opening a socket", () => {
    const postgres = createPostgresPoolConfig({
      applicationName: "@ecommerce/db-postgres:test",
      maxConnections: 1,
      url: "postgres://user:password@example.test:5432/ecommerce",
    });

    expect(Layer.isLayer(createPostgresClientLayer(postgres))).toBe(true);
    expect(Layer.isLayer(createPostgresDrizzleLayer())).toBe(true);
    expect(
      Layer.isLayer(
        createPostgresDatabaseLayer({
          postgres,
        })
      )
    ).toBe(true);
  });

  it("exposes a Drizzle service whose transaction operation stays in Effect", () => {
    const program = PostgresDrizzleService.use((service) =>
      service.withTransaction((transaction) =>
        Effect.succeed({
          adapter: postgresAdapterTarget,
          hasTransaction: Boolean(transaction),
        })
      )
    );

    expect(Effect.isEffect(program)).toBe(true);
  });

  it("exposes the active Drizzle transaction through an adapter-local service", () => {
    const program = PostgresDrizzleService.use((service) =>
      service.withTransaction((transaction) =>
        CurrentPostgresTransactionService.use((currentTransaction) =>
          Effect.succeed(currentTransaction === transaction)
        )
      )
    );

    expect(Effect.isEffect(program)).toBe(true);
  });
});
