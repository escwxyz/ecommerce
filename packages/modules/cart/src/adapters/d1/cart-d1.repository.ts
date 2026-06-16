import type { Kysely } from "kysely";

import type {
  CartAdjustmentRecord,
  CartAdjustmentRow,
  CartDatabase,
  CartLineItemRecord,
  CartLineItemRow,
  CartRepository,
  CartRecord,
  CartRow,
} from "../../domain";
import {
  createCartAdjustmentId,
  createCartId,
  createCartLineItemId,
} from "../../domain";

export type CartD1Database = Kysely<CartDatabase>;

export interface CreateD1CartRepositoryOptions {
  readonly db: CartD1Database;
}

const parseJsonColumn = <Value>(value: string): Value => JSON.parse(value);
const toJsonColumn = (value: unknown): string => JSON.stringify(value);

const toCartRecord = (row: CartRow): CartRecord => ({
  billingAddress: row.billing_address_json
    ? parseJsonColumn(row.billing_address_json)
    : null,
  completedAt: row.completed_at === null ? null : new Date(row.completed_at),
  createdAt: new Date(row.created_at),
  currencyCode: row.currency_code,
  customerId: row.customer_id,
  email: row.email,
  id: createCartId(row.id),
  metadata: parseJsonColumn(row.metadata_json),
  paymentCollectionId: row.payment_collection_id,
  regionId: row.region_id,
  salesChannelId: row.sales_channel_id,
  shippingAddress: row.shipping_address_json
    ? parseJsonColumn(row.shipping_address_json)
    : null,
  shippingOptionId: row.shipping_option_id,
  status: row.status as CartRecord["status"],
  totals: parseJsonColumn(row.totals_json),
  updatedAt: new Date(row.updated_at),
});

const toLineItemRecord = (row: CartLineItemRow): CartLineItemRecord => ({
  cartId: createCartId(row.cart_id),
  createdAt: new Date(row.created_at),
  id: createCartLineItemId(row.id),
  metadata: parseJsonColumn(row.metadata_json),
  productId: row.product_id,
  quantity: row.quantity,
  title: row.title,
  unitPrice: row.unit_price,
  updatedAt: new Date(row.updated_at),
  variantId: row.variant_id,
});

const toAdjustmentRecord = (row: CartAdjustmentRow): CartAdjustmentRecord => ({
  amount: row.amount,
  cartId: createCartId(row.cart_id),
  createdAt: new Date(row.created_at),
  id: createCartAdjustmentId(row.id),
  lineItemId: row.line_item_id ? createCartLineItemId(row.line_item_id) : null,
  metadata: parseJsonColumn(row.metadata_json),
  source: row.source,
  type: row.type as CartAdjustmentRecord["type"],
  updatedAt: new Date(row.updated_at),
});

export const createD1CartRepository = ({
  db,
}: CreateD1CartRepositoryOptions): CartRepository => ({
  findAdjustmentByIdempotencyKey: async (idempotencyKey) => {
    const row = await db
      .selectFrom("cart_adjustment")
      .selectAll()
      .where("idempotency_key", "=", idempotencyKey)
      .executeTakeFirst();

    return row ? toAdjustmentRecord(row) : null;
  },
  findCartById: async (id) => {
    const row = await db
      .selectFrom("cart")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return row ? toCartRecord(row) : null;
  },
  findLineItemById: async (id) => {
    const row = await db
      .selectFrom("cart_line_item")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return row ? toLineItemRecord(row) : null;
  },
  findLineItemByIdempotencyKey: async (idempotencyKey) => {
    const row = await db
      .selectFrom("cart_line_item")
      .selectAll()
      .where("idempotency_key", "=", idempotencyKey)
      .executeTakeFirst();

    return row ? toLineItemRecord(row) : null;
  },
  getCartAggregate: async (id) => {
    const cart = await createD1CartRepository({ db }).findCartById(id);

    if (!cart) {
      return null;
    }

    const [lineItemRows, adjustmentRows] = await Promise.all([
      db
        .selectFrom("cart_line_item")
        .selectAll()
        .where("cart_id", "=", id)
        .orderBy("created_at", "desc")
        .execute(),
      db
        .selectFrom("cart_adjustment")
        .selectAll()
        .where("cart_id", "=", id)
        .orderBy("created_at", "desc")
        .execute(),
    ]);

    return {
      adjustments: adjustmentRows.map(toAdjustmentRecord),
      cart,
      lineItems: lineItemRows.map(toLineItemRecord),
    };
  },
  listCarts: async () => {
    const rows = await db
      .selectFrom("cart")
      .selectAll()
      .orderBy("created_at", "desc")
      .execute();

    return rows.map(toCartRecord);
  },
  removeLineItem: async (id) => {
    await db.deleteFrom("cart_line_item").where("id", "=", id).execute();
  },
  saveAdjustment: async (adjustment, idempotencyKey) => {
    const duplicate = await createD1CartRepository({
      db,
    }).findAdjustmentByIdempotencyKey(idempotencyKey);

    if (duplicate) {
      return duplicate;
    }

    await db
      .insertInto("cart_adjustment")
      .values({
        amount: adjustment.amount,
        cart_id: adjustment.cartId,
        created_at: adjustment.createdAt.getTime(),
        id: adjustment.id,
        idempotency_key: idempotencyKey,
        line_item_id: adjustment.lineItemId,
        metadata_json: toJsonColumn(adjustment.metadata),
        source: adjustment.source,
        type: adjustment.type,
        updated_at: adjustment.updatedAt.getTime(),
      })
      .onConflict((conflict) =>
        conflict.column("id").doUpdateSet({
          amount: adjustment.amount,
          line_item_id: adjustment.lineItemId,
          metadata_json: toJsonColumn(adjustment.metadata),
          source: adjustment.source,
          type: adjustment.type,
          updated_at: adjustment.updatedAt.getTime(),
        })
      )
      .execute();

    return adjustment;
  },
  saveCart: async (cart) => {
    const values = {
      billing_address_json: cart.billingAddress
        ? toJsonColumn(cart.billingAddress)
        : null,
      completed_at: cart.completedAt?.getTime() ?? null,
      created_at: cart.createdAt.getTime(),
      currency_code: cart.currencyCode,
      customer_id: cart.customerId,
      email: cart.email,
      id: cart.id,
      metadata_json: toJsonColumn(cart.metadata),
      payment_collection_id: cart.paymentCollectionId,
      region_id: cart.regionId,
      sales_channel_id: cart.salesChannelId,
      shipping_address_json: cart.shippingAddress
        ? toJsonColumn(cart.shippingAddress)
        : null,
      shipping_option_id: cart.shippingOptionId,
      status: cart.status,
      totals_json: toJsonColumn(cart.totals),
      updated_at: cart.updatedAt.getTime(),
    } as const;

    await db
      .insertInto("cart")
      .values(values)
      .onConflict((conflict) =>
        conflict.column("id").doUpdateSet({
          billing_address_json: values.billing_address_json,
          completed_at: values.completed_at,
          currency_code: values.currency_code,
          customer_id: values.customer_id,
          email: values.email,
          metadata_json: values.metadata_json,
          payment_collection_id: values.payment_collection_id,
          region_id: values.region_id,
          sales_channel_id: values.sales_channel_id,
          shipping_address_json: values.shipping_address_json,
          shipping_option_id: values.shipping_option_id,
          status: values.status,
          totals_json: values.totals_json,
          updated_at: values.updated_at,
        })
      )
      .execute();

    return cart;
  },
  saveLineItem: async (item, idempotencyKey) => {
    if (idempotencyKey) {
      const duplicate = await createD1CartRepository({
        db,
      }).findLineItemByIdempotencyKey(idempotencyKey);

      if (duplicate) {
        return duplicate;
      }
    }

    const values = {
      cart_id: item.cartId,
      created_at: item.createdAt.getTime(),
      id: item.id,
      idempotency_key: idempotencyKey ?? null,
      metadata_json: toJsonColumn(item.metadata),
      product_id: item.productId,
      quantity: item.quantity,
      title: item.title,
      unit_price: item.unitPrice,
      updated_at: item.updatedAt.getTime(),
      variant_id: item.variantId,
    } as const;

    await db
      .insertInto("cart_line_item")
      .values(values)
      .onConflict((conflict) =>
        conflict.column("id").doUpdateSet({
          metadata_json: values.metadata_json,
          quantity: values.quantity,
          title: values.title,
          unit_price: values.unit_price,
          updated_at: values.updated_at,
        })
      )
      .execute();

    return item;
  },
});
