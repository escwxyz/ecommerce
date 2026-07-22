import { Effect } from "effect";
import type { Effect as EffectValue } from "effect/Effect";

import type {
  CalculateTaxInput,
  TaxCalculationResult,
  TaxLine,
  TaxRateRecord,
  TaxValidationFailure,
} from "../domain";

export interface TaxProviderCalculationContext {
  readonly createLineId: () => TaxLine["id"];
  readonly currencyCode: string;
  readonly rates: readonly TaxRateRecord[];
}

export interface TaxProvider {
  readonly key: string;
  readonly calculateTax: (
    input: CalculateTaxInput,
    context: TaxProviderCalculationContext
  ) => EffectValue<
    Omit<TaxCalculationResult, "id" | "providerKey" | "regionId">,
    TaxValidationFailure
  >;
  readonly validateConfig?: (
    settings: Readonly<Record<string, unknown>>
  ) => EffectValue<void, TaxValidationFailure>;
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
  const allocationOrder: { fraction: number; index: number }[] = [];

  for (const [index, rawAmount] of rawAmounts.entries()) {
    const next = {
      fraction: rawAmount - Math.floor(rawAmount),
      index,
    };
    let insertAt = 0;

    while (insertAt < allocationOrder.length) {
      const current = allocationOrder[insertAt];

      if (
        !current ||
        next.fraction > current.fraction ||
        (next.fraction === current.fraction && next.index < current.index)
      ) {
        break;
      }

      insertAt += 1;
    }

    allocationOrder.splice(insertAt, 0, next);
  }

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
  calculateTax: (input, context) =>
    Effect.sync(() => {
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
        input.policy.roundAt ?? "line"
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

      return {
        currencyCode: context.currencyCode,
        lines,
        totalTax: lines.reduce((total, line) => total + line.amount, 0),
      };
    }),
  key: "manual",
  validateConfig: () => Effect.void,
};

export const defaultTaxProviders = [manualTaxProvider] as const;

export const findTaxProvider = (
  providers: readonly TaxProvider[],
  providerKey: string
): TaxProvider | null =>
  providers.find((provider) => provider.key === providerKey) ?? null;
