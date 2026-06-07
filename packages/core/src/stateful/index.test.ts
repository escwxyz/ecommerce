import { describe, expect, it } from "bun:test";

import { defineStatefulCoordinationRequest } from "./index";
import type {
  StatefulCoordinationRequest,
  StatefulCoordinationResult,
  StatefulCoordinator,
} from "./index";

describe("stateful coordination contracts", () => {
  it("preserves operation identity and correlation metadata", async () => {
    const coordinator: StatefulCoordinator = {
      coordinate: async <Input, Output>(
        request: StatefulCoordinationRequest<Input>
      ): Promise<StatefulCoordinationResult<Output>> => ({
        ...request,
        coordinatedAt: new Date("2026-06-06T00:00:00.000Z"),
        duplicate: false,
        output: {
          accepted: true,
        } as Output,
      }),
    };

    const request = defineStatefulCoordinationRequest({
      causationId: "evt_inventory_adjusted",
      coordinatorKey: "inventory:stock-location-1",
      correlationId: "corr_state_1",
      idempotencyKey: "reserve:cart_1:item_1",
      operationName: "inventory.reserve",
      payload: {
        cartId: "cart_1",
        lineItemId: "item_1",
      },
      subject: {
        id: "cart_1",
        type: "cart",
      },
      workflowRunId: "run_checkout_1",
    });

    const result = await coordinator.coordinate(request);

    expect(result).toMatchObject({
      causationId: "evt_inventory_adjusted",
      coordinatorKey: "inventory:stock-location-1",
      correlationId: "corr_state_1",
      duplicate: false,
      idempotencyKey: "reserve:cart_1:item_1",
      operationName: "inventory.reserve",
      output: {
        accepted: true,
      },
      subject: {
        id: "cart_1",
        type: "cart",
      },
      workflowRunId: "run_checkout_1",
    });
  });
});
