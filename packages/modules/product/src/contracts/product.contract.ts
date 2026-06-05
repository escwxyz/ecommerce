import { z } from "zod";

import {
  CreateProductInputSchema,
  ProductApiListSchema,
  ProductApiRecordSchema,
  ProductIdentifierSchema,
} from "../domain";
import { defineApiContractRoute } from "./define-api-contract-route";

export const productContractRouter = {
  productCreate: defineApiContractRoute({
    description: "Create a draft-capable product record for admin workflows.",
    method: "POST",
    operationId: "productCreate",
    path: "/products",
    successDescription: "Product draft created.",
    summary: "Create product",
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
  })
    .input(ProductIdentifierSchema)
    .output(ProductApiRecordSchema.nullable()),
  productList: defineApiContractRoute({
    description: "List draft-capable products for admin product management.",
    method: "GET",
    operationId: "productList",
    path: "/products",
    successDescription: "Products returned.",
    summary: "List products",
  })
    .input(z.unknown())
    .output(ProductApiListSchema),
} as const;
