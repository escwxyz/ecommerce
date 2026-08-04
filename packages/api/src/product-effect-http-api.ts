import {
  ProductService,
  productPermissions,
  serializeProductId,
} from "@ecommerce/product";
import type {
  ProductApiRecord,
  ProductCatalog,
  ProductCatalogApi,
  ProductRecord,
} from "@ecommerce/product";
import { Effect } from "effect";
import { HttpApi, HttpApiBuilder } from "effect/unstable/httpapi";

import {
  defineAdminHttpApiGroupContribution,
  defineEffectHttpApiModuleContribution,
} from "./effect-http-api";
import {
  CurrentEffectHttpRequestContext,
  withEffectHttpPermission,
} from "./effect-http-middleware";
import type { EffectHttpRequestIdentity } from "./effect-http-middleware";
import { productAdminHttpApiGroup } from "./product-effect-http-contract";

const serializeCatalog = (catalog: ProductCatalog): ProductCatalogApi => ({
  categories: catalog.categories,
  collections: catalog.collections,
  media: catalog.media,
  metadata: catalog.metadata,
  options: catalog.options,
  publishedAt: catalog.publishedAt?.toISOString() ?? null,
  searchableText: catalog.searchableText,
  tags: catalog.tags,
  variants: catalog.variants,
});

const serializeProduct = (product: ProductRecord): ProductApiRecord => ({
  catalog: serializeCatalog(product.catalog),
  createdAt: product.createdAt.toISOString(),
  handle: product.handle,
  id: serializeProductId(product.id),
  status: product.status,
  title: product.title,
  updatedAt: product.updatedAt.toISOString(),
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
  Effect.gen(function* createProductApiSuccessEnvelope() {
    const context = yield* CurrentEffectHttpRequestContext;
    const data = yield* effect;
    return withSuccessEnvelope(data, context.identity);
  });

const productAdminGroupIdentifier = "productAdmin";
const productAdminHttpApi = HttpApi.make("ProductAdminApi").add(
  productAdminHttpApiGroup
);

export const productAdminHttpApiHandlers = HttpApiBuilder.group(
  productAdminHttpApi,
  productAdminGroupIdentifier,
  (handlers) =>
    handlers
      .handle("productCreate", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            ProductService.use((service) =>
              service
                .createProductDraft(payload)
                .pipe(Effect.map(serializeProduct))
            )
          ),
          productPermissions.write
        )
      )
      .handle("productGet", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            ProductService.use((service) =>
              service
                .getProductById(payload.id)
                .pipe(
                  Effect.map((product) =>
                    product ? serializeProduct(product) : null
                  )
                )
            )
          ),
          productPermissions.read
        )
      )
      .handle("productList", () =>
        withEffectHttpPermission(
          withCurrentRequest(
            ProductService.use((service) =>
              service.listProducts.pipe(
                Effect.map((products) => products.map(serializeProduct))
              )
            )
          ),
          productPermissions.read
        )
      )
      .handle("productCatalogUpdate", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            ProductService.use((service) =>
              service
                .updateProductCatalog(payload)
                .pipe(Effect.map(serializeProduct))
            )
          ),
          productPermissions.write
        )
      )
      .handle("productVariantValidate", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            ProductService.use((service) =>
              service.validateProductVariant(payload)
            )
          ),
          productPermissions.read
        )
      )
);

export const productEffectHttpApiContribution =
  defineEffectHttpApiModuleContribution({
    groups: [
      defineAdminHttpApiGroupContribution({
        group: productAdminHttpApiGroup,
        handlers: productAdminHttpApiHandlers,
        key: "module:product.admin",
        owner: "module",
      }),
    ],
    moduleName: "product",
  });
