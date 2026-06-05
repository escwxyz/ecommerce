export {
  createD1ProductRepository,
  type CreateD1ProductRepositoryOptions,
  type ProductD1Database,
} from "./adapters";
export { productAdminSurfaces } from "./admin";
export { defineApiContractRoute, productContractRouter } from "./contracts";
export {
  CreateProductInputSchema,
  ProductApiListSchema,
  ProductApiRecordSchema,
  ProductIdentifierSchema,
  ProductRecordSchema,
  ProductStatusSchema,
} from "./domain";
export type {
  CreateProductInput,
  ProductApiRecord,
  ProductId,
  ProductIdentifierInput,
  ProductRecord,
  ProductRepository,
  ProductStatus,
} from "./domain";
export { productModule } from "./module";
export {
  InMemoryProductRepository,
  createInMemoryProductRepository,
  createResettableInMemoryProductRepository,
  defaultProductRepository,
  type ResettableProductRepository,
} from "./repositories";
export {
  createProductRouteFragment,
  productApiFragment,
  productRouter,
  type CreateProductRouteFragmentOptions,
  type ProductModuleContext,
} from "./router";
export { productPermissionList, productPermissions } from "./permissions";
export {
  ProductService,
  createProductService,
  createProductServiceLayer,
  defaultProductService,
  type CreateProductServiceOptions,
  type ProductServiceShape,
} from "./services";
export { createTestProductService, resetProductState } from "./testing";
