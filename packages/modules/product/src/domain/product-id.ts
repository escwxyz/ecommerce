import { brand } from "@ecommerce/core/brand";

import type { ProductId } from "./product.types";

export const PRODUCT_ID_PREFIX = "prod_";

export const createProductId = (value: string): ProductId => {
  if (!value.startsWith(PRODUCT_ID_PREFIX)) {
    throw new Error(`Product ID must start with "${PRODUCT_ID_PREFIX}".`);
  }

  return brand<"product", string>(value);
};

export const serializeProductId = (id: ProductId): string => id;
