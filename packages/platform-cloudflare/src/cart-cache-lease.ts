export const cartMutationLeaseDurationMs = 5 * 60 * 1000;

export interface CartMutationLease {
  readonly expiresAt: number;
  readonly startedAt: number;
}

export type StoredCartMutationLeases = Record<
  string,
  CartMutationLease | boolean
>;

export interface PrunedCartMutationLeases {
  readonly entries: Record<string, CartMutationLease>;
  readonly expiredAny: boolean;
  readonly hasActive: boolean;
}

export const createCartMutationLease = (
  startedAt: number
): CartMutationLease => ({
  expiresAt: startedAt + cartMutationLeaseDurationMs,
  startedAt,
});

const isActiveLease = (
  entry: CartMutationLease | boolean | undefined,
  now: number
): entry is CartMutationLease =>
  typeof entry === "object" &&
  entry !== null &&
  Number.isFinite(entry.expiresAt) &&
  entry.expiresAt > now;

export const pruneCartMutationLeases = (
  entries: StoredCartMutationLeases,
  now: number
): PrunedCartMutationLeases => {
  const activeEntries: Record<string, CartMutationLease> = {};
  let expiredAny = false;

  for (const [mutationId, entry] of Object.entries(entries)) {
    if (isActiveLease(entry, now)) {
      activeEntries[mutationId] = entry;
      continue;
    }

    expiredAny = true;
  }

  return {
    entries: activeEntries,
    expiredAny,
    hasActive: Object.keys(activeEntries).length > 0,
  };
};
