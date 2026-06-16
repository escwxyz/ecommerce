import { defineApiContractRoute } from "@ecommerce/module-contracts";

import {
  AddCartLineItemInputSchema,
  ApplyCartAdjustmentInputSchema,
  AssociateCartCustomerInputSchema,
  CartAggregateApiSchema,
  CartApiRecordSchema,
  CartIdentifierSchema,
  CreateCartInputSchema,
  SetCartAddressesInputSchema,
  SetCartCheckoutReferencesInputSchema,
  SetCartRegionChannelInputSchema,
  UpdateCartLineItemInputSchema,
  UpdateCartTotalsInputSchema,
} from "../domain";

export const cartContractRouter = {
  cartAddLineItem: defineApiContractRoute({
    description:
      "Add a cart-owned pre-order line item with idempotency metadata.",
    method: "POST",
    operationId: "cartAddLineItem",
    path: "/carts/{cartId}/line-items",
    successDescription: "Cart line item added.",
    summary: "Add cart line item",
    tags: ["Cart"],
  })
    .input(AddCartLineItemInputSchema)
    .output(CartAggregateApiSchema),
  cartAdjustmentApply: defineApiContractRoute({
    description:
      "Apply a cart-owned adjustment snapshot from promotion, tax, shipping, or manual sources.",
    method: "POST",
    operationId: "cartAdjustmentApply",
    path: "/carts/{cartId}/adjustments",
    successDescription: "Cart adjustment applied.",
    summary: "Apply cart adjustment",
    tags: ["Cart"],
  })
    .input(ApplyCartAdjustmentInputSchema)
    .output(CartAggregateApiSchema),
  cartAssociateCustomer: defineApiContractRoute({
    description: "Associate a customer or email address with a cart.",
    method: "PUT",
    operationId: "cartAssociateCustomer",
    path: "/carts/{cartId}/customer",
    successDescription: "Cart customer association updated.",
    summary: "Associate cart customer",
    tags: ["Cart"],
  })
    .input(AssociateCartCustomerInputSchema)
    .output(CartAggregateApiSchema),
  cartCreate: defineApiContractRoute({
    description: "Create a cart-owned pre-order aggregate.",
    method: "POST",
    operationId: "cartCreate",
    path: "/carts",
    successDescription: "Cart created.",
    summary: "Create cart",
    tags: ["Cart"],
  })
    .input(CreateCartInputSchema)
    .output(CartApiRecordSchema),
  cartGet: defineApiContractRoute({
    description: "Get a cart aggregate with line items and adjustments.",
    method: "GET",
    operationId: "cartGet",
    path: "/carts/{id}",
    successDescription: "Cart returned.",
    summary: "Get cart",
    tags: ["Cart"],
  })
    .input(CartIdentifierSchema)
    .output(CartAggregateApiSchema.nullable()),
  cartLineItemUpdate: defineApiContractRoute({
    description:
      "Update or remove a cart-owned line item through the cart aggregate.",
    method: "PUT",
    operationId: "cartLineItemUpdate",
    path: "/carts/{cartId}/line-items/{lineItemId}",
    successDescription: "Cart line item updated.",
    summary: "Update cart line item",
    tags: ["Cart"],
  })
    .input(UpdateCartLineItemInputSchema)
    .output(CartAggregateApiSchema),
  cartSetAddresses: defineApiContractRoute({
    description: "Set cart-owned billing and shipping address snapshots.",
    method: "PUT",
    operationId: "cartSetAddresses",
    path: "/carts/{cartId}/addresses",
    successDescription: "Cart addresses updated.",
    summary: "Set cart addresses",
    tags: ["Cart"],
  })
    .input(SetCartAddressesInputSchema)
    .output(CartAggregateApiSchema),
  cartSetCheckoutReferences: defineApiContractRoute({
    description:
      "Set selected shipping option and payment collection references without invoking providers.",
    method: "PUT",
    operationId: "cartSetCheckoutReferences",
    path: "/carts/{cartId}/checkout-references",
    successDescription: "Cart checkout references updated.",
    summary: "Set cart checkout references",
    tags: ["Cart"],
  })
    .input(SetCartCheckoutReferencesInputSchema)
    .output(CartAggregateApiSchema),
  cartSetRegionChannel: defineApiContractRoute({
    description: "Set cart region, sales channel, or currency references.",
    method: "PUT",
    operationId: "cartSetRegionChannel",
    path: "/carts/{cartId}/region-channel",
    successDescription: "Cart region and channel updated.",
    summary: "Set cart region and channel",
    tags: ["Cart"],
  })
    .input(SetCartRegionChannelInputSchema)
    .output(CartAggregateApiSchema),
  cartTotalsUpdate: defineApiContractRoute({
    description:
      "Persist a totals snapshot calculated by declared pricing, promotion, tax, and shipping flows.",
    method: "PUT",
    operationId: "cartTotalsUpdate",
    path: "/carts/{cartId}/totals",
    successDescription: "Cart totals snapshot updated.",
    summary: "Update cart totals",
    tags: ["Cart"],
  })
    .input(UpdateCartTotalsInputSchema)
    .output(CartAggregateApiSchema),
} as const;
