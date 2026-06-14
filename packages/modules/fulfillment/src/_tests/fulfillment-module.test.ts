import { describe, expect, it } from "bun:test";

import { call } from "@orpc/server";

import {
  createFulfillmentId,
  createFulfillmentRouteFragment,
  createShippingOptionId,
  fulfillmentModule,
} from "../index";
import { createFulfillmentTestKit } from "../testing";

const createAllowedContext = () =>
  ({
    context: {
      auth: {},
      authorization: {
        evaluatePermission: () => ({ allowed: true as const }),
      },
      session: {
        session: {
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          expiresAt: new Date("2026-01-02T00:00:00.000Z"),
          id: "session_1",
          token: "token_1",
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          userId: "user_1",
        },
        user: {
          banned: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          email: "ada@example.com",
          emailVerified: true,
          id: "user_1",
          name: "Ada Lovelace",
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      },
    },
  }) as const;

const createShippingOptionFixture = async (
  service: ReturnType<typeof createFulfillmentTestKit>["service"]
) => {
  await service.registerProvider("fake");
  const fulfillmentSet = await service.createFulfillmentSet({
    name: "Default fulfillment set",
  });
  const profile = await service.createShippingProfile({
    fulfillmentSetId: fulfillmentSet.id,
    name: "Default shipping profile",
  });
  const zone = await service.createServiceZone({
    countryCodes: ["us"],
    fulfillmentSetId: fulfillmentSet.id,
    name: "US",
  });

  return service.createShippingOption({
    currencyCode: "usd",
    fulfillmentSetId: fulfillmentSet.id,
    name: "Ground",
    priceAmount: 500,
    profileId: profile.id,
    providerKey: "fake",
    providerServiceId: "ground",
    serviceZoneId: zone.id,
  });
};

describe("fulfillment module", () => {
  it("declares fulfillment-owned schema, events, workflow steps, API, and admin metadata", () => {
    const { contributions } = fulfillmentModule;

    if (!contributions) {
      throw new Error("Fulfillment module contributions are required.");
    }

    expect(fulfillmentModule.key).toBe("fulfillment");
    expect(fulfillmentModule.schema?.tables).toContain("shipping_option");
    expect(contributions.eventTypes).toContain("fulfillment.created");
    expect(contributions.workflowSteps?.map((step) => step.name)).toEqual(
      expect.arrayContaining(["fulfillment.create", "fulfillment.cancel"])
    );
    expect(contributions.apiFragments?.[0]?.key).toBe("module:fulfillment");
    expect(contributions.adminSurfaces?.[0]?.label).toBe("Fulfillment");
  });

  it("runs shipping option, fulfillment, tracking, and cancel operations through a fake provider", async () => {
    const { provider, service } = createFulfillmentTestKit();
    const shippingOption = await createShippingOptionFixture(service);
    const options = await service.listShippingOptions({ countryCode: "US" });
    const rate = await service.rateShippingOption(shippingOption.id);
    const detail = await service.createFulfillment({
      address: { countryCode: "US" },
      idempotencyKey: "fulfillment_1",
      items: [{ lineItemId: "line_1", quantity: 1, sku: "SKU-1" }],
      orderId: "order_1",
      shippingOptionId: shippingOption.id,
    });
    const duplicate = await service.createFulfillment({
      address: { countryCode: "US" },
      idempotencyKey: "fulfillment_1",
      items: [{ lineItemId: "line_1", quantity: 1, sku: "SKU-1" }],
      orderId: "order_1",
      shippingOptionId: shippingOption.id,
    });

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

    const tracked = await service.trackShipment({
      fulfillmentId: detail.fulfillment.id,
    });
    const canceled = await service.cancelFulfillment({
      fulfillmentId: detail.fulfillment.id,
      reason: "customer-request",
    });

    expect(options).toHaveLength(1);
    expect(rate.amount).toBe(500);
    expect(detail.fulfillment.status).toBe("shipped");
    expect(detail.shipments[0]?.trackingNumber).toBe("TRACK-order_1");
    expect(duplicate.fulfillment.id).toBe(detail.fulfillment.id);
    expect(tracked?.status).toBe("delivered");
    expect(canceled.status).toBe("canceled");
  });

  it("exposes protected fulfillment API route fragments", async () => {
    const { provider, repository } = createFulfillmentTestKit();
    const fragment = createFulfillmentRouteFragment({
      providerRegistry: {
        getProvider: () => provider,
        listProviders: () => [provider],
      },
      repository,
    });
    const context = createAllowedContext();
    await call(
      fragment.router.fulfillmentProviderRegister,
      { providerKey: "fake" },
      context
    );
    const fulfillmentSet = await call(
      fragment.router.fulfillmentSetCreate,
      { name: "Default fulfillment set" },
      context
    );
    const profile = await call(
      fragment.router.fulfillmentShippingProfileCreate,
      {
        fulfillmentSetId: fulfillmentSet.id,
        name: "Default profile",
      },
      context
    );
    const zone = await call(
      fragment.router.fulfillmentServiceZoneCreate,
      {
        countryCodes: ["US"],
        fulfillmentSetId: fulfillmentSet.id,
        name: "US",
      },
      context
    );
    const option = await call(
      fragment.router.fulfillmentShippingOptionCreate,
      {
        fulfillmentSetId: fulfillmentSet.id,
        name: "Ground",
        profileId: profile.id,
        providerKey: "fake",
        providerServiceId: "ground",
        serviceZoneId: zone.id,
      },
      context
    );
    const detail = await call(
      fragment.router.fulfillmentCreate,
      {
        idempotencyKey: "route_fulfillment",
        items: [{ lineItemId: "line_route", quantity: 1 }],
        orderId: "order_route",
        shippingOptionId: option.id,
      },
      context
    );

    expect(option.id).toStartWith("shipopt_");
    expect(detail.shippingOptionId).toBe(option.id);
    expect(
      await repository.findShippingOptionById(createShippingOptionId(option.id))
    ).not.toBeNull();
    expect(
      await repository.findFulfillmentById(createFulfillmentId(detail.id))
    ).not.toBeNull();
  });
});
