import type {
  CalculateTaxInput,
  TaxCalculationResult,
  TaxLine,
  TaxRateRecord,
} from "../domain";

export interface TaxProviderCalculationContext {
  readonly createLineId: () => TaxLine["id"];
  readonly currencyCode: string;
  readonly rates: readonly TaxRateRecord[];
}

export interface TaxProvider {
  readonly key: string;
  calculateTax(
    input: CalculateTaxInput,
    context: TaxProviderCalculationContext
  ): Promise<Omit<TaxCalculationResult, "id" | "providerKey" | "regionId">>;
  validateConfig?(settings: Readonly<Record<string, unknown>>): Promise<void>;
}

const getLineRate = (
  item: CalculateTaxInput["items"][number],
  rates: readonly TaxRateRecord[]
): TaxRateRecord | null => {
  if (item.taxCategoryId) {
    const categoryRate = rates.find(
      (rate) => rate.categoryId === item.taxCategoryId
    );

    if (categoryRate) {
      return categoryRate;
    }
  }

  return rates.find((rate) => rate.categoryId === null) ?? rates[0] ?? null;
};

const getTaxableAmount = (item: CalculateTaxInput["items"][number]): number =>
  Math.max(0, item.subtotal + (item.adjustmentsTotal ?? 0));

const calculateRawTaxAmount = ({
  pricesIncludeTax,
  rate,
  taxableAmount,
}: {
  readonly pricesIncludeTax: boolean;
  readonly rate: number;
  readonly taxableAmount: number;
}): number => {
  if (rate === 0 || taxableAmount === 0) {
    return 0;
  }

  if (pricesIncludeTax) {
    return (taxableAmount * rate) / (100 + rate);
  }

  return (taxableAmount * rate) / 100;
};

const getRoundedLineAmounts = (
  rawAmounts: readonly number[],
  roundAt: CalculateTaxInput["policy"]["roundAt"]
): readonly number[] => {
  if (roundAt === "line") {
    return rawAmounts.map((rawAmount) => Math.round(rawAmount));
  }

  const floors = rawAmounts.map((rawAmount) => Math.floor(rawAmount));
  const roundedTotal = Math.round(
    rawAmounts.reduce((total, rawAmount) => total + rawAmount, 0)
  );
  let remainder =
    roundedTotal - floors.reduce((total, floor) => total + floor, 0);
  const allocationOrder = rawAmounts
    .map((rawAmount, index) => ({
      fraction: rawAmount - Math.floor(rawAmount),
      index,
    }))
    .sort((left, right) => {
      if (right.fraction !== left.fraction) {
        return right.fraction - left.fraction;
      }

      return left.index - right.index;
    });
  const amounts = [...floors];

  for (const { index } of allocationOrder) {
    if (remainder <= 0) {
      break;
    }

    amounts[index] = (amounts[index] ?? 0) + 1;
    remainder -= 1;
  }

  return amounts;
};

export const manualTaxProvider: TaxProvider = {
  calculateTax: (input, context) => {
    const lineInputs = input.items.map((item) => {
      const rate = getLineRate(item, context.rates);
      const taxableAmount = getTaxableAmount(item);

      return {
        item,
        rate,
        rawTaxAmount: calculateRawTaxAmount({
          pricesIncludeTax: input.policy.pricesIncludeTax,
          rate: rate?.percentage ?? 0,
          taxableAmount,
        }),
        taxableAmount,
      };
    });
    const roundedAmounts = getRoundedLineAmounts(
      lineInputs.map((lineInput) => lineInput.rawTaxAmount),
      input.policy.roundAt
    );
    const lines: TaxLine[] = [];

    for (const [index, lineInput] of lineInputs.entries()) {
      lines.push({
        amount: roundedAmounts[index] ?? 0,
        currencyCode: context.currencyCode,
        id: context.createLineId(),
        itemId: lineInput.item.id,
        rate: lineInput.rate?.percentage ?? 0,
        rateId: lineInput.rate?.id ?? null,
        taxableAmount: lineInput.taxableAmount,
      });
    }

    return Promise.resolve({
      currencyCode: context.currencyCode,
      lines,
      totalTax: lines.reduce((total, line) => total + line.amount, 0),
    });
  },
  key: "manual",
  validateConfig: () => Promise.resolve(),
};

export const defaultTaxProviders = [manualTaxProvider] as const;

export const findTaxProvider = (
  providers: readonly TaxProvider[],
  providerKey: string
): TaxProvider | null =>
  providers.find((provider) => provider.key === providerKey) ?? null;
