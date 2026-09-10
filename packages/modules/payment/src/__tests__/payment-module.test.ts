import { describe, expect, it } from "bun:test";

import {
  clockLayer,
  composeCommerceApplication,
  idGeneratorLayer,
} from "@ecommerce/core";
import {
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";
import { Effect, Layer } from "effect";

import {
  PaymentProviderRegistryService,
  PaymentRepositoryService,
  PaymentService,
  createPaymentProviderRegistry,
  paymentModule,
} from "../index";
import { createFakePaymentProvider } from "../providers/fake-payment-provider";
import { createResettableInMemoryPaymentRepository } from "../repositories";

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
    expect(contributions.permissions?.map(({ key }) => key)).toEqual([
      "payment:read",
      "payment:write",
    ]);
    expect(contributions).not.toHaveProperty("apiFragments");
    expect(contributions.adminSurfaces?.[0]?.label).toBe("Payments");
  });

  it("uses the payment provider registry supplied by host composition", async () => {
    const provider = createFakePaymentProvider({ id: "host-payment" });
    const applicationLayer = composeCommerceApplication({
      modules: [paymentModule] as const,
    }).applicationLayer.pipe(
      Layer.provide(
        Layer.mergeAll(
          clockLayer(createStaticClock(new Date("2026-01-01T00:00:00.000Z"))),
          idGeneratorLayer(createSequenceIdGenerator(["payprov_host"])),
          Layer.succeed(
            PaymentProviderRegistryService,
            createPaymentProviderRegistry([provider])
          ),
          Layer.succeed(
            PaymentRepositoryService,
            createResettableInMemoryPaymentRepository()
          )
        )
      )
    );

    const record = await Effect.runPromise(
      PaymentService.use((service) =>
        service.registerProvider(provider.id)
      ).pipe(Effect.provide(applicationLayer))
    );

    expect(record.providerRecordId).toBe(provider.id);
  });
});
