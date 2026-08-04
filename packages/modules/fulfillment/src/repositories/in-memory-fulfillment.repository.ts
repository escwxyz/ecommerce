import { Effect, Layer } from "effect";

import type {
  Fulfillment,
  FulfillmentExpectedError,
  FulfillmentId,
  FulfillmentProviderRecord,
  FulfillmentRepository,
  FulfillmentSet,
  FulfillmentSetId,
  ReturnShipmentLink,
  ServiceZone,
  ServiceZoneId,
  ShipmentRecord,
  ShippingOption,
  ShippingOptionId,
  ShippingOptionLookupInput,
  ShippingProfile,
  ShippingProfileId,
} from "../domain";
import { FulfillmentRepositoryService } from "../domain";

export interface ResettableFulfillmentRepository extends FulfillmentRepository {
  readonly clear: Effect.Effect<void>;
}

const sortByCreatedAtDescending = <
  TRecord extends { readonly createdAt: Date },
>(
  records: Iterable<TRecord>
): TRecord[] => {
  const sortedRecords: TRecord[] = [];

  for (const record of records) {
    const recordTimestamp = record.createdAt.getTime();
    let insertAt = 0;

    while (insertAt < sortedRecords.length) {
      const currentRecord = sortedRecords[insertAt];

      if (
        !currentRecord ||
        currentRecord.createdAt.getTime() < recordTimestamp
      ) {
        break;
      }

      insertAt += 1;
    }

    sortedRecords.splice(insertAt, 0, record);
  }

  return sortedRecords;
};

const matchesLookup = (
  option: ShippingOption,
  serviceZone: ServiceZone | undefined,
  input: ShippingOptionLookupInput
): boolean => {
  if (
    input.fulfillmentSetId &&
    option.fulfillmentSetId !== input.fulfillmentSetId
  ) {
    return false;
  }

  if (input.regionId && !serviceZone?.regionIds.includes(input.regionId)) {
    return false;
  }

  if (
    input.countryCode &&
    !serviceZone?.countryCodes.includes(input.countryCode.toUpperCase())
  ) {
    return false;
  }

  return option.isEnabled;
};

export class InMemoryFulfillmentRepository implements ResettableFulfillmentRepository {
  readonly #fulfillmentSets = new Map<string, FulfillmentSet>();
  readonly #fulfillments = new Map<string, Fulfillment>();
  readonly #fulfillmentsByIdempotencyKey = new Map<string, Fulfillment>();
  readonly #providerRecords = new Map<string, FulfillmentProviderRecord>();
  readonly #returnShipmentLinks = new Map<string, ReturnShipmentLink>();
  readonly #serviceZones = new Map<string, ServiceZone>();
  readonly #shipments = new Map<string, ShipmentRecord>();
  readonly #shippingOptions = new Map<string, ShippingOption>();
  readonly #shippingProfiles = new Map<string, ShippingProfile>();

  readonly clear = Effect.sync(() => {
    this.#fulfillmentSets.clear();
    this.#fulfillments.clear();
    this.#fulfillmentsByIdempotencyKey.clear();
    this.#providerRecords.clear();
    this.#returnShipmentLinks.clear();
    this.#serviceZones.clear();
    this.#shipments.clear();
    this.#shippingOptions.clear();
    this.#shippingProfiles.clear();
  });

  readonly findFulfillmentById = (
    id: FulfillmentId
  ): Effect.Effect<Fulfillment | null, FulfillmentExpectedError> =>
    Effect.sync(() => this.#fulfillments.get(id) ?? null);

  readonly findFulfillmentByIdempotencyKey = (
    idempotencyKey: string
  ): Effect.Effect<Fulfillment | null, FulfillmentExpectedError> =>
    Effect.sync(
      () => this.#fulfillmentsByIdempotencyKey.get(idempotencyKey) ?? null
    );

  readonly findFulfillmentSetById = (
    id: FulfillmentSetId
  ): Effect.Effect<FulfillmentSet | null, FulfillmentExpectedError> =>
    Effect.sync(() => this.#fulfillmentSets.get(id) ?? null);

  readonly findServiceZoneById = (
    id: ServiceZoneId
  ): Effect.Effect<ServiceZone | null, FulfillmentExpectedError> =>
    Effect.sync(() => this.#serviceZones.get(id) ?? null);

  readonly findShipmentByFulfillmentId = (
    fulfillmentId: FulfillmentId
  ): Effect.Effect<ShipmentRecord | null, FulfillmentExpectedError> =>
    Effect.sync(() => {
      for (const shipment of this.#shipments.values()) {
        if (shipment.fulfillmentId === fulfillmentId) {
          return shipment;
        }
      }

      return null;
    });

  readonly findShippingOptionById = (
    id: ShippingOptionId
  ): Effect.Effect<ShippingOption | null, FulfillmentExpectedError> =>
    Effect.sync(() => this.#shippingOptions.get(id) ?? null);

  readonly findShippingProfileById = (
    id: ShippingProfileId
  ): Effect.Effect<ShippingProfile | null, FulfillmentExpectedError> =>
    Effect.sync(() => this.#shippingProfiles.get(id) ?? null);

  readonly listFulfillments: Effect.Effect<
    readonly Fulfillment[],
    FulfillmentExpectedError
  > = Effect.sync(() => sortByCreatedAtDescending(this.#fulfillments.values()));

  readonly listServiceZonesForSet = (
    fulfillmentSetId: FulfillmentSetId
  ): Effect.Effect<readonly ServiceZone[], FulfillmentExpectedError> =>
    Effect.sync(() =>
      sortByCreatedAtDescending(
        [...this.#serviceZones.values()].filter(
          (zone) => zone.fulfillmentSetId === fulfillmentSetId
        )
      )
    );

  readonly listShipmentsForFulfillment = (
    fulfillmentId: FulfillmentId
  ): Effect.Effect<readonly ShipmentRecord[], FulfillmentExpectedError> =>
    Effect.sync(() =>
      sortByCreatedAtDescending(
        [...this.#shipments.values()].filter(
          (shipment) => shipment.fulfillmentId === fulfillmentId
        )
      )
    );

  readonly listShippingOptions = (
    input: ShippingOptionLookupInput = {}
  ): Effect.Effect<readonly ShippingOption[], FulfillmentExpectedError> =>
    Effect.sync(() =>
      sortByCreatedAtDescending(
        [...this.#shippingOptions.values()].filter((option) =>
          matchesLookup(
            option,
            this.#serviceZones.get(option.serviceZoneId),
            input
          )
        )
      )
    );

  readonly saveFulfillment = (
    fulfillment: Fulfillment
  ): Effect.Effect<Fulfillment, FulfillmentExpectedError> =>
    Effect.sync(() => {
      this.#fulfillments.set(fulfillment.id, fulfillment);
      this.#fulfillmentsByIdempotencyKey.set(
        fulfillment.idempotencyKey,
        fulfillment
      );
      return fulfillment;
    });

  readonly saveFulfillmentSet = (
    fulfillmentSet: FulfillmentSet
  ): Effect.Effect<FulfillmentSet, FulfillmentExpectedError> =>
    Effect.sync(() => {
      this.#fulfillmentSets.set(fulfillmentSet.id, fulfillmentSet);
      return fulfillmentSet;
    });

  readonly saveProviderRecord = (
    providerRecord: FulfillmentProviderRecord
  ): Effect.Effect<FulfillmentProviderRecord, FulfillmentExpectedError> =>
    Effect.sync(() => {
      this.#providerRecords.set(providerRecord.id, providerRecord);
      return providerRecord;
    });

  readonly saveReturnShipmentLink = (
    link: ReturnShipmentLink
  ): Effect.Effect<ReturnShipmentLink, FulfillmentExpectedError> =>
    Effect.sync(() => {
      this.#returnShipmentLinks.set(link.id, link);
      return link;
    });

  readonly saveServiceZone = (
    serviceZone: ServiceZone
  ): Effect.Effect<ServiceZone, FulfillmentExpectedError> =>
    Effect.sync(() => {
      this.#serviceZones.set(serviceZone.id, serviceZone);
      return serviceZone;
    });

  readonly saveShipment = (
    shipment: ShipmentRecord
  ): Effect.Effect<ShipmentRecord, FulfillmentExpectedError> =>
    Effect.sync(() => {
      this.#shipments.set(shipment.id, shipment);
      return shipment;
    });

  readonly saveShippingOption = (
    shippingOption: ShippingOption
  ): Effect.Effect<ShippingOption, FulfillmentExpectedError> =>
    Effect.sync(() => {
      this.#shippingOptions.set(shippingOption.id, shippingOption);
      return shippingOption;
    });

  readonly saveShippingProfile = (
    shippingProfile: ShippingProfile
  ): Effect.Effect<ShippingProfile, FulfillmentExpectedError> =>
    Effect.sync(() => {
      this.#shippingProfiles.set(shippingProfile.id, shippingProfile);
      return shippingProfile;
    });
}

export const defaultFulfillmentRepository = new InMemoryFulfillmentRepository();

export const createInMemoryFulfillmentRepository = (): FulfillmentRepository =>
  new InMemoryFulfillmentRepository();

export const createResettableInMemoryFulfillmentRepository =
  (): ResettableFulfillmentRepository => new InMemoryFulfillmentRepository();

export const createInMemoryFulfillmentRepositoryLayer = (
  repository: FulfillmentRepository = createInMemoryFulfillmentRepository()
) => Layer.succeed(FulfillmentRepositoryService, repository);

/** Temporary Promise facade until checkout consumes FulfillmentRepository effects directly. */
export const createFulfillmentPromiseRepositoryFromEffectRepository = (
  repository: FulfillmentRepository
) => ({
  findFulfillmentById: (id: FulfillmentId) =>
    Effect.runPromise(repository.findFulfillmentById(id)),
  findFulfillmentByIdempotencyKey: (idempotencyKey: string) =>
    Effect.runPromise(
      repository.findFulfillmentByIdempotencyKey(idempotencyKey)
    ),
  findFulfillmentSetById: (id: FulfillmentSetId) =>
    Effect.runPromise(repository.findFulfillmentSetById(id)),
  findServiceZoneById: (id: ServiceZoneId) =>
    Effect.runPromise(repository.findServiceZoneById(id)),
  findShipmentByFulfillmentId: (fulfillmentId: FulfillmentId) =>
    Effect.runPromise(repository.findShipmentByFulfillmentId(fulfillmentId)),
  findShippingOptionById: (id: ShippingOptionId) =>
    Effect.runPromise(repository.findShippingOptionById(id)),
  findShippingProfileById: (id: ShippingProfileId) =>
    Effect.runPromise(repository.findShippingProfileById(id)),
  listFulfillments: () => Effect.runPromise(repository.listFulfillments),
  listServiceZonesForSet: (fulfillmentSetId: FulfillmentSetId) =>
    Effect.runPromise(repository.listServiceZonesForSet(fulfillmentSetId)),
  listShipmentsForFulfillment: (fulfillmentId: FulfillmentId) =>
    Effect.runPromise(repository.listShipmentsForFulfillment(fulfillmentId)),
  listShippingOptions: (input?: ShippingOptionLookupInput) =>
    Effect.runPromise(repository.listShippingOptions(input)),
  saveFulfillment: (fulfillment: Fulfillment) =>
    Effect.runPromise(repository.saveFulfillment(fulfillment)),
  saveFulfillmentSet: (fulfillmentSet: FulfillmentSet) =>
    Effect.runPromise(repository.saveFulfillmentSet(fulfillmentSet)),
  saveProviderRecord: (providerRecord: FulfillmentProviderRecord) =>
    Effect.runPromise(repository.saveProviderRecord(providerRecord)),
  saveReturnShipmentLink: (link: ReturnShipmentLink) =>
    Effect.runPromise(repository.saveReturnShipmentLink(link)),
  saveServiceZone: (serviceZone: ServiceZone) =>
    Effect.runPromise(repository.saveServiceZone(serviceZone)),
  saveShipment: (shipment: ShipmentRecord) =>
    Effect.runPromise(repository.saveShipment(shipment)),
  saveShippingOption: (shippingOption: ShippingOption) =>
    Effect.runPromise(repository.saveShippingOption(shippingOption)),
  saveShippingProfile: (shippingProfile: ShippingProfile) =>
    Effect.runPromise(repository.saveShippingProfile(shippingProfile)),
});
