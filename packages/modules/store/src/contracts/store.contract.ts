import { z } from "zod";

import {
  StoreApiRecordSchema,
  StoreDefaultsApiRecordSchema,
  UpdateStoreSettingsInputSchema,
} from "../domain";
import { defineApiContractRoute } from "./define-api-contract-route";

export const storeContractRouter = {
  storeDefaultsGet: defineApiContractRoute({
    description: "Resolve store-level defaults for dependent commerce modules.",
    method: "GET",
    operationId: "storeDefaultsGet",
    path: "/store/defaults",
    successDescription: "Store defaults returned.",
    summary: "Get store defaults",
  })
    .input(z.unknown())
    .output(StoreDefaultsApiRecordSchema),
  storeSettingsGet: defineApiContractRoute({
    description: "Load administrative store settings.",
    method: "GET",
    operationId: "storeSettingsGet",
    path: "/store",
    successDescription: "Store settings returned.",
    summary: "Get store settings",
  })
    .input(z.unknown())
    .output(StoreApiRecordSchema),
  storeSettingsUpdate: defineApiContractRoute({
    description:
      "Update store identity, defaults, locale, timezone, and metadata.",
    method: "PATCH",
    operationId: "storeSettingsUpdate",
    path: "/store",
    successDescription: "Store settings updated.",
    summary: "Update store settings",
  })
    .input(UpdateStoreSettingsInputSchema)
    .output(StoreApiRecordSchema),
} as const;
