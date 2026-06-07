import type { Kysely } from "kysely";

import type {
  ProductDatabase,
  ProductRecord,
  ProductRepository,
  ProductRow,
} from "../../domain";
import { ProductStatusSchema, createProductId } from "../../domain";

export type ProductD1Database = Kysely<ProductDatabase>;

export interface CreateD1ProductRepositoryOptions {
  readonly db: ProductD1Database;
}

const PRODUCT_HANDLE_UNIQUE_CONSTRAINT =
  "UNIQUE constraint failed: product.handle";

const isDuplicateProductHandleError = (error: unknown): boolean =>
  error instanceof Error &&
  error.message.includes(PRODUCT_HANDLE_UNIQUE_CONSTRAINT);

const toProductRecord = (row: ProductRow): ProductRecord => ({
  createdAt: new Date(row.created_at),
  handle: row.handle,
  id: createProductId(row.id),
  status: ProductStatusSchema.parse(row.status),
  title: row.title,
  updatedAt: new Date(row.updated_at),
});

export const createD1ProductRepository = ({
  db,
}: CreateD1ProductRepositoryOptions): ProductRepository => ({
  findProductByHandle: async (handle) => {
    const row = await db
      .selectFrom("product")
      .selectAll()
      .where("handle", "=", handle)
      .limit(1)
      .executeTakeFirst();

    return row ? toProductRecord(row) : null;
  },
  findProductById: async (id) => {
    const row = await db
      .selectFrom("product")
      .selectAll()
      .where("id", "=", id)
      .limit(1)
      .executeTakeFirst();

    return row ? toProductRecord(row) : null;
  },
  listProducts: async () => {
    const rows = await db
      .selectFrom("product")
      .selectAll()
      .orderBy("created_at", "desc")
      .execute();

    return rows.map(toProductRecord);
  },
  saveProduct: async (record) => {
    try {
      await db
        .insertInto("product")
        .values({
          created_at: record.createdAt.getTime(),
          handle: record.handle,
          id: record.id,
          status: record.status,
          title: record.title,
          updated_at: record.updatedAt.getTime(),
        })
        .execute();
    } catch (error) {
      if (isDuplicateProductHandleError(error)) {
        throw new Error(`Product handle "${record.handle}" already exists.`, {
          cause: error,
        });
      }

      throw error;
    }

    return record;
  },
});
