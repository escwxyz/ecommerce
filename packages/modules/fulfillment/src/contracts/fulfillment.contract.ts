import { defineApiContractRoute } from "@ecommerce/module-contracts";
import { z } from "zod";

import {
  CancelFulfillmentInputSchema,
  CreateFulfillmentInputSchema,
  CreateFulfillmentSetInputSchema,
  CreateServiceZoneInputSchema,
  CreateShippingOptionInputSchema,
  CreateShippingProfileInputSchema,
  FulfillmentApiSchema,
  FulfillmentDetailApiSchema,
  FulfillmentListApiSchema,
  FulfillmentProviderApiRecordSchema,
  ServiceZoneApiSchema,
  ShipmentRecordApiSchema,
  ShippingOptionApiSchema,
  ShippingOptionListApiSchema,
  ShippingOptionLookupInputSchema,
  ShippingOptionRateApiSchema,
  ShippingProfileApiSchema,
  FulfillmentSetApiSchema,
} from "../domain";

export const FulfillmentIdentifierSchema = z.object({
  id: z.string().min(1).startsWith("fulf_"),
});

export const ShippingOptionIdentifierSchema = z.object({
  id: z.string().min(1).startsWith("shipopt_"),
});

export const FulfillmentProviderIdentifierSchema = z.object({
  providerKey: z.string().min(1),
});

export const fulfillmentContractRouter = {
  fulfillmentCancel: defineApiContractRoute({
    description: "Cancel a provider-backed fulfillment.",
    method: "POST",
    operationId: "fulfillmentCancel",
    path: "/fulfillment/fulfillments/{fulfillmentId}/cancel",
    successDescription: "Fulfillment canceled.",
    summary: "Cancel fulfillment",
    tags: ["Fulfillment"],
  })
    .input(CancelFulfillmentInputSchema)
    .output(FulfillmentApiSchema),
  fulfillmentCreate: defineApiContractRoute({
    description:
      "Create a fulfillment through a shipping option's configured provider.",
    method: "POST",
    operationId: "fulfillmentCreate",
    path: "/fulfillment/fulfillments",
    successDescription: "Fulfillment created.",
    summary: "Create fulfillment",
    tags: ["Fulfillment"],
  })
    .input(CreateFulfillmentInputSchema)
    .output(FulfillmentDetailApiSchema),
  fulfillmentGet: defineApiContractRoute({
    description: "Load a fulfillment with shipment records.",
    method: "GET",
    operationId: "fulfillmentGet",
    path: "/fulfillment/fulfillments/{id}",
    successDescription: "Fulfillment returned.",
    summary: "Get fulfillment",
    tags: ["Fulfillment"],
  })
    .input(FulfillmentIdentifierSchema)
    .output(FulfillmentDetailApiSchema.nullable()),
  fulfillmentList: defineApiContractRoute({
    description: "List fulfillments for admin fulfillment management.",
    method: "GET",
    operationId: "fulfillmentList",
    path: "/fulfillment/fulfillments",
    successDescription: "Fulfillments returned.",
    summary: "List fulfillments",
    tags: ["Fulfillment"],
  })
    .input(z.unknown())
    .output(FulfillmentListApiSchema),
  fulfillmentProviderRegister: defineApiContractRoute({
    description: "Register a replaceable fulfillment provider.",
    method: "POST",
    operationId: "fulfillmentProviderRegister",
    path: "/fulfillment/providers/{providerKey}/register",
    successDescription: "Fulfillment provider registered.",
    summary: "Register fulfillment provider",
    tags: ["Fulfillment"],
  })
    .input(FulfillmentProviderIdentifierSchema)
    .output(FulfillmentProviderApiRecordSchema),
  fulfillmentServiceZoneCreate: defineApiContractRoute({
    description: "Create a fulfillment service zone.",
    method: "POST",
    operationId: "fulfillmentServiceZoneCreate",
    path: "/fulfillment/service-zones",
    successDescription: "Service zone created.",
    summary: "Create service zone",
    tags: ["Fulfillment"],
  })
    .input(CreateServiceZoneInputSchema)
    .output(ServiceZoneApiSchema),
  fulfillmentSetCreate: defineApiContractRoute({
    description: "Create a fulfillment set.",
    method: "POST",
    operationId: "fulfillmentSetCreate",
    path: "/fulfillment/sets",
    successDescription: "Fulfillment set created.",
    summary: "Create fulfillment set",
    tags: ["Fulfillment"],
  })
    .input(CreateFulfillmentSetInputSchema)
    .output(FulfillmentSetApiSchema),
  fulfillmentShippingOptionCreate: defineApiContractRoute({
    description: "Create a provider-backed shipping option.",
    method: "POST",
    operationId: "fulfillmentShippingOptionCreate",
    path: "/fulfillment/shipping-options",
    successDescription: "Shipping option created.",
    summary: "Create shipping option",
    tags: ["Fulfillment"],
  })
    .input(CreateShippingOptionInputSchema)
    .output(ShippingOptionApiSchema),
  fulfillmentShippingOptionList: defineApiContractRoute({
    description:
      "List shipping options by fulfillment set, region, or destination country.",
    method: "GET",
    operationId: "fulfillmentShippingOptionList",
    path: "/fulfillment/shipping-options",
    successDescription: "Shipping options returned.",
    summary: "List shipping options",
    tags: ["Fulfillment"],
  })
    .input(ShippingOptionLookupInputSchema)
    .output(ShippingOptionListApiSchema),
  fulfillmentShippingOptionRate: defineApiContractRoute({
    description: "Rate a shipping option through its configured provider.",
    method: "POST",
    operationId: "fulfillmentShippingOptionRate",
    path: "/fulfillment/shipping-options/{id}/rate",
    successDescription: "Shipping option rate returned.",
    summary: "Rate shipping option",
    tags: ["Fulfillment"],
  })
    .input(ShippingOptionIdentifierSchema)
    .output(ShippingOptionRateApiSchema),
  fulfillmentShippingProfileCreate: defineApiContractRoute({
    description: "Create a shipping profile inside a fulfillment set.",
    method: "POST",
    operationId: "fulfillmentShippingProfileCreate",
    path: "/fulfillment/shipping-profiles",
    successDescription: "Shipping profile created.",
    summary: "Create shipping profile",
    tags: ["Fulfillment"],
  })
    .input(CreateShippingProfileInputSchema)
    .output(ShippingProfileApiSchema),
  fulfillmentTrackShipment: defineApiContractRoute({
    description: "Refresh shipment tracking through the fulfillment provider.",
    method: "POST",
    operationId: "fulfillmentTrackShipment",
    path: "/fulfillment/fulfillments/{fulfillmentId}/track",
    successDescription: "Shipment tracking returned.",
    summary: "Track shipment",
    tags: ["Fulfillment"],
  })
    .input(z.object({ fulfillmentId: z.string().min(1).startsWith("fulf_") }))
    .output(ShipmentRecordApiSchema.nullable()),
} as const;
