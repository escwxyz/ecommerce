import type {
  ClockServiceShape,
  IdGeneratorServiceShape,
} from "@ecommerce/core";
import {
  createInMemoryOutbox,
  createInMemoryTransactionBoundary,
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";

import { manualTaxProvider } from "../providers";
import { createResettableInMemoryTaxRepository } from "../repositories";
import { createTaxService } from "../services";

export interface TaxTestKit {
  readonly clock: ClockServiceShape;
  readonly eventCollector: {
    readonly events: readonly unknown[];
  };
  readonly idGenerator: IdGeneratorServiceShape;
  readonly repository: ReturnType<typeof createResettableInMemoryTaxRepository>;
  readonly service: ReturnType<typeof createTaxService>;
}

export const createTaxTestKit = (ids: readonly string[] = []): TaxTestKit => {
  const clock = createStaticClock(new Date("2026-01-01T00:00:00.000Z"));
  const outbox = createInMemoryOutbox();
  const eventCollector = {
    get events() {
      return outbox.records.map((record) => record.event);
    },
  };
  const idGenerator = createSequenceIdGenerator(ids);
  const repository = createResettableInMemoryTaxRepository();
  const service = createTaxService({
    clock,
    idGenerator,
    outboxWriter: outbox.writer,
    providers: [manualTaxProvider],
    repository,
    transactionBoundary: createInMemoryTransactionBoundary({
      resources: [repository, outbox],
    }),
  });

  return {
    clock,
    eventCollector,
    idGenerator,
    repository,
    service,
  };
};
