import {
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";

import { createInMemoryOrderRepository } from "../repositories";
import { createOrderService } from "../services";

export const createTestOrderService = () =>
  createOrderService({
    clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
    idGenerator: createSequenceIdGenerator([
      "ord_test",
      "ordli_test",
      "evt_test",
    ]),
    repository: createInMemoryOrderRepository(),
  });
