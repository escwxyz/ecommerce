import { describe, expect, it } from "bun:test";

import { Effect, Layer } from "effect";

import { createSequenceIdGenerator, createStaticClock } from "../testing/index";
import {
  ClockService,
  IdGeneratorService,
  clockLayer,
  idGeneratorLayer,
} from "./index";

describe("core services", () => {
  it("provides services through layers without worker bindings", () => {
    const clock = createStaticClock(new Date("2026-01-01T00:00:00.000Z"));
    const ids = createSequenceIdGenerator(["evt_1"]);

    const program = Effect.all([
      ClockService.useSync((service) => service.now().toISOString()),
      IdGeneratorService.useSync((service) => service.nextId()),
    ]).pipe(
      Effect.provide(Layer.mergeAll(clockLayer(clock), idGeneratorLayer(ids)))
    );

    const result = Effect.runSync(program);

    expect(result).toEqual(["2026-01-01T00:00:00.000Z", "evt_1"]);
  });
});
