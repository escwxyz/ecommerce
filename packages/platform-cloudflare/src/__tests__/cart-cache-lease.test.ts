import { describe, expect, it } from "bun:test";

import {
  createCartMutationLease,
  pruneCartMutationLeases,
} from "../cart-cache-lease";

describe("cart cache mutation leases", () => {
  it("expires abandoned mutation leases without dropping active leases", () => {
    const now = Date.parse("2026-08-13T10:00:00.000Z");
    const expired = createCartMutationLease(now - 600_001);
    const active = createCartMutationLease(now - 1_000);

    const pruned = pruneCartMutationLeases(
      {
        active,
        expired,
        legacy: true,
      },
      now
    );

    expect(pruned.entries).toEqual({ active });
    expect(pruned.expiredAny).toBe(true);
    expect(pruned.hasActive).toBe(true);
  });

  it("reports no active leases after all entries expire", () => {
    const now = Date.parse("2026-08-13T10:00:00.000Z");

    const pruned = pruneCartMutationLeases(
      {
        expired: createCartMutationLease(now - 600_001),
      },
      now
    );

    expect(pruned.entries).toEqual({});
    expect(pruned.expiredAny).toBe(true);
    expect(pruned.hasActive).toBe(false);
  });
});
