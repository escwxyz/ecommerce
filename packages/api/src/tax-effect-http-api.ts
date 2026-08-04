import {
  TaxService,
  serializeTaxCalculationId,
  serializeTaxCategoryId,
  serializeTaxLineId,
  serializeTaxProviderConfigId,
  serializeTaxRateId,
  serializeTaxRegionId,
  taxPermissions,
} from "@ecommerce/tax";
import type {
  TaxCalculationResult,
  TaxCalculationResultApi,
  TaxCategoryApiRecord,
  TaxCategoryRecord,
  TaxProviderConfigApiRecord,
  TaxProviderConfigRecord,
  TaxRateApiRecord,
  TaxRateRecord,
  TaxRegionApiRecord,
  TaxRegionRecord,
} from "@ecommerce/tax";
import { Effect } from "effect";
import { HttpApi, HttpApiBuilder } from "effect/unstable/httpapi";

import {
  defineAdminHttpApiGroupContribution,
  defineEffectHttpApiModuleContribution,
} from "./effect-http-api";
import {
  CurrentEffectHttpRequestContext,
  withEffectHttpPermission,
} from "./effect-http-middleware";
import type { EffectHttpRequestIdentity } from "./effect-http-middleware";
import { taxAdminHttpApiGroup } from "./tax-effect-http-contract";

const serializeCategory = (
  category: TaxCategoryRecord
): TaxCategoryApiRecord => ({
  code: category.code,
  createdAt: category.createdAt.toISOString(),
  description: category.description,
  id: serializeTaxCategoryId(category.id),
  metadata: category.metadata,
  name: category.name,
  updatedAt: category.updatedAt.toISOString(),
});

const serializeProviderConfig = (
  providerConfig: TaxProviderConfigRecord
): TaxProviderConfigApiRecord => ({
  createdAt: providerConfig.createdAt.toISOString(),
  id: serializeTaxProviderConfigId(providerConfig.id),
  isActive: providerConfig.isActive,
  metadata: providerConfig.metadata,
  providerKey: providerConfig.providerKey,
  settings: providerConfig.settings,
  updatedAt: providerConfig.updatedAt.toISOString(),
});

const serializeRate = (rate: TaxRateRecord): TaxRateApiRecord => ({
  categoryId: rate.categoryId ? serializeTaxCategoryId(rate.categoryId) : null,
  createdAt: rate.createdAt.toISOString(),
  id: serializeTaxRateId(rate.id),
  metadata: rate.metadata,
  name: rate.name,
  percentage: rate.percentage,
  regionId: serializeTaxRegionId(rate.regionId),
  updatedAt: rate.updatedAt.toISOString(),
});

const serializeRegion = (region: TaxRegionRecord): TaxRegionApiRecord => ({
  code: region.code,
  countryCode: region.countryCode,
  createdAt: region.createdAt.toISOString(),
  id: serializeTaxRegionId(region.id),
  metadata: region.metadata,
  name: region.name,
  providerConfigId: region.providerConfigId
    ? serializeTaxProviderConfigId(region.providerConfigId)
    : null,
  updatedAt: region.updatedAt.toISOString(),
});

const serializeCalculationResult = (
  result: TaxCalculationResult
): TaxCalculationResultApi => ({
  currencyCode: result.currencyCode,
  id: serializeTaxCalculationId(result.id),
  lines: result.lines.map((line) => ({
    amount: line.amount,
    currencyCode: line.currencyCode,
    id: serializeTaxLineId(line.id),
    itemId: line.itemId,
    rate: line.rate,
    rateId: line.rateId ? serializeTaxRateId(line.rateId) : null,
    taxableAmount: line.taxableAmount,
  })),
  providerKey: result.providerKey,
  regionId: serializeTaxRegionId(result.regionId),
  totalTax: result.totalTax,
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
  Effect.gen(function* createTaxApiSuccessEnvelope() {
    const context = yield* CurrentEffectHttpRequestContext;
    const data = yield* effect;
    return withSuccessEnvelope(data, context.identity);
  });

const taxAdminGroupIdentifier = "taxAdmin";
const taxAdminHttpApi = HttpApi.make("TaxAdminApi").add(taxAdminHttpApiGroup);

export const taxAdminHttpApiHandlers = HttpApiBuilder.group(
  taxAdminHttpApi,
  taxAdminGroupIdentifier,
  (handlers) =>
    handlers
      .handle("taxCalculate", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            TaxService.use((service) =>
              service
                .calculateTax(payload)
                .pipe(Effect.map(serializeCalculationResult))
            )
          ),
          taxPermissions.read
        )
      )
      .handle("taxCategoryCreate", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            TaxService.use((service) =>
              service
                .createCategory(payload)
                .pipe(Effect.map(serializeCategory))
            )
          ),
          taxPermissions.write
        )
      )
      .handle("taxProviderConfigCreate", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            TaxService.use((service) =>
              service
                .createProviderConfig(payload)
                .pipe(Effect.map(serializeProviderConfig))
            )
          ),
          taxPermissions.write
        )
      )
      .handle("taxRateCreate", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            TaxService.use((service) =>
              service.createRate(payload).pipe(Effect.map(serializeRate))
            )
          ),
          taxPermissions.write
        )
      )
      .handle("taxRegionCreate", ({ payload }) =>
        withEffectHttpPermission(
          withCurrentRequest(
            TaxService.use((service) =>
              service.createRegion(payload).pipe(Effect.map(serializeRegion))
            )
          ),
          taxPermissions.write
        )
      )
);

export const taxEffectHttpApiContribution =
  defineEffectHttpApiModuleContribution({
    groups: [
      defineAdminHttpApiGroupContribution({
        group: taxAdminHttpApiGroup,
        handlers: taxAdminHttpApiHandlers,
        key: "module:tax.admin",
        owner: "module",
      }),
    ],
    moduleName: "tax",
  });
