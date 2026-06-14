import { defineFulfillmentProvider } from "./fulfillment-provider";
import type {
  FulfillmentProvider,
  FulfillmentProviderFulfillment,
  FulfillmentProviderShipment,
} from "./fulfillment-provider";

export interface FakeFulfillmentProviderOptions {
  readonly id?: string;
}

export interface FakeFulfillmentProvider extends FulfillmentProvider {
  setShipment(
    providerFulfillmentId: string,
    shipment: FulfillmentProviderShipment
  ): void;
}

export const createFakeFulfillmentProvider = ({
  id = "fake",
}: FakeFulfillmentProviderOptions = {}): FakeFulfillmentProvider => {
  let nextSequence = 1;
  const shipments = new Map<string, FulfillmentProviderShipment>();
  const nextId = (prefix: string) => {
    const value = `${id}_${prefix}_${nextSequence}`;
    nextSequence += 1;
    return value;
  };

  return defineFulfillmentProvider({
    id,
    cancelFulfillment: (input) => {
      shipments.delete(input.providerFulfillmentId);
      return Promise.resolve();
    },
    createFulfillment: (input): Promise<FulfillmentProviderFulfillment> => {
      const providerFulfillmentId = nextId("fulfillment");
      const shipment: FulfillmentProviderShipment = {
        carrier: "Fake Carrier",
        providerShipmentId: nextId("shipment"),
        status: "shipped",
        trackingNumber: `TRACK-${input.orderId}`,
        trackingUrl: `https://fulfillment.example/${id}/track/${input.orderId}`,
      };
      shipments.set(providerFulfillmentId, shipment);

      return Promise.resolve({
        providerFulfillmentId,
        shipment,
        status: "shipped",
      });
    },
    rate: (input) =>
      Promise.resolve({
        amount: {
          amount: input.items?.length ? input.items.length * 500 : 500,
          currencyCode: "USD",
        },
        providerKey: id,
        providerServiceId: input.providerServiceId,
      }),
    setShipment: (providerFulfillmentId, shipment) => {
      shipments.set(providerFulfillmentId, shipment);
    },
    trackShipment: (input) =>
      Promise.resolve(shipments.get(input.providerFulfillmentId) ?? null),
    validateOption: () => Promise.resolve({ valid: true }),
  });
};
