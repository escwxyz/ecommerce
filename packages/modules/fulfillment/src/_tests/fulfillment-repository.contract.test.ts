import { describe, expect, it } from "bun:test";

import {
  createFulfillmentId,
  createFulfillmentProviderRecordId,
  createFulfillmentSetId,
  createReturnShipmentLinkId,
  createServiceZoneId,
  createShipmentRecordId,
  createShippingOptionId,
  createShippingProfileId,
  type Fulfillment,
  type FulfillmentProviderRecord,
  type FulfillmentRepository,
  type FulfillmentSet,
  type ReturnShipmentLink,
  type ServiceZone,
  type ShipmentRecord,
  type ShippingOption,
  type ShippingProfile,
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

const runFulfillmentRepositoryContract = (
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

      await repository.saveProviderRecord(providerRecord);
      await repository.saveFulfillmentSet(fulfillmentSet);
      await repository.saveShippingProfile(profile);
      await repository.saveServiceZone(zone);
      await repository.saveShippingOption(option);
      await repository.saveFulfillment(fulfillment);
      await repository.saveShipment(shipment);
      await repository.saveReturnShipmentLink(returnLink);

      await expect(
        repository.findFulfillmentSetById(fulfillmentSet.id)
      ).resolves.toEqual(fulfillmentSet);
      await expect(
        repository.findShippingProfileById(profile.id)
      ).resolves.toEqual(profile);
      await expect(repository.findServiceZoneById(zone.id)).resolves.toEqual(
        zone
      );
      await expect(
        repository.findShippingOptionById(option.id)
      ).resolves.toEqual(option);
      await expect(
        repository.findFulfillmentById(fulfillment.id)
      ).resolves.toEqual(fulfillment);
      await expect(
        repository.findFulfillmentByIdempotencyKey("fulfillment_contract")
      ).resolves.toEqual(fulfillment);
      await expect(
        repository.findShipmentByFulfillmentId(fulfillment.id)
      ).resolves.toEqual(shipment);
      await expect(repository.listFulfillments()).resolves.toEqual([
        fulfillment,
      ]);
      await expect(
        repository.listShippingOptions({ countryCode: "US" })
      ).resolves.toEqual([option]);
      await expect(
        repository.listServiceZonesForSet(fulfillmentSet.id)
      ).resolves.toEqual([zone]);
      await expect(
        repository.listShipmentsForFulfillment(fulfillment.id)
      ).resolves.toEqual([shipment]);
    });
  });
};

runFulfillmentRepositoryContract("in-memory fulfillment repository", () =>
  createInMemoryFulfillmentRepository()
);
