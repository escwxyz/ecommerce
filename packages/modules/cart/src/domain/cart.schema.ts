import { z } from "zod";

const MetadataSchema = z.record(z.string(), z.unknown());
const NullableStringSchema = z.string().min(1).nullable();
const CoordinationMetadataSchema = z.object({
  causationId: z.string().min(1).optional(),
  correlationId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  workflowRunId: z.string().min(1).optional(),
});

export const CartAddressSchema = z.object({
  address1: z.string().min(1),
  address2: z.string().min(1).optional(),
  city: z.string().min(1),
  company: z.string().min(1).optional(),
  countryCode: z
    .string()
    .min(2)
    .max(2)
    .transform((value) => value.toUpperCase()),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  postalCode: z.string().min(1),
  province: z.string().min(1).optional(),
});

export const CartTotalsSnapshotSchema = z.object({
  adjustmentTotal: z.number().int(),
  currencyCode: z
    .string()
    .min(3)
    .max(3)
    .transform((value) => value.toUpperCase()),
  discountTotal: z.number().int().nonnegative(),
  giftCardTotal: z.number().int().nonnegative(),
  itemSubtotal: z.number().int().nonnegative(),
  shippingTotal: z.number().int().nonnegative(),
  subtotal: z.number().int().nonnegative(),
  taxTotal: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

export const CartStatusSchema = z.enum(["active", "completed", "canceled"]);

export const CartRecordSchema = z.object({
  billingAddress: CartAddressSchema.nullable(),
  completedAt: z.date().nullable(),
  createdAt: z.date(),
  currencyCode: z.string().min(3).max(3),
  customerId: NullableStringSchema,
  email: z.string().email().nullable(),
  id: z.string().min(1).startsWith("cart_"),
  metadata: MetadataSchema,
  paymentCollectionId: NullableStringSchema,
  regionId: NullableStringSchema,
  salesChannelId: NullableStringSchema,
  shippingAddress: CartAddressSchema.nullable(),
  shippingOptionId: NullableStringSchema,
  status: CartStatusSchema,
  totals: CartTotalsSnapshotSchema,
  updatedAt: z.date(),
});

export const CartLineItemRecordSchema = z.object({
  cartId: z.string().min(1).startsWith("cart_"),
  createdAt: z.date(),
  id: z.string().min(1).startsWith("clitem_"),
  metadata: MetadataSchema,
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
  title: z.string().min(1),
  unitPrice: z.number().int().nonnegative(),
  updatedAt: z.date(),
  variantId: z.string().min(1),
});

export const CartAdjustmentTypeSchema = z.enum([
  "discount",
  "promotion",
  "shipping",
  "tax",
  "manual",
]);

export const CartAdjustmentRecordSchema = z.object({
  amount: z.number().int(),
  cartId: z.string().min(1).startsWith("cart_"),
  createdAt: z.date(),
  id: z.string().min(1).startsWith("cadj_"),
  lineItemId: z.string().min(1).startsWith("clitem_").nullable(),
  metadata: MetadataSchema,
  source: z.string().min(1),
  type: CartAdjustmentTypeSchema,
  updatedAt: z.date(),
});

export const CartAggregateSchema = z.object({
  adjustments: z.array(CartAdjustmentRecordSchema).readonly(),
  cart: CartRecordSchema,
  lineItems: z.array(CartLineItemRecordSchema).readonly(),
});

export const CreateCartInputSchema = z.object({
  currencyCode: z.string().min(3).max(3),
  customerId: z.string().min(1).optional(),
  email: z.string().email().optional(),
  metadata: MetadataSchema.optional(),
  regionId: z.string().min(1).optional(),
  salesChannelId: z.string().min(1).optional(),
});

export const AddCartLineItemInputSchema = CoordinationMetadataSchema.extend({
  cartId: z.string().min(1).startsWith("cart_"),
  metadata: MetadataSchema.optional(),
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
  title: z.string().min(1),
  unitPrice: z.number().int().nonnegative(),
  variantId: z.string().min(1),
});

export const UpdateCartLineItemInputSchema = CoordinationMetadataSchema.extend({
  cartId: z.string().min(1).startsWith("cart_"),
  lineItemId: z.string().min(1).startsWith("clitem_"),
  quantity: z.number().int().nonnegative(),
});

export const AssociateCartCustomerInputSchema =
  CoordinationMetadataSchema.extend({
    cartId: z.string().min(1).startsWith("cart_"),
    customerId: z.string().min(1).optional(),
    email: z.string().email().optional(),
  });

export const SetCartAddressesInputSchema = CoordinationMetadataSchema.extend({
  billingAddress: CartAddressSchema.optional(),
  cartId: z.string().min(1).startsWith("cart_"),
  shippingAddress: CartAddressSchema.optional(),
});

export const SetCartRegionChannelInputSchema =
  CoordinationMetadataSchema.extend({
    cartId: z.string().min(1).startsWith("cart_"),
    currencyCode: z.string().min(3).max(3).optional(),
    regionId: z.string().min(1).optional(),
    salesChannelId: z.string().min(1).optional(),
  });

export const SetCartCheckoutReferencesInputSchema =
  CoordinationMetadataSchema.extend({
    cartId: z.string().min(1).startsWith("cart_"),
    paymentCollectionId: z.string().min(1).optional(),
    shippingOptionId: z.string().min(1).optional(),
  });

export const ApplyCartAdjustmentInputSchema = CoordinationMetadataSchema.extend(
  {
    amount: z.number().int(),
    cartId: z.string().min(1).startsWith("cart_"),
    lineItemId: z.string().min(1).startsWith("clitem_").optional(),
    metadata: MetadataSchema.optional(),
    source: z.string().min(1),
    type: CartAdjustmentTypeSchema,
  }
);

export const UpdateCartTotalsInputSchema = CoordinationMetadataSchema.extend({
  cartId: z.string().min(1).startsWith("cart_"),
  totals: CartTotalsSnapshotSchema,
});

export const CartIdentifierSchema = z.object({
  id: z.string().min(1).startsWith("cart_"),
});

const ApiDateFields = {
  completedAt: z.string().min(1).nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
} as const;

export const CartApiRecordSchema = CartRecordSchema.extend(ApiDateFields);
export const CartLineItemApiRecordSchema = CartLineItemRecordSchema.extend({
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});
export const CartAdjustmentApiRecordSchema = CartAdjustmentRecordSchema.extend({
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});
export const CartAggregateApiSchema = CartAggregateSchema.extend({
  adjustments: z.array(CartAdjustmentApiRecordSchema).readonly(),
  cart: CartApiRecordSchema,
  lineItems: z.array(CartLineItemApiRecordSchema).readonly(),
});
