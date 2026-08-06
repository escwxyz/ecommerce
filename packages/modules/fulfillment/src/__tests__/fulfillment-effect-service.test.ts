import { describe, expect, it } from "bun:test";

import {
  createEventCollector,
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";
import { Effect } from "effect";

import { createFulfillmentProviderRegistry } from "../providers";
import { createResettableInMemoryFulfillmentRepository } from "../repositories";
import { createFulfillmentService } from "../services";
import { createFakeFulfillmentProvider } from "../testing";

const createShippingOptionFixture = async (
  service: ReturnType<typeof createFulfillmentService>
) => {
  await Effect.runPromise(service.registerProvider("fake"));
  const fulfillmentSet = await Effect.runPromise(
    service.createFulfillmentSet({ name: "Default fulfillment set" })
  );
  const profile = await Effect.runPromise(
    service.createShippingProfile({
      fulfillmentSetId: fulfillmentSet.id,
      name: "Default shipping profile",
    })
  );
  const zone = await Effect.runPromise(
    service.createServiceZone({
      countryCodes: ["us"],
      fulfillmentSetId: fulfillmentSet.id,
      name: "US",
    })
  );

  return Effect.runPromise(
    service.createShippingOption({
      currencyCode: "usd",
      fulfillmentSetId: fulfillmentSet.id,
      name: "Ground",
      priceAmount: 500,
      profileId: profile.id,
      providerKey: "fake",
      providerServiceId: "ground",
      serviceZoneId: zone.id,
    })
  );
};

describe("fulfillment Effect service", () => {
  it("runs shipping option, fulfillment, tracking, and cancel operations through a fake provider", async () => {
    const provider = createFakeFulfillmentProvider();
    const eventCollector = createEventCollector();
    const service = createFulfillmentService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      eventPublisher: eventCollector.publisher,
      idGenerator: createSequenceIdGenerator([
        "fulfprov_fake",
        "fset_default",
        "shprof_default",
        "fzone_us",
        "shipopt_ground",
        "fulf_order_1",
        "ship_order_1",
      ]),
      providerRegistry: createFulfillmentProviderRegistry([provider]),
      repository: createResettableInMemoryFulfillmentRepository(),
    });
    const shippingOption = await createShippingOptionFixture(service);
    const options = await Effect.runPromise(
      service.listShippingOptions({ countryCode: "US" })
    );
    const rate = await Effect.runPromise(
      service.rateShippingOption(shippingOption.id)
    );
    const detail = await Effect.runPromise(
      service.createFulfillment({
        address: { countryCode: "US" },
        idempotencyKey: "fulfillment_1",
        items: [{ lineItemId: "line_1", quantity: 1, sku: "SKU-1" }],
        orderId: "order_1",
        shippingOptionId: shippingOption.id,
      })
    );

    if (!detail.fulfillment.providerFulfillmentId) {
      throw new Error("Expected provider fulfillment ID.");
    }

    provider.setShipment(detail.fulfillment.providerFulfillmentId, {
      carrier: "Fake Carrier",
      providerShipmentId: "fake_shipment_delivered",
      status: "delivered",
      trackingNumber: "TRACK-order_1",
      trackingUrl: "https://fulfillment.example/fake/track/order_1",
    });

    const duplicate = await Effect.runPromise(
      service.createFulfillment({
        address: { countryCode: "US" },
        idempotencyKey: "fulfillment_1",
        items: [{ lineItemId: "line_1", quantity: 1, sku: "SKU-1" }],
        orderId: "order_1",
        shippingOptionId: shippingOption.id,
      })
    );
    const tracked = await Effect.runPromise(
      service.trackShipment({ fulfillmentId: detail.fulfillment.id })
    );
    const canceled = await Effect.runPromise(
      service.cancelFulfillment({
        fulfillmentId: detail.fulfillment.id,
        reason: "customer-request",
      })
    );

    expect(options).toHaveLength(1);
    expect(rate.amount).toBe(500);
    expect(detail.fulfillment.status).toBe("shipped");
    expect(detail.shipments[0]?.trackingNumber).toBe("TRACK-order_1");
    expect(duplicate.fulfillment.id).toBe(detail.fulfillment.id);
    expect(tracked?.status).toBe("delivered");
    expect(canceled.status).toBe("canceled");
    expect(eventCollector.events.map((event) => event.name)).toEqual([
      "fulfillment.set-created",
      "fulfillment.shipping-option-created",
      "fulfillment.created",
      "fulfillment.shipment-tracked",
      "fulfillment.canceled",
    ]);
  });
});
