import { describe, expect, it } from "bun:test";

import { cartAdminMetadata } from "@ecommerce/cart/admin";
import { composeAdminMetadata } from "@ecommerce/core/admin";
import { orderAdminMetadata } from "@ecommerce/order/admin";
import { paymentAdminMetadata } from "@ecommerce/payment/admin";
import { storeAdminMetadata } from "@ecommerce/store/admin";

describe("built-in admin metadata", () => {
  it("qualifies module navigation and resource keys exactly once", () => {
    const model = composeAdminMetadata({
      contributions: [
        cartAdminMetadata,
        orderAdminMetadata,
        paymentAdminMetadata,
        storeAdminMetadata,
      ],
    });

    expect(model.surfaces.map((surface) => surface.id)).toEqual([
      "module:store:navigation",
      "module:store:resource",
      "module:cart:navigation",
      "module:order:navigation",
      "module:cart:resource",
      "module:order:resource",
      "module:payment:navigation",
      "module:payment:resource",
    ]);
  });
});
