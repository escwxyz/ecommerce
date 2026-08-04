import { describe, expect, it } from "bun:test";

import * as PgDrizzle from "drizzle-orm/effect-postgres";
import { createSelectSchema } from "drizzle-orm/effect-schema";
import { pgTable, text } from "drizzle-orm/pg-core";
import { Effect, Exit, Schema } from "effect";

const canaryStore = pgTable("effect_canary_store", {
  id: text().primaryKey(),
  name: text().notNull(),
});

const CanaryStoreRow = createSelectSchema(canaryStore);

describe("Effect PostgreSQL and Drizzle canary", () => {
  it("decodes PostgreSQL rows through the Drizzle Effect schema", () => {
    const row = Schema.decodeUnknownSync(CanaryStoreRow)({
      id: "store_default",
      name: "Default Store",
    });
    const invalid = Schema.decodeUnknownExit(CanaryStoreRow)({
      id: "store_default",
      name: null,
    });

    expect(row).toEqual({
      id: "store_default",
      name: "Default Store",
    });
    expect(Exit.isFailure(invalid)).toBe(true);
  });

  it("constructs an Effect-native transactional Drizzle query", () => {
    const program = Effect.gen(function* () {
      const db = yield* PgDrizzle.makeWithDefaults();
      return yield* db.transaction((transaction) =>
        transaction
          .insert(canaryStore)
          .values({ id: "store_default", name: "Default Store" })
          .returning()
      );
    });

    expect(Effect.isEffect(program)).toBe(true);
  });
});
