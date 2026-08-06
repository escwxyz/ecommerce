export { productAdminSurfaces } from "./admin";
export {
  CreateProductInputSchema,
  ProductApiListSchema,
  ProductApiRecordSchema,
  ProductCatalogApiSchema,
  ProductCatalogSchema,
  ProductIdentifierSchema,
  ProductIsoDateTimeStringSchema,
  ProductIdSchema,
  ProductMetadataSchema,
  ProductSerializedIdSchema,
  ProductRecordSchema,
  ProductStatusSchema,
  ProductTrimmedStringSchema,
  ProductVariantValidationInputSchema,
  ProductVariantValidationResultSchema,
  UpdateProductCatalogInputSchema,
} from "./domain";
export {
  ProductCatalogValidationFailure,
  ProductHandleConflict,
  ProductInvalidIdentifier,
  ProductNotFound,
  ProductRepositoryService,
  createProductId,
  createProductIdEffect,
  serializeProductId,
  type ProductExpectedError,
} from "./domain";
export type {
  CreateProductInput,
  ProductApiList,
  ProductApiRecord,
  ProductCatalog,
  ProductCatalogApi,
  ProductId,
  ProductIdentifierInput,
  ProductRecord,
  ProductRepository,
  ProductStatus,
  ProductVariantValidationInput,
  ProductVariantValidationResult,
} from "./domain";
export { productModule } from "./module";
export { productPermissionList, productPermissions } from "./permissions";
export {
  ProductService,
  createEmptyProductCatalog,
  createProductRepositoryLayer,
  createProductService,
  createProductServiceFromDependenciesLayer,
  createProductServiceLayer,
  type CreateProductServiceOptions,
  type ProductServiceShape,
} from "./services";
