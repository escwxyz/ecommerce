import {
  createInMemoryOutbox,
  createInMemoryTransactionBoundary,
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";

import { createInMemoryInventoryActorService } from "../coordination";
import { createResettableInMemoryInventoryRepository } from "../repositories";
import { createInventoryService } from "../services";

export const createTestInventoryService = () => {
  const repository = createResettableInMemoryInventoryRepository();
  const outbox = createInMemoryOutbox();

  return {
    repository,
    service: createInventoryService({
      actorService: createInMemoryInventoryActorService(),
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator([
        "iitem_test",
        "sloc_test",
        "ilvl_test",
        "ires_test",
        "evt_reserved",
        "iadj_test",
        "evt_adjusted",
      ]),
      outboxWriter: outbox.writer,
      repository,
      transactionBoundary: createInMemoryTransactionBoundary({
        resources: [repository, outbox],
      }),
    }),
  };
};
