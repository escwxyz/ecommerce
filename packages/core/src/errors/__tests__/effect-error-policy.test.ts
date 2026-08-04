import { describe, expect, it } from "bun:test";

import { Cause, Effect, Exit, Schema } from "effect";

import { classifyCause, observeCause } from "../effect-error-policy";

class StoreNotFound extends Schema.TaggedErrorClass<StoreNotFound>()(
  "StoreNotFound",
  { storeId: Schema.NonEmptyString }
) {}

class StorePersistenceUnavailable extends Schema.TaggedErrorClass<StorePersistenceUnavailable>()(
  "StorePersistenceUnavailable",
  { operation: Schema.Literals(["read", "write"]) }
) {}

describe("Effect error policy", () => {
  it("keeps expected failures schema-backed, serializable, and matchable", () => {
    const failure = new StoreNotFound({ storeId: "store_missing" });
    const recovered = Effect.runSync(
      Effect.fail(failure).pipe(
        Effect.catchTag("StoreNotFound", (error) =>
          Effect.succeed(error.storeId)
        )
      )
    );

    expect(Schema.encodeSync(StoreNotFound)(failure)).toEqual({
      _tag: "StoreNotFound",
      storeId: "store_missing",
    });
    expect(recovered).toBe("store_missing");
  });

  it("translates a foreign adapter failure at its owning boundary", () => {
    const adapterOperation = Effect.try({
      try: () => {
        throw new Error("connection details must remain private");
      },
      catch: () => new StorePersistenceUnavailable({ operation: "read" }),
    });
    const exit = Effect.runSyncExit(adapterOperation);

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failures = exit.cause.reasons
        .filter(Cause.isFailReason)
        .map((reason) => reason.error);
      expect(failures).toEqual([
        new StorePersistenceUnavailable({ operation: "read" }),
      ]);
      expect(exit.cause.reasons.some(Cause.isDieReason)).toBe(false);
    }
  });

  it("classifies and observes defects without converting them to failures", () => {
    const observed: Array<ReturnType<typeof classifyCause>> = [];
    const exit = Effect.runSyncExit(
      observeCause(Effect.die("broken invariant"), (cause) =>
        Effect.sync(() => {
          observed.push(classifyCause(cause));
        })
      )
    );

    expect(Exit.isFailure(exit)).toBe(true);
    expect(observed).toEqual([
      {
        hasDefect: true,
        hasExpectedFailure: false,
        hasInterruption: false,
        isInterruptionOnly: false,
      },
    ]);
    if (Exit.isFailure(exit)) {
      expect(Cause.hasDies(exit.cause)).toBe(true);
      expect(Cause.hasFails(exit.cause)).toBe(false);
    }
  });

  it("preserves interruption as interruption", () => {
    const exit = Effect.runSyncExit(
      observeCause(Effect.interrupt, () => Effect.void)
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(classifyCause(exit.cause)).toEqual({
        hasDefect: false,
        hasExpectedFailure: false,
        hasInterruption: true,
        isInterruptionOnly: true,
      });
    }
  });

  it("does not flatten composite causes into a single category", () => {
    const cause = Cause.combine(
      Cause.fail(new StoreNotFound({ storeId: "store_missing" })),
      Cause.die("broken finalizer")
    );

    expect(classifyCause(cause)).toEqual({
      hasDefect: true,
      hasExpectedFailure: true,
      hasInterruption: false,
      isInterruptionOnly: false,
    });
  });
});
