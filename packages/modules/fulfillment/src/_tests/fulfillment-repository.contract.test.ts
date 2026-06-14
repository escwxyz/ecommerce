import { Database, type SQLQueryBindings } from "bun:sqlite";
import { afterEach, describe, expect, it } from "bun:test";

import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";

import { createD1FulfillmentRepository } from "../adapters/d1";
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
  type FulfillmentDatabase,
  type FulfillmentProviderRecord,
  type FulfillmentRepository,
  type FulfillmentSet,
  type ReturnShipmentLink,
  type ServiceZone,
  type ShipmentRecord,
  type ShippingOption,
  type ShippingProfile,
  fulfillmentMigration,
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
  createContext: () =>
    | FulfillmentRepository
    | {
        readonly cleanup?: () => void;
        readonly repository: FulfillmentRepository;
      }
    | Promise<{
        readonly cleanup?: () => void;
        readonly repository: FulfillmentRepository;
      }>
) => {
  describe(name, () => {
    let cleanup: (() => void) | undefined;

    afterEach(() => {
      cleanup?.();
      cleanup = undefined;
    });

    const setup = async () => {
      const context = await createContext();

      if ("repository" in context) {
        cleanup = context.cleanup;
        return context.repository;
      }

      return context;
    };

    it("saves and reads fulfillment-owned records", async () => {
      const repository = await setup();
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

const createFakeD1Binding = (sqlite: Database) => ({
  batch: async (statements: readonly FakeD1PreparedStatement[]) =>
    Promise.all(statements.map((statement) => statement.all())),
  exec: async (query: string) => {
    sqlite.exec(query);
    return { count: 0, duration: 0 };
  },
  prepare: (query: string) => new FakeD1PreparedStatement(sqlite, query),
});

type FakeD1Binding = ConstructorParameters<typeof D1Dialect>[0]["database"];

const createKyselyD1FulfillmentDatabase = (sqlite: Database) =>
  new Kysely<FulfillmentDatabase>({
    dialect: new D1Dialect({
      database: createFakeD1Binding(sqlite) as unknown as FakeD1Binding,
    }),
  });

class FakeD1PreparedStatement {
  readonly #query: string;
  readonly #sqlite: Database;
  readonly #values: readonly SQLQueryBindings[];

  constructor(
    sqlite: Database,
    query: string,
    values: readonly SQLQueryBindings[] = []
  ) {
    this.#query = query;
    this.#sqlite = sqlite;
    this.#values = values;
  }

  bind(...values: readonly SQLQueryBindings[]): FakeD1PreparedStatement {
    return new FakeD1PreparedStatement(this.#sqlite, this.#query, values);
  }

  all() {
    const normalizedQuery = this.#query.trim().toLowerCase();
    const statement = this.#sqlite.query(this.#query);

    if (
      normalizedQuery.startsWith("select") ||
      normalizedQuery.startsWith("pragma")
    ) {
      return Promise.resolve({
        meta: { changes: 0, last_row_id: 0 },
        results: statement.all(...this.#values),
        success: true,
      });
    }

    const result = statement.run(...this.#values);
    return Promise.resolve({
      meta: {
        changes: result.changes,
        last_row_id: Number(result.lastInsertRowid),
      },
      results: [],
      success: true,
    });
  }
}

runFulfillmentRepositoryContract("D1 fulfillment repository", async () => {
  const sqlite = new Database(":memory:");
  const db = createKyselyD1FulfillmentDatabase(sqlite);
  await fulfillmentMigration.up(db);

  return {
    cleanup: () => {
      void db.destroy();
      sqlite.close();
    },
    repository: createD1FulfillmentRepository({ db }),
  };
});
