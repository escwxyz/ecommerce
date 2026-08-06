import {
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";

import { createInMemoryCartActorService } from "../coordination";
import { createResettableInMemoryCartRepository } from "../repositories";
import { createCartService } from "../services";

export const createTestCartService = () =>
  createCartService({
    actorService: createInMemoryCartActorService(),
    clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
    idGenerator: createSequenceIdGenerator([
      "cart_1",
      "evt_created",
      "clitem_1",
      "evt_line_item",
      "cadj_1",
      "evt_adjustment",
    ]),
    repository: createResettableInMemoryCartRepository(),
  });
