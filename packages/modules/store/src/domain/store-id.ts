import { StoreInvalidIdentifier } from "./store.errors";
import { StoreIdSchema } from "./store.schema";
import type { StoreId } from "./store.types";

export const STORE_ID_PREFIX = "store_" as const;

export const createStoreId = (value: string): StoreId => {
  if (!value.startsWith(STORE_ID_PREFIX)) {
    throw new StoreInvalidIdentifier({
      expectedPrefix: STORE_ID_PREFIX,
      value,
    });
  }

  return StoreIdSchema.make(value);
};

export const serializeStoreId = (id: StoreId): string => id;
