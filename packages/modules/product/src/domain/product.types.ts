import type { Brand } from "@ecommerce/core/brand";
import type { z } from "zod";

import type {
  CreateProductInputSchema,
  ProductApiRecordSchema,
  ProductIdentifierSchema,
  ProductRecordSchema,
  ProductStatusSchema,
} from "./product.schema";

export type ProductStatus = z.infer<typeof ProductStatusSchema>;
export type ProductId = Brand<string, "product">;
export type CreateProductInput = z.infer<typeof CreateProductInputSchema>;
export type ProductIdentifierInput = z.infer<typeof ProductIdentifierSchema>;
export type ProductRecord = Omit<z.infer<typeof ProductRecordSchema>, "id"> & {
  readonly id: ProductId;
};
export type ProductApiRecord = z.infer<typeof ProductApiRecordSchema>;

export interface ProductRepository {
  findProductByHandle(handle: string): Promise<ProductRecord | null>;
  findProductById(id: ProductId): Promise<ProductRecord | null>;
  listProducts(): Promise<readonly ProductRecord[]>;
  saveProduct(product: ProductRecord): Promise<ProductRecord>;
}
