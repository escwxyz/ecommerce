import {
  createInMemoryOutbox,
  createInMemoryTransactionBoundary,
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";

import { createResettableInMemoryOrderRepository } from "../repositories";
import { createOrderService } from "../services";

export const createTestOrderService = () => {
  const outbox = createInMemoryOutbox();
  const repository = createResettableInMemoryOrderRepository();

  return createOrderService({
    clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
    idGenerator: createSequenceIdGenerator([
      "ord_test",
      "ordli_test",
      "evt_test",
    ]),
    outboxWriter: outbox.writer,
    repository,
    transactionBoundary: createInMemoryTransactionBoundary({
      resources: [repository, outbox],
    }),
  });
};
