import type { StoreId } from "./store.types";

export const STORE_ID_PREFIX = "store_" as const;

export const createStoreId = (value: string): StoreId => {
  if (!value.startsWith(STORE_ID_PREFIX)) {
    throw new Error(`Store id must start with "${STORE_ID_PREFIX}".`);
  }

  return value as StoreId;
};

export const serializeStoreId = (id: StoreId): string => id;
