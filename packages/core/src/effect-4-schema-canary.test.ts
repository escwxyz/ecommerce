import { describe, expect, it } from "bun:test";

import { Effect, Exit, Schema } from "effect";

const StoreId = Schema.NonEmptyString.pipe(Schema.brand("StoreId"));

const Store = Schema.Struct({
  id: StoreId,
  name: Schema.NonEmptyString,
});

class StoreNotFound extends Schema.TaggedErrorClass<StoreNotFound>()(
  "StoreNotFound",
  { id: StoreId }
) {}

describe("Effect 4 Schema canary", () => {
  it("decodes unknown domain input into branded values", () => {
    const store = Schema.decodeUnknownSync(Store)({
      id: "store_default",
      name: "Default Store",
    });

    expect(String(store.id)).toBe("store_default");
    expect(store.name).toBe("Default Store");
  });

  it("rejects invalid unknown input before it reaches domain logic", () => {
    const result = Schema.decodeUnknownExit(Store)({
      id: "",
      name: "Default Store",
    });

    expect(Exit.isFailure(result)).toBe(true);
  });

  it("serializes and handles a schema-backed tagged error", () => {
    const error = new StoreNotFound({ id: StoreId.make("store_missing") });
    const encoded = Schema.encodeSync(StoreNotFound)(error);
    const recovered = Effect.runSync(
      Effect.fail(error).pipe(
        Effect.catchTag("StoreNotFound", (failure) =>
          Effect.succeed(failure.id)
        )
      )
    );

    expect(encoded).toEqual({
      _tag: "StoreNotFound",
      id: "store_missing",
    });
    expect(String(recovered)).toBe("store_missing");
  });
});
