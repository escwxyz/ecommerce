import { z } from "zod";

export const ProductStatusSchema = z.enum(["draft", "active", "archived"]);

export const CreateProductInputSchema = z.object({
  handle: z.string().min(1),
  status: ProductStatusSchema.optional(),
  title: z.string().min(1),
});

export const ProductIdentifierSchema = z.object({
  id: z.string().min(1).startsWith("prod_"),
});

export const ProductRecordSchema = z.object({
  createdAt: z.date(),
  handle: z.string(),
  id: z.string().min(1).startsWith("prod_"),
  status: ProductStatusSchema,
  title: z.string(),
  updatedAt: z.date(),
});

export const ProductApiRecordSchema = z.object({
  createdAt: z.string().min(1),
  handle: z.string(),
  id: z.string().min(1).startsWith("prod_"),
  status: ProductStatusSchema,
  title: z.string(),
  updatedAt: z.string().min(1),
});

export const ProductApiListSchema = z.array(ProductApiRecordSchema);
