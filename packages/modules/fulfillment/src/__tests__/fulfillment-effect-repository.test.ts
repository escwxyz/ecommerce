import { describe, expect, it } from "bun:test";

import { Effect } from "effect";

import {
  createFulfillmentId,
  createFulfillmentProviderRecordId,
  createFulfillmentSetId,
  createReturnShipmentLinkId,
  createServiceZoneId,
  createShipmentRecordId,
  createShippingOptionId,
  createShippingProfileId,
} from "../domain";
import type {
  Fulfillment,
  FulfillmentProviderRecord,
  FulfillmentRepository,
  FulfillmentSet,
  ReturnShipmentLink,
  ServiceZone,
  ShipmentRecord,
  ShippingOption,
  ShippingProfile,
} from "../domain";
import { createInMemoryFulfillmentRepository } from "../repositories";

const now = new Date("2026-01-01T00:00:00.000Z");
const fulfillmentSetId = createFulfillmentSetId("fset_contract");
const profileId = createShippingProfileId("shprof_contract");
const zoneId = createServiceZoneId("fzone_contract");
const optionId = createShippingOptionId("shipopt_contract");
const fulfillmentId = createFulfillmentId("fulf_contract");
const shipmentId = createShipmentRecordId("ship_contract");

const createProviderRecord = (): FulfillmentProviderRecord => ({
  createdAt: now,
  id: createFulfillmentProviderRecordId("fulfprov_contract"),
  isEnabled: true,
  providerKey: "fake",
  providerRecordId: "fake",
  updatedAt: now,
});

const createFulfillmentSet = (): FulfillmentSet => ({
  createdAt: now,
  id: fulfillmentSetId,
  metadata: {},
  name: "Default set",
  updatedAt: now,
});

const createProfile = (): ShippingProfile => ({
  createdAt: now,
  fulfillmentSetId,
  id: profileId,
  metadata: {},
  name: "Default profile",
  updatedAt: now,
});

const createZone = (): ServiceZone => ({
  countryCodes: ["US"],
  createdAt: now,
  fulfillmentSetId,
  id: zoneId,
  metadata: {},
  name: "US",
  regionIds: ["reg_us"],
  updatedAt: now,
});

const createOption = (): ShippingOption => ({
  createdAt: now,
  currencyCode: "USD",
  fulfillmentSetId,
  id: optionId,
  isEnabled: true,
  metadata: {},
  name: "Ground",
  priceAmount: 500,
  profileId,
  providerKey: "fake",
  providerServiceId: "ground",
  serviceZoneId: zoneId,
  updatedAt: now,
});

const createFulfillmentRecord = (): Fulfillment => ({
  createdAt: now,
  id: fulfillmentId,
  idempotencyKey: "fulfillment_contract",
  items: [{ lineItemId: "line_contract", quantity: 1 }],
  metadata: {},
  orderId: "order_contract",
  providerFulfillmentId: "fake_fulfillment_contract",
  providerKey: "fake",
  shippingOptionId: optionId,
  status: "created",
  updatedAt: now,
});

const createShipment = (): ShipmentRecord => ({
  carrier: "Fake Carrier",
  createdAt: now,
  fulfillmentId,
  id: shipmentId,
  metadata: {},
  providerShipmentId: "fake_shipment_contract",
  status: "shipped",
  trackingNumber: "TRACK-contract",
  trackingUrl: "https://fulfillment.example/fake/track/contract",
  updatedAt: now,
});

const createReturnLink = (): ReturnShipmentLink => ({
  createdAt: now,
  fulfillmentId,
  id: createReturnShipmentLinkId("retship_contract"),
  providerReturnId: "fake_return_contract",
  returnId: "return_contract",
  shipmentId,
  updatedAt: now,
});

export const runFulfillmentRepositoryContract = (
  name: string,
  createRepository: () => FulfillmentRepository
) => {
  describe(name, () => {
    it("saves and reads fulfillment-owned records", async () => {
      const repository = createRepository();
      const providerRecord = createProviderRecord();
      const fulfillmentSet = createFulfillmentSet();
      const profile = createProfile();
      const zone = createZone();
      const option = createOption();
      const fulfillment = createFulfillmentRecord();
      const shipment = createShipment();
      const returnLink = createReturnLink();

      await Effect.runPromise(repository.saveProviderRecord(providerRecord));
      await Effect.runPromise(repository.saveFulfillmentSet(fulfillmentSet));
      await Effect.runPromise(repository.saveShippingProfile(profile));
      await Effect.runPromise(repository.saveServiceZone(zone));
      await Effect.runPromise(repository.saveShippingOption(option));
      await Effect.runPromise(repository.saveFulfillment(fulfillment));
      await Effect.runPromise(repository.saveShipment(shipment));
      await Effect.runPromise(repository.saveReturnShipmentLink(returnLink));

      await expect(
        Effect.runPromise(repository.findFulfillmentSetById(fulfillmentSet.id))
      ).resolves.toEqual(fulfillmentSet);
      await expect(
        Effect.runPromise(repository.findShippingProfileById(profile.id))
      ).resolves.toEqual(profile);
      await expect(
        Effect.runPromise(repository.findServiceZoneById(zone.id))
      ).resolves.toEqual(zone);
      await expect(
        Effect.runPromise(repository.findShippingOptionById(option.id))
      ).resolves.toEqual(option);
      await expect(
        Effect.runPromise(repository.findFulfillmentById(fulfillment.id))
      ).resolves.toEqual(fulfillment);
      await expect(
        Effect.runPromise(
          repository.findFulfillmentByIdempotencyKey("fulfillment_contract")
        )
      ).resolves.toEqual(fulfillment);
      await expect(
        Effect.runPromise(
          repository.findShipmentByFulfillmentId(fulfillment.id)
        )
      ).resolves.toEqual(shipment);
      await expect(
        Effect.runPromise(repository.listFulfillments)
      ).resolves.toEqual([fulfillment]);
      await expect(
        Effect.runPromise(repository.listShippingOptions({ countryCode: "US" }))
      ).resolves.toEqual([option]);
      await expect(
        Effect.runPromise(repository.listServiceZonesForSet(fulfillmentSet.id))
      ).resolves.toEqual([zone]);
      await expect(
        Effect.runPromise(
          repository.listShipmentsForFulfillment(fulfillment.id)
        )
      ).resolves.toEqual([shipment]);
    });
  });
};

runFulfillmentRepositoryContract("in-memory fulfillment repository", () =>
  createInMemoryFulfillmentRepository()
);
