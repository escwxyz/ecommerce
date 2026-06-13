import { defineCommerceModule } from "@ecommerce/core";

import { productAdminSurfaces } from "../admin";
import { productPermissionList } from "../permissions";
import { productApiFragment } from "../router";
import { ProductService } from "../services";

export const productModule = defineCommerceModule({
  contributions: {
    adminSurfaces: productAdminSurfaces,
    apiFragments: [productApiFragment],
    eventTypes: [
      "product.created",
      "product.catalog.updated",
      "product.variant.validated",
    ],
    permissions: productPermissionList,
  },
  key: "product",
  providedServices: [{ key: "product-service", service: ProductService }],
});
