import { describe, expect, it } from "bun:test";

import { fulfillmentModule } from "../index";

describe("fulfillment module", () => {
  it("declares fulfillment events, workflow steps, permissions, and admin metadata without legacy route fragments", () => {
    const { contributions } = fulfillmentModule;

    if (!contributions) {
      throw new Error("Fulfillment module contributions are required.");
    }

    expect(fulfillmentModule.key).toBe("fulfillment");
    expect(fulfillmentModule.schema).toBeUndefined();
    expect(contributions.eventTypes).toContain("fulfillment.created");
    expect(contributions.workflowSteps?.map((step) => step.name)).toEqual(
      expect.arrayContaining(["fulfillment.create", "fulfillment.cancel"])
    );
    expect(contributions.services?.map(({ key }) => key)).toEqual([
      "fulfillment:service",
    ]);
    expect(contributions.adminSurfaces?.[0]?.label).toBe("Fulfillment");
  });
});
