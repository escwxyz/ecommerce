import { describe, expect, it } from "bun:test";

import { Clock, Config, Context, Effect, Ref } from "effect";

import { ClockService, IdGeneratorService } from "../../services/index";
import { recordDurableAudit } from "../../telemetry/index";
import {
  createDeterministicClockLayer,
  createInMemoryRepositoryTestLayer,
  createSequenceIdGeneratorLayer,
  createTestConfigLayer,
  createTestTelemetry,
} from "../index";

class ProductRepository extends Context.Service<
  ProductRepository,
  {
    readonly list: Effect.Effect<readonly string[]>;
    readonly put: (name: string) => Effect.Effect<void>;
  }
>()("test/ProductRepository") {}

describe("Effect test Layer conventions", () => {
  it("provides deterministic Effect and legacy clock services from one Layer", async () => {
    const layer = createDeterministicClockLayer(
      new Date("2026-07-12T10:11:12.013Z")
    );
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const millis = yield* Clock.currentTimeMillis;
        const legacyDate = yield* ClockService.useSync((service) =>
          service.now().toISOString()
        );
        return {
          legacyDate,
          millis,
        };
      }).pipe(Effect.provide(layer))
    );

    expect(result).toEqual({
      legacyDate: "2026-07-12T10:11:12.013Z",
      millis: 1_783_851_072_013,
    });
  });

  it("provides sequence IDs as a reusable test Layer", async () => {
    const idsLayer = createSequenceIdGeneratorLayer(["id_1", "id_2"]);
    const program = Effect.all([
      IdGeneratorService.useSync((service) => service.nextId()),
      IdGeneratorService.useSync((service) => service.nextId()),
    ]).pipe(Effect.provide(idsLayer));

    await expect(Effect.runPromise(program)).resolves.toEqual(["id_1", "id_2"]);
  });

  it("provides deterministic configuration through ConfigProvider", async () => {
    const configLayer = createTestConfigLayer({
      SERVICE: {
        NAME: "commerce-api",
        PORT: 8787,
      },
    });
    const config = Config.all({
      name: Config.string("NAME"),
      port: Config.port("PORT"),
    }).pipe(Config.nested("SERVICE"));

    await expect(
      Effect.runPromise(config.pipe(Effect.provide(configLayer)))
    ).resolves.toEqual({ name: "commerce-api", port: 8787 });
  });

  it("captures logs, spans, and durable audit events without external exporters", async () => {
    const telemetry = createTestTelemetry();
    const program = Effect.gen(function* () {
      yield* Effect.log("commerce.operation.test");
      yield* Effect.withSpan("test.span")(Effect.void);
      yield* recordDurableAudit({
        attributes: { module: "store" },
        correlation: { requestId: "request_1" },
        eventId: "audit_1",
        eventType: "security.permission.allowed",
        subjectId: "store_1",
      });
    }).pipe(Effect.provide(telemetry.layer));

    await Effect.runPromise(program);

    expect(telemetry.logs).toEqual([
      {
        annotations: {},
        message: ["commerce.operation.test"],
      },
    ]);
    expect(telemetry.spans.map((span) => span.name)).toContain("test.span");
    expect(telemetry.auditEvents.map((event) => event.eventId)).toEqual([
      "audit_1",
    ]);
  });

  it("wraps future repository services with resettable in-memory state", async () => {
    const repository = createInMemoryRepositoryTestLayer({
      initialState: () => [] as string[],
      makeRepository: (state) =>
        ProductRepository.of({
          list: Ref.get(state),
          put: (name) => Ref.update(state, (items) => [...items, name]),
        }),
      service: ProductRepository,
    });
    const program = Effect.gen(function* () {
      const repo = yield* ProductRepository;
      yield* repo.put("hat");
      const beforeReset = yield* repo.list;
      yield* repository.reset;
      const afterReset = yield* repository.snapshot;
      return { afterReset, beforeReset };
    }).pipe(Effect.provide(repository.layer));

    await expect(Effect.runPromise(program)).resolves.toEqual({
      afterReset: [],
      beforeReset: ["hat"],
    });
  });

  it("rebuilds repository initial state for every reset", async () => {
    let seed = 0;
    const repository = createInMemoryRepositoryTestLayer({
      initialState: () => {
        seed += 1;
        return { seed };
      },
      makeRepository: (state) =>
        ProductRepository.of({
          list: Ref.get(state).pipe(
            Effect.map((current) => [`seed_${current.seed}`])
          ),
          put: () => Effect.void,
        }),
      service: ProductRepository,
    });
    const program = Effect.gen(function* () {
      yield* repository.reset;
      const firstReset = yield* repository.snapshot;
      yield* repository.reset;
      const secondReset = yield* repository.snapshot;
      return { firstReset, secondReset };
    }).pipe(Effect.provide(repository.layer));

    await expect(Effect.runPromise(program)).resolves.toEqual({
      firstReset: { seed: 2 },
      secondReset: { seed: 3 },
    });
  });
});
