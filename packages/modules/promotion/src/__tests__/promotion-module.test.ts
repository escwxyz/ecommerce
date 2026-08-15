import { describe, expect, it } from "bun:test";

import { promotionModule } from "../module";

describe("promotion module declaration", () => {
  it("declares Effect service, events, permissions, and extension points", () => {
    expect(promotionModule.key).toBe("promotion");
    expect(
      promotionModule.contributions?.services?.map(({ key }) => key)
    ).toEqual(["promotion:service"]);
    expect(promotionModule.contributions?.eventTypes).toEqual([
      "promotion.created",
      "promotion.redemption-recorded",
    ]);
  });
});
