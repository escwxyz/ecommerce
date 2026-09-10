import {
  defineCommerceModule,
  defineCommerceModuleServiceContribution,
} from "@ecommerce/core";

import { productAdminSurfaces } from "../admin";
import { productPermissionList } from "../permissions";
import {
  ProductService,
  createProductServiceFromDependenciesLayer,
} from "../services";

export const productModule = defineCommerceModule({
  contributions: {
    adminSurfaces: productAdminSurfaces,
    eventTypes: [
      "product.created",
      "product.catalog.updated",
      "product.variant.validated",
    ],
    permissions: productPermissionList,
    services: [
      defineCommerceModuleServiceContribution({
        key: "product:service",
        layer: createProductServiceFromDependenciesLayer(),
        service: ProductService,
      }),
    ],
  },
  key: "product",
});
