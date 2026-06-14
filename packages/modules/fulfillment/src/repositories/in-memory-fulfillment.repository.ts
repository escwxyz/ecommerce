import type {
  Fulfillment,
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

export interface ResettableFulfillmentRepository extends FulfillmentRepository {
  clear(): void;
}

const sortByCreatedAtDesc = <Record extends { readonly createdAt: Date }>(
  records: Iterable<Record>
): Record[] => {
  const sorted: Record[] = [];

  for (const record of records) {
    const timestamp = record.createdAt.getTime();
    let insertAt = 0;

    while (insertAt < sorted.length) {
      const current = sorted[insertAt];

      if (!current || current.createdAt.getTime() < timestamp) {
        break;
      }

      insertAt += 1;
    }

    sorted.splice(insertAt, 0, record);
  }

  return sorted;
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

  clear(): void {
    this.#fulfillmentSets.clear();
    this.#fulfillments.clear();
    this.#fulfillmentsByIdempotencyKey.clear();
    this.#providerRecords.clear();
    this.#returnShipmentLinks.clear();
    this.#serviceZones.clear();
    this.#shipments.clear();
    this.#shippingOptions.clear();
    this.#shippingProfiles.clear();
  }

  findFulfillmentById(id: FulfillmentId): Promise<Fulfillment | null> {
    return Promise.resolve(this.#fulfillments.get(id) ?? null);
  }

  findFulfillmentByIdempotencyKey(
    idempotencyKey: string
  ): Promise<Fulfillment | null> {
    return Promise.resolve(
      this.#fulfillmentsByIdempotencyKey.get(idempotencyKey) ?? null
    );
  }

  findFulfillmentSetById(id: FulfillmentSetId): Promise<FulfillmentSet | null> {
    return Promise.resolve(this.#fulfillmentSets.get(id) ?? null);
  }

  findServiceZoneById(id: ServiceZoneId): Promise<ServiceZone | null> {
    return Promise.resolve(this.#serviceZones.get(id) ?? null);
  }

  findShipmentByFulfillmentId(
    fulfillmentId: FulfillmentId
  ): Promise<ShipmentRecord | null> {
    for (const shipment of this.#shipments.values()) {
      if (shipment.fulfillmentId === fulfillmentId) {
        return Promise.resolve(shipment);
      }
    }

    return Promise.resolve(null);
  }

  findShippingOptionById(id: ShippingOptionId): Promise<ShippingOption | null> {
    return Promise.resolve(this.#shippingOptions.get(id) ?? null);
  }

  findShippingProfileById(
    id: ShippingProfileId
  ): Promise<ShippingProfile | null> {
    return Promise.resolve(this.#shippingProfiles.get(id) ?? null);
  }

  listFulfillments(): Promise<readonly Fulfillment[]> {
    return Promise.resolve(sortByCreatedAtDesc(this.#fulfillments.values()));
  }

  listServiceZonesForSet(
    fulfillmentSetId: FulfillmentSetId
  ): Promise<readonly ServiceZone[]> {
    const zones = [...this.#serviceZones.values()].filter(
      (zone) => zone.fulfillmentSetId === fulfillmentSetId
    );

    return Promise.resolve(sortByCreatedAtDesc(zones));
  }

  listShipmentsForFulfillment(
    fulfillmentId: FulfillmentId
  ): Promise<readonly ShipmentRecord[]> {
    const shipments = [...this.#shipments.values()].filter(
      (shipment) => shipment.fulfillmentId === fulfillmentId
    );

    return Promise.resolve(sortByCreatedAtDesc(shipments));
  }

  listShippingOptions(
    input: ShippingOptionLookupInput = {}
  ): Promise<readonly ShippingOption[]> {
    const options = [...this.#shippingOptions.values()].filter((option) =>
      matchesLookup(option, this.#serviceZones.get(option.serviceZoneId), input)
    );

    return Promise.resolve(sortByCreatedAtDesc(options));
  }

  saveFulfillment(fulfillment: Fulfillment): Promise<Fulfillment> {
    this.#fulfillments.set(fulfillment.id, fulfillment);
    this.#fulfillmentsByIdempotencyKey.set(
      fulfillment.idempotencyKey,
      fulfillment
    );
    return Promise.resolve(fulfillment);
  }

  saveFulfillmentSet(fulfillmentSet: FulfillmentSet): Promise<FulfillmentSet> {
    this.#fulfillmentSets.set(fulfillmentSet.id, fulfillmentSet);
    return Promise.resolve(fulfillmentSet);
  }

  saveProviderRecord(
    providerRecord: FulfillmentProviderRecord
  ): Promise<FulfillmentProviderRecord> {
    this.#providerRecords.set(providerRecord.id, providerRecord);
    return Promise.resolve(providerRecord);
  }

  saveReturnShipmentLink(
    link: ReturnShipmentLink
  ): Promise<ReturnShipmentLink> {
    this.#returnShipmentLinks.set(link.id, link);
    return Promise.resolve(link);
  }

  saveServiceZone(serviceZone: ServiceZone): Promise<ServiceZone> {
    this.#serviceZones.set(serviceZone.id, serviceZone);
    return Promise.resolve(serviceZone);
  }

  saveShipment(shipment: ShipmentRecord): Promise<ShipmentRecord> {
    this.#shipments.set(shipment.id, shipment);
    return Promise.resolve(shipment);
  }

  saveShippingOption(shippingOption: ShippingOption): Promise<ShippingOption> {
    this.#shippingOptions.set(shippingOption.id, shippingOption);
    return Promise.resolve(shippingOption);
  }

  saveShippingProfile(
    shippingProfile: ShippingProfile
  ): Promise<ShippingProfile> {
    this.#shippingProfiles.set(shippingProfile.id, shippingProfile);
    return Promise.resolve(shippingProfile);
  }
}

export const defaultFulfillmentRepository = new InMemoryFulfillmentRepository();

export const createInMemoryFulfillmentRepository = (): FulfillmentRepository =>
  new InMemoryFulfillmentRepository();

export const createResettableInMemoryFulfillmentRepository =
  (): ResettableFulfillmentRepository => new InMemoryFulfillmentRepository();
