import { Effect, Schema } from "effect";
import type { Effect as EffectValue } from "effect/Effect";

import { ProductInvalidIdentifier } from "./product.errors";
import { ProductIdSchema } from "./product.schema";
import type { ProductId } from "./product.types";

export const PRODUCT_ID_PREFIX = "prod_";

const toProductInvalidIdentifier = (
  value: string,
  expectedPrefix: string
): ProductInvalidIdentifier =>
  new ProductInvalidIdentifier({
    expectedPrefix,
    value,
  });

export const createProductIdEffect = (
  value: string
): EffectValue<ProductId, ProductInvalidIdentifier> =>
  Schema.decodeUnknownEffect(ProductIdSchema)(value).pipe(
    Effect.mapError(() => toProductInvalidIdentifier(value, PRODUCT_ID_PREFIX))
  );

export const createProductId = (value: string): ProductId =>
  Schema.decodeUnknownSync(ProductIdSchema)(value);

export const serializeProductId = (id: ProductId): string => id;
