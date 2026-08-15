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

const normalizeActiveLease = (
  entry: CartMutationLease | boolean | undefined,
  now: number
): CartMutationLease | null => {
  if (entry === true) {
    return createCartMutationLease(now);
  }

  if (
    typeof entry === "object" &&
    entry !== null &&
    Number.isFinite(entry.expiresAt) &&
    entry.expiresAt > now
  ) {
    return entry;
  }

  return null;
};

export const pruneCartMutationLeases = (
  entries: StoredCartMutationLeases,
  now: number
): PrunedCartMutationLeases => {
  const activeEntries: Record<string, CartMutationLease> = {};
  let expiredAny = false;

  for (const [mutationId, entry] of Object.entries(entries)) {
    const activeLease = normalizeActiveLease(entry, now);

    if (activeLease) {
      activeEntries[mutationId] = activeLease;
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
