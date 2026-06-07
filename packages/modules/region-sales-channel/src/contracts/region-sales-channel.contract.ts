import { defineApiContractRoute } from "@ecommerce/module-contracts";
import { z } from "zod";

import {
  CheckPublishabilityInputSchema,
  CreateRegionInputSchema,
  CreateSalesChannelInputSchema,
  PublishProductInputSchema,
  RegionApiListSchema,
  RegionApiRecordSchema,
  RegionIdentifierSchema,
  SalesChannelApiListSchema,
  SalesChannelApiRecordSchema,
  SalesChannelIdentifierSchema,
  ValidateRegionInputSchema,
} from "../domain";

const RegionValidationApiResultSchema = z.object({
  allowed: z.boolean(),
  reasons: z.array(z.string()),
});

const SalesChannelPublishabilityApiResultSchema = z.object({
  publishable: z.boolean(),
  reasons: z.array(z.string()),
});

export const regionSalesChannelContractRouter = {
  regionCreate: defineApiContractRoute({
    description:
      "Create a region with currency, country, tax, payment, and fulfillment availability references.",
    method: "POST",
    operationId: "regionCreate",
    path: "/regions",
    successDescription: "Region created.",
    summary: "Create region",
    tags: ["Regions"],
  })
    .input(CreateRegionInputSchema)
    .output(RegionApiRecordSchema),
  regionGet: defineApiContractRoute({
    description: "Load a region by identifier for admin and module validation.",
    method: "GET",
    operationId: "regionGet",
    path: "/regions/{id}",
    successDescription: "Region returned.",
    summary: "Get region",
    tags: ["Regions"],
  })
    .input(RegionIdentifierSchema)
    .output(RegionApiRecordSchema.nullable()),
  regionList: defineApiContractRoute({
    description: "List regions and their market constraint references.",
    method: "GET",
    operationId: "regionList",
    path: "/regions",
    successDescription: "Regions returned.",
    summary: "List regions",
    tags: ["Regions"],
  })
    .input(z.unknown())
    .output(RegionApiListSchema),
  regionValidate: defineApiContractRoute({
    description:
      "Validate currency, country, payment, and fulfillment inputs against a region.",
    method: "POST",
    operationId: "regionValidate",
    path: "/regions/validate",
    successDescription: "Region constraints validated.",
    summary: "Validate region constraints",
    tags: ["Regions"],
  })
    .input(ValidateRegionInputSchema)
    .output(RegionValidationApiResultSchema),
  salesChannelCreate: defineApiContractRoute({
    description:
      "Create a sales channel that owns storefront publishability scope.",
    method: "POST",
    operationId: "salesChannelCreate",
    path: "/sales-channels",
    successDescription: "Sales channel created.",
    summary: "Create sales channel",
    tags: ["Sales channels"],
  })
    .input(CreateSalesChannelInputSchema)
    .output(SalesChannelApiRecordSchema),
  salesChannelGet: defineApiContractRoute({
    description: "Load a sales channel by identifier.",
    method: "GET",
    operationId: "salesChannelGet",
    path: "/sales-channels/{id}",
    successDescription: "Sales channel returned.",
    summary: "Get sales channel",
    tags: ["Sales channels"],
  })
    .input(SalesChannelIdentifierSchema)
    .output(SalesChannelApiRecordSchema.nullable()),
  salesChannelList: defineApiContractRoute({
    description: "List sales channels and their published product scopes.",
    method: "GET",
    operationId: "salesChannelList",
    path: "/sales-channels",
    successDescription: "Sales channels returned.",
    summary: "List sales channels",
    tags: ["Sales channels"],
  })
    .input(z.unknown())
    .output(SalesChannelApiListSchema),
  salesChannelProductPublish: defineApiContractRoute({
    description: "Publish a product into a sales-channel availability scope.",
    method: "POST",
    operationId: "salesChannelProductPublish",
    path: "/sales-channels/products",
    successDescription: "Product published to sales channel.",
    summary: "Publish product to sales channel",
    tags: ["Sales channels"],
  })
    .input(PublishProductInputSchema)
    .output(SalesChannelApiRecordSchema),
  salesChannelPublishabilityCheck: defineApiContractRoute({
    description:
      "Check whether a product is available in an active sales channel.",
    method: "POST",
    operationId: "salesChannelPublishabilityCheck",
    path: "/sales-channels/publishability",
    successDescription: "Sales-channel publishability checked.",
    summary: "Check sales-channel publishability",
    tags: ["Sales channels"],
  })
    .input(CheckPublishabilityInputSchema)
    .output(SalesChannelPublishabilityApiResultSchema),
} as const;
