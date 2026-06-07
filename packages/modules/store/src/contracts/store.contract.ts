import { defineApiContractRoute } from "@ecommerce/module-contracts";
import { z } from "zod";

import {
  StoreApiRecordSchema,
  StoreDefaultsApiRecordSchema,
  UpdateStoreSettingsInputSchema,
} from "../domain";

export const storeContractRouter = {
  storeDefaultsGet: defineApiContractRoute({
    description: "Resolve store-level defaults for dependent commerce modules.",
    method: "GET",
    operationId: "storeDefaultsGet",
    path: "/store/defaults",
    successDescription: "Store defaults returned.",
    summary: "Get store defaults",
    tags: ["Store"],
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
    tags: ["Store"],
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
    tags: ["Store"],
  })
    .input(UpdateStoreSettingsInputSchema)
    .output(StoreApiRecordSchema),
} as const;
