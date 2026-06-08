import { defineApiContractRoute } from "@ecommerce/module-contracts";
import { z } from "zod";

import {
  CreateProductInputSchema,
  ProductApiListSchema,
  ProductApiRecordSchema,
  ProductIdentifierSchema,
  ProductVariantValidationInputSchema,
  ProductVariantValidationResultSchema,
  UpdateProductCatalogInputSchema,
} from "../domain";

export const productContractRouter = {
  productCreate: defineApiContractRoute({
    description: "Create a draft-capable product record for admin workflows.",
    method: "POST",
    operationId: "productCreate",
    path: "/products",
    successDescription: "Product draft created.",
    summary: "Create product",
    tags: ["Products"],
  })
    .input(CreateProductInputSchema)
    .output(ProductApiRecordSchema),
  productGet: defineApiContractRoute({
    description: "Load a product by identifier for admin detail screens.",
    method: "GET",
    operationId: "productGet",
    path: "/products/{id}",
    successDescription: "Product returned.",
    summary: "Get product",
    tags: ["Products"],
  })
    .input(ProductIdentifierSchema)
    .output(ProductApiRecordSchema.nullable()),
  productCatalogUpdate: defineApiContractRoute({
    description:
      "Update product-owned catalog structure such as variants, options, collections, categories, media, tags, metadata, and publishable/search attributes.",
    method: "PUT",
    operationId: "productCatalogUpdate",
    path: "/products/{id}/catalog",
    successDescription: "Product catalog updated.",
    summary: "Update product catalog",
    tags: ["Products"],
  })
    .input(UpdateProductCatalogInputSchema)
    .output(ProductApiRecordSchema),
  productList: defineApiContractRoute({
    description: "List draft-capable products for admin product management.",
    method: "GET",
    operationId: "productList",
    path: "/products",
    successDescription: "Products returned.",
    summary: "List products",
    tags: ["Products"],
  })
    .input(z.unknown())
    .output(ProductApiListSchema),
  productVariantValidate: defineApiContractRoute({
    description:
      "Validate product and variant catalog identity for downstream cart workflows without exposing product repository internals.",
    method: "POST",
    operationId: "productVariantValidate",
    path: "/products/{productId}/variants/{variantId}/validate",
    successDescription: "Variant validation returned.",
    summary: "Validate product variant",
    tags: ["Products"],
  })
    .input(ProductVariantValidationInputSchema)
    .output(ProductVariantValidationResultSchema),
} as const;
