import type {
  ClockServiceShape,
  IdGeneratorServiceShape,
} from "@ecommerce/core";
import {
  createEventCollector,
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";

import { createResettableInMemoryTaxRepository } from "../repositories";
import { createTaxService } from "../services";

export interface TaxTestKit {
  readonly clock: ClockServiceShape;
  readonly eventCollector: ReturnType<typeof createEventCollector>;
  readonly idGenerator: IdGeneratorServiceShape;
  readonly repository: ReturnType<typeof createResettableInMemoryTaxRepository>;
  readonly service: ReturnType<typeof createTaxService>;
}

export const createTaxTestKit = (ids: readonly string[] = []): TaxTestKit => {
  const clock = createStaticClock(new Date("2026-01-01T00:00:00.000Z"));
  const eventCollector = createEventCollector();
  const idGenerator = createSequenceIdGenerator(ids);
  const repository = createResettableInMemoryTaxRepository();
  const service = createTaxService({
    clock,
    eventPublisher: eventCollector.publisher,
    idGenerator,
    repository,
  });

  return {
    clock,
    eventCollector,
    idGenerator,
    repository,
    service,
  };
};
