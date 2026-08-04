import {
  CartService,
  cartPermissions,
  serializeCartAdjustmentId,
  serializeCartId,
  serializeCartLineItemId,
} from "@ecommerce/cart";
import type {
  CartAdjustmentApiRecord,
  CartAdjustmentRecord,
  CartAggregate,
  CartAggregateApiRecord,
  CartApiRecord,
  CartLineItemApiRecord,
  CartLineItemRecord,
  CartRecord,
} from "@ecommerce/cart";
import { Effect } from "effect";
import { HttpApi, HttpApiBuilder } from "effect/unstable/httpapi";

import { cartAdminHttpApiGroup } from "./cart-effect-http-contract";
import {
  defineAdminHttpApiGroupContribution,
  defineEffectHttpApiModuleContribution,
} from "./effect-http-api";
import {
  CurrentEffectHttpRequestContext,
  withEffectHttpPermission,
} from "./effect-http-middleware";
import type { EffectHttpRequestIdentity } from "./effect-http-middleware";

const serializeCart = (cart: CartRecord): CartApiRecord => ({
  billingAddress: cart.billingAddress,
  completedAt: cart.completedAt?.toISOString() ?? null,
  createdAt: cart.createdAt.toISOString(),
  currencyCode: cart.currencyCode,
  customerId: cart.customerId,
  email: cart.email,
  id: serializeCartId(cart.id),
  metadata: cart.metadata,
  paymentCollectionId: cart.paymentCollectionId,
  regionId: cart.regionId,
  salesChannelId: cart.salesChannelId,
  shippingAddress: cart.shippingAddress,
  shippingOptionId: cart.shippingOptionId,
  status: cart.status,
  totals: cart.totals,
  updatedAt: cart.updatedAt.toISOString(),
});

const serializeLineItem = (
  lineItem: CartLineItemRecord
): CartLineItemApiRecord => ({
  cartId: serializeCartId(lineItem.cartId),
  createdAt: lineItem.createdAt.toISOString(),
  id: serializeCartLineItemId(lineItem.id),
  metadata: lineItem.metadata,
  productId: lineItem.productId,
  quantity: lineItem.quantity,
  title: lineItem.title,
  unitPrice: lineItem.unitPrice,
  updatedAt: lineItem.updatedAt.toISOString(),
  variantId: lineItem.variantId,
});

const serializeAdjustment = (
  adjustment: CartAdjustmentRecord
): CartAdjustmentApiRecord => ({
  amount: adjustment.amount,
  cartId: serializeCartId(adjustment.cartId),
  createdAt: adjustment.createdAt.toISOString(),
  id: serializeCartAdjustmentId(adjustment.id),
  lineItemId: adjustment.lineItemId
    ? serializeCartLineItemId(adjustment.lineItemId)
    : null,
  metadata: adjustment.metadata,
  source: adjustment.source,
  type: adjustment.type,
  updatedAt: adjustment.updatedAt.toISOString(),
});

const serializeAggregate = (
  aggregate: CartAggregate
): CartAggregateApiRecord => ({
  adjustments: aggregate.adjustments.map(serializeAdjustment),
  cart: serializeCart(aggregate.cart),
  lineItems: aggregate.lineItems.map(serializeLineItem),
});

const withSuccessEnvelope = <TData>(
  data: TData,
  request: EffectHttpRequestIdentity
) =>
  ({
    data,
    meta: { request },
    success: true,
  }) as const;

const withCurrentRequest = <TData, TError, TRequirements>(
  effect: Effect.Effect<TData, TError, TRequirements>
) =>
  Effect.gen(function* createCartApiSuccessEnvelope() {
    const context = yield* CurrentEffectHttpRequestContext;
    const data = yield* effect;
    return withSuccessEnvelope(data, context.identity);
  });

const cartAdminGroupIdentifier = "cartAdmin";
const cartAdminHttpApi = HttpApi.make("CartAdminApi").add(
  cartAdminHttpApiGroup
);

export const cartAdminHttpApiHandlers = HttpApiBuilder.group(
  cartAdminHttpApi,
  cartAdminGroupIdentifier,
  (handlers) =>
    handlers
      .handle("cartCreate", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            CartService.use((service) =>
              Effect.gen(function* createCartAggregate() {
                const cart = yield* service.createCart(payload);
                const aggregate = yield* service.getCart(cart.id);

                if (!aggregate) {
                  return {
                    adjustments: [],
                    cart,
                    lineItems: [],
                  };
                }

                return aggregate;
              }).pipe(Effect.map(serializeAggregate))
            )
          ),
          cartPermissions.write
        )
      )
      .handle("cartGet", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            CartService.use((service) =>
              service
                .getCart(payload.id)
                .pipe(
                  Effect.map((aggregate) =>
                    aggregate ? serializeAggregate(aggregate) : null
                  )
                )
            )
          ),
          cartPermissions.read
        )
      )
      .handle("cartAddLineItem", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            CartService.use((service) =>
              service.addLineItem(payload).pipe(Effect.map(serializeAggregate))
            )
          ),
          cartPermissions.write
        )
      )
      .handle("cartLineItemUpdate", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            CartService.use((service) =>
              service
                .updateLineItem(payload)
                .pipe(Effect.map(serializeAggregate))
            )
          ),
          cartPermissions.write
        )
      )
      .handle("cartAddressesSet", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            CartService.use((service) =>
              service.setAddresses(payload).pipe(Effect.map(serializeAggregate))
            )
          ),
          cartPermissions.write
        )
      )
      .handle("cartRegionChannelSet", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            CartService.use((service) =>
              service
                .setRegionChannel(payload)
                .pipe(Effect.map(serializeAggregate))
            )
          ),
          cartPermissions.write
        )
      )
      .handle("cartCheckoutReferencesSet", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            CartService.use((service) =>
              service
                .setCheckoutReferences(payload)
                .pipe(Effect.map(serializeAggregate))
            )
          ),
          cartPermissions.write
        )
      )
      .handle("cartAdjustmentApply", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            CartService.use((service) =>
              service
                .applyAdjustment(payload)
                .pipe(Effect.map(serializeAggregate))
            )
          ),
          cartPermissions.write
        )
      )
      .handle("cartTotalsUpdate", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            CartService.use((service) =>
              service.updateTotals(payload).pipe(Effect.map(serializeAggregate))
            )
          ),
          cartPermissions.write
        )
      )
);

export const cartEffectHttpApiContribution =
  defineEffectHttpApiModuleContribution({
    groups: [
      defineAdminHttpApiGroupContribution({
        group: cartAdminHttpApiGroup,
        handlers: cartAdminHttpApiHandlers,
        key: "module:cart.admin",
        owner: "module",
      }),
    ],
    moduleName: "cart",
  });
