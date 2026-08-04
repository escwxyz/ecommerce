import { describe, expect, it } from "bun:test";

import {
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";
import { Effect, Schema } from "effect";

import {
  STORE_ID_PREFIX,
  StoreCurrencyListEmpty,
  StoreDefaultCurrencyUnsupported,
  StoreInvalidIdentifier,
  createStoreId,
} from "../domain";
import { createInMemoryStoreRepository } from "../repositories";
import { createStoreService } from "../services";

describe("store schema-backed expected errors", () => {
  it("serializes and matches an invalid store identifier failure", () => {
    const failure = new StoreInvalidIdentifier({
      expectedPrefix: STORE_ID_PREFIX,
      value: "invalid_1",
    });
    const recovered = Effect.runSync(
      Effect.fail(failure).pipe(
        Effect.catchTag("StoreInvalidIdentifier", (error) =>
          Effect.succeed(error.expectedPrefix)
        )
      )
    );

    expect(Schema.encodeSync(StoreInvalidIdentifier)(failure)).toEqual({
      _tag: "StoreInvalidIdentifier",
      expectedPrefix: STORE_ID_PREFIX,
      value: "invalid_1",
    });
    expect(recovered).toBe(STORE_ID_PREFIX);
    expect(() => createStoreId("invalid_1")).toThrow(
      new StoreInvalidIdentifier({
        expectedPrefix: STORE_ID_PREFIX,
        value: "invalid_1",
      })
    );
  });

  it("serializes and matches an empty supported currency failure", async () => {
    const failure = new StoreCurrencyListEmpty({
      reason: "no-supported-currencies",
    });
    const service = createStoreService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator(["store_1"]),
      repository: createInMemoryStoreRepository(),
    });

    expect(Schema.encodeSync(StoreCurrencyListEmpty)(failure)).toEqual({
      _tag: "StoreCurrencyListEmpty",
      reason: "no-supported-currencies",
    });
    await expect(
      Effect.runPromise(
        service.updateStoreSettings({
          supportedCurrencyCodes: [" ", ""],
        })
      )
    ).rejects.toMatchObject({
      _tag: "StoreCurrencyListEmpty",
      reason: "no-supported-currencies",
    });
  });

  it("serializes and matches an unsupported default currency failure", () => {
    const failure = new StoreDefaultCurrencyUnsupported({
      defaultCurrencyCode: "EUR",
      supportedCurrencyCodes: ["USD"],
    });
    const recovered = Effect.runSync(
      Effect.fail(failure).pipe(
        Effect.catchTag("StoreDefaultCurrencyUnsupported", (error) =>
          Effect.succeed(error.defaultCurrencyCode)
        )
      )
    );

    expect(Schema.encodeSync(StoreDefaultCurrencyUnsupported)(failure)).toEqual(
      {
        _tag: "StoreDefaultCurrencyUnsupported",
        defaultCurrencyCode: "EUR",
        supportedCurrencyCodes: ["USD"],
      }
    );
    expect(recovered).toBe("EUR");
  });
});
