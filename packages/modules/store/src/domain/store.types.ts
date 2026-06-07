import type { Brand } from "@ecommerce/core/brand";
import type { z } from "zod";

import type {
  StoreApiRecordSchema,
  StoreDefaultsApiRecordSchema,
  StoreDefaultsSchema,
  StoreIdentifierSchema,
  StoreSettingsSchema,
  UpdateStoreSettingsInputSchema,
} from "./store.schema";

export type StoreId = Brand<string, "store">;
export type StoreIdentifierInput = z.infer<typeof StoreIdentifierSchema>;
export type StoreSettings = Omit<z.infer<typeof StoreSettingsSchema>, "id"> & {
  readonly id: StoreId;
};
export type StoreDefaults = z.infer<typeof StoreDefaultsSchema>;
export type StoreApiRecord = z.infer<typeof StoreApiRecordSchema>;
export type StoreDefaultsApiRecord = z.infer<
  typeof StoreDefaultsApiRecordSchema
>;
export type UpdateStoreSettingsInput = z.infer<
  typeof UpdateStoreSettingsInputSchema
>;

export interface StoreRepository {
  getStoreSettings(): Promise<StoreSettings | null>;
  saveStoreSettings(settings: StoreSettings): Promise<StoreSettings>;
}
