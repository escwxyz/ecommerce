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

export const manualTaxProvider: TaxProvider = {
  calculateTax: (input, context) => {
    const lines: TaxLine[] = [];

    for (const item of input.items) {
      const rate = getLineRate(item, context.rates);
      const taxableAmount = getTaxableAmount(item);
      const rawTaxAmount = rate ? (taxableAmount * rate.percentage) / 100 : 0;
      const amount = Math.round(rawTaxAmount);

      lines.push({
        amount,
        currencyCode: context.currencyCode,
        id: context.createLineId(),
        itemId: item.id,
        rate: rate?.percentage ?? 0,
        rateId: rate?.id ?? null,
        taxableAmount,
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
