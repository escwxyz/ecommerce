import type {
  StoreApiRecordSchema,
  StoreDefaultsApiRecordSchema,
  StoreDefaultsSchema,
  StoreIdSchema,
  StoreIdentifierSchema,
  StoreSettingsSchema,
  UpdateStoreSettingsInputSchema,
} from "./store.schema";

export type StoreId = typeof StoreIdSchema.Type;
export type StoreIdentifierInput = typeof StoreIdentifierSchema.Type;
export type StoreSettings = typeof StoreSettingsSchema.Type;
export type StoreDefaults = typeof StoreDefaultsSchema.Type;
export type StoreApiRecord = typeof StoreApiRecordSchema.Type;
export type StoreDefaultsApiRecord = typeof StoreDefaultsApiRecordSchema.Type;
export type UpdateStoreSettingsInput =
  typeof UpdateStoreSettingsInputSchema.Type;

export interface StoreRepository {
  getStoreSettings(): Promise<StoreSettings | null>;
  saveStoreSettings(settings: StoreSettings): Promise<StoreSettings>;
}
