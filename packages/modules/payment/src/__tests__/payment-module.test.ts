import { describe, expect, it } from "bun:test";

import { paymentModule } from "../index";

describe("payment module", () => {
  it("declares payment events, workflow steps, permissions, and admin metadata without legacy route fragments", () => {
    const { contributions } = paymentModule;

    if (!contributions) {
      throw new Error("Payment module contributions are required.");
    }

    expect(paymentModule.key).toBe("payment");
    expect(paymentModule.schema?.tables).toEqual([]);
    expect(contributions.eventTypes).toContain("payment.authorized");
    expect(contributions.eventTypes).toContain("payment.canceled");
    expect(contributions.workflowSteps?.map((step) => step.name)).toEqual(
      expect.arrayContaining([
        "payment.authorize-session",
        "payment.cancel-authorization",
        "payment.capture",
      ])
    );
    expect(contributions.services?.map(({ key }) => key)).toEqual([
      "payment:service",
    ]);
    expect(contributions.adminSurfaces?.[0]?.label).toBe("Payments");
  });
});
