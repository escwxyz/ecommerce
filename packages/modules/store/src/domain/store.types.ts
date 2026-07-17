import { Context } from "effect";
import type { Effect as EffectValue } from "effect/Effect";

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
  readonly getStoreSettings: EffectValue<StoreSettings | null>;
  readonly saveStoreSettings: (
    settings: StoreSettings
  ) => EffectValue<StoreSettings>;
}

/** Temporary Promise repository bridge for legacy D1 and oRPC paths. */
export interface StoreLegacyRepository {
  getStoreSettings(): Promise<StoreSettings | null>;
  saveStoreSettings(settings: StoreSettings): Promise<StoreSettings>;
}

/** Effect-native store repository contract consumed by store services. */
export const StoreRepositoryService = Context.Service<StoreRepository>(
  "@ecommerce/store/StoreRepositoryService"
);
