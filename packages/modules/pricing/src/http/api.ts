import { defineEffectHttpApiModuleContribution } from "@ecommerce/api/effect-http-api";
import {
  CurrentEffectHttpRequestContext,
  withEffectHttpPermission,
} from "@ecommerce/api/effect-http-middleware";
import type { EffectHttpRequestIdentity } from "@ecommerce/api/effect-http-middleware";
import { defineCommerceModuleApiGroupContribution } from "@ecommerce/core";
import { Effect } from "effect";
import { HttpApi, HttpApiBuilder } from "effect/unstable/httpapi";

import {
  serializeCurrencyId,
  serializeMoneyAmountId,
  serializePriceListId,
  serializePricePreferenceId,
  serializePriceRuleId,
  serializePriceSetId,
} from "../domain";
import type {
  CalculatedPrice,
  CalculatedPriceApi,
  CurrencyApiRecord,
  CurrencyRecord,
  MoneyAmountApiRecord,
  MoneyAmountRecord,
  PriceListApiRecord,
  PriceListRecord,
  PricePreferenceApiRecord,
  PricePreferenceRecord,
  PriceRuleApiRecord,
  PriceRuleRecord,
  PriceSetApiRecord,
  PriceSetRecord,
} from "../domain";
import { pricingPermissions } from "../permissions";
import { PricingService } from "../services";
import { pricingAdminHttpApiGroup } from "./contract";

const serializeCurrency = (currency: CurrencyRecord): CurrencyApiRecord => ({
  code: currency.code,
  createdAt: currency.createdAt.toISOString(),
  id: serializeCurrencyId(currency.id),
  name: currency.name,
  precision: currency.precision,
  updatedAt: currency.updatedAt.toISOString(),
});

const serializePriceSet = (priceSet: PriceSetRecord): PriceSetApiRecord => ({
  createdAt: priceSet.createdAt.toISOString(),
  id: serializePriceSetId(priceSet.id),
  metadata: priceSet.metadata,
  title: priceSet.title,
  updatedAt: priceSet.updatedAt.toISOString(),
});

const serializePriceList = (
  priceList: PriceListRecord
): PriceListApiRecord => ({
  createdAt: priceList.createdAt.toISOString(),
  description: priceList.description,
  endsAt: priceList.endsAt?.toISOString() ?? null,
  id: serializePriceListId(priceList.id),
  startsAt: priceList.startsAt?.toISOString() ?? null,
  status: priceList.status,
  title: priceList.title,
  updatedAt: priceList.updatedAt.toISOString(),
});

const serializeMoneyAmount = (
  amount: MoneyAmountRecord
): MoneyAmountApiRecord => ({
  amount: amount.amount,
  createdAt: amount.createdAt.toISOString(),
  currencyCode: amount.currencyCode,
  id: serializeMoneyAmountId(amount.id),
  priceListId: amount.priceListId
    ? serializePriceListId(amount.priceListId)
    : null,
  priceSetId: serializePriceSetId(amount.priceSetId),
  rules: amount.rules,
  updatedAt: amount.updatedAt.toISOString(),
});

const serializePriceRule = (rule: PriceRuleRecord): PriceRuleApiRecord => ({
  attribute: rule.attribute,
  createdAt: rule.createdAt.toISOString(),
  id: serializePriceRuleId(rule.id),
  priceListId: serializePriceListId(rule.priceListId),
  updatedAt: rule.updatedAt.toISOString(),
  value: rule.value,
});

const serializePricePreference = (
  preference: PricePreferenceRecord
): PricePreferenceApiRecord => ({
  attribute: preference.attribute,
  createdAt: preference.createdAt.toISOString(),
  currencyCode: preference.currencyCode,
  id: serializePricePreferenceId(preference.id),
  updatedAt: preference.updatedAt.toISOString(),
  value: preference.value,
});

const serializeCalculatedPrice = (
  calculatedPrice: CalculatedPrice
): CalculatedPriceApi => ({
  amount: calculatedPrice.amount,
  currencyCode: calculatedPrice.currencyCode,
  priceSetId: serializePriceSetId(calculatedPrice.priceSetId),
  quantity: calculatedPrice.quantity,
  subtotal: calculatedPrice.subtotal,
  trace: {
    moneyAmountId: serializeMoneyAmountId(calculatedPrice.trace.moneyAmountId),
    priceListId: calculatedPrice.trace.priceListId
      ? serializePriceListId(calculatedPrice.trace.priceListId)
      : null,
    ruleMatches: calculatedPrice.trace.ruleMatches,
    source: calculatedPrice.trace.source,
  },
});

const withSuccessEnvelope = <TData>(
  data: TData,
  request: EffectHttpRequestIdentity
) =>
  ({
    data,
    meta: { request },
    success: true,
  }) as const;

const withCurrentRequest = <TData, TError, TRequirements>(
  effect: Effect.Effect<TData, TError, TRequirements>
) =>
  Effect.gen(function* createPricingApiSuccessEnvelope() {
    const context = yield* CurrentEffectHttpRequestContext;
    const data = yield* effect;
    return withSuccessEnvelope(data, context.identity);
  });

const pricingAdminGroupIdentifier = "pricingAdmin";
const pricingAdminHttpApi = HttpApi.make("PricingAdminApi").add(
  pricingAdminHttpApiGroup
);

/** Public Effect HTTP handlers supplied by this module contribution. */
export const pricingAdminHttpApiHandlers = HttpApiBuilder.group(
  pricingAdminHttpApi,
  pricingAdminGroupIdentifier,
  (handlers) =>
    handlers
      .handle("pricingCalculate", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            PricingService.use((service) =>
              service
                .calculatePrice(payload)
                .pipe(Effect.map(serializeCalculatedPrice))
            )
          ),
          pricingPermissions.read
        )
      )
      .handle("pricingCurrencyCreate", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            PricingService.use((service) =>
              service
                .createCurrency(payload)
                .pipe(Effect.map(serializeCurrency))
            )
          ),
          pricingPermissions.write
        )
      )
      .handle("pricingCurrencyList", () =>
        withEffectHttpPermission(
          withCurrentRequest(
            PricingService.use((service) =>
              service.listCurrencies.pipe(
                Effect.map((currencies) => currencies.map(serializeCurrency))
              )
            )
          ),
          pricingPermissions.read
        )
      )
      .handle("pricingMoneyAmountCreate", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            PricingService.use((service) =>
              service
                .createMoneyAmount(payload)
                .pipe(Effect.map(serializeMoneyAmount))
            )
          ),
          pricingPermissions.write
        )
      )
      .handle("pricingPriceListCreate", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            PricingService.use((service) =>
              service
                .createPriceList(payload)
                .pipe(Effect.map(serializePriceList))
            )
          ),
          pricingPermissions.write
        )
      )
      .handle("pricingPricePreferenceCreate", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            PricingService.use((service) =>
              service
                .createPricePreference(payload)
                .pipe(Effect.map(serializePricePreference))
            )
          ),
          pricingPermissions.write
        )
      )
      .handle("pricingPriceRuleCreate", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            PricingService.use((service) =>
              service
                .createPriceRule(payload)
                .pipe(Effect.map(serializePriceRule))
            )
          ),
          pricingPermissions.write
        )
      )
      .handle("pricingPriceSetCreate", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            PricingService.use((service) =>
              service
                .createPriceSet(payload)
                .pipe(Effect.map(serializePriceSet))
            )
          ),
          pricingPermissions.write
        )
      )
);

/** Executable HTTP contribution registered by the owning module definition. */
export const pricingEffectHttpApiContribution =
  defineEffectHttpApiModuleContribution({
    groups: [
      defineCommerceModuleApiGroupContribution({
        group: pricingAdminHttpApiGroup,
        handlers: pricingAdminHttpApiHandlers,
        key: "module:pricing.admin",
        surface: "admin",
      }),
    ],
    moduleName: "pricing",
  });
