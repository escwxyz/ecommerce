import {
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";

import {
  createResettableInMemoryProductRepository,
  defaultProductRepository,
} from "../repositories";
import { createProductService } from "../services";

export const resetProductState = (): void => {
  defaultProductRepository.clear();
};

export const createTestProductService = () =>
  createProductService({
    clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
    idGenerator: createSequenceIdGenerator(["prod_1", "prod_2"]),
    repository: createResettableInMemoryProductRepository(),
  });
