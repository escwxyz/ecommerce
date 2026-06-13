import { defineApiContractRoute } from "@ecommerce/module-contracts";
import { z } from "zod";

import {
  CalculatePriceInputSchema,
  CalculatedPriceSchema,
  CreateCurrencyInputSchema,
  CreateMoneyAmountInputSchema,
  CreatePriceListInputSchema,
  CreatePriceRuleInputSchema,
  CreatePriceSetInputSchema,
  CurrencyApiRecordSchema,
  MoneyAmountApiRecordSchema,
  PriceListApiRecordSchema,
  PriceRuleApiRecordSchema,
  PriceSetApiRecordSchema,
} from "../domain";

export const pricingContractRouter = {
  pricingCalculate: defineApiContractRoute({
    description:
      "Calculate a traceable base or rule-based price for a price set and context.",
    method: "POST",
    operationId: "pricingCalculate",
    path: "/pricing/calculate",
    successDescription: "Calculated price returned.",
    summary: "Calculate price",
    tags: ["Pricing"],
  })
    .input(CalculatePriceInputSchema)
    .output(CalculatedPriceSchema),
  pricingCurrencyCreate: defineApiContractRoute({
    description: "Create a pricing-owned currency record.",
    method: "POST",
    operationId: "pricingCurrencyCreate",
    path: "/pricing/currencies",
    successDescription: "Currency created.",
    summary: "Create currency",
    tags: ["Pricing"],
  })
    .input(CreateCurrencyInputSchema)
    .output(CurrencyApiRecordSchema),
  pricingCurrencyList: defineApiContractRoute({
    description: "List pricing-owned currency records.",
    method: "GET",
    operationId: "pricingCurrencyList",
    path: "/pricing/currencies",
    successDescription: "Currencies returned.",
    summary: "List currencies",
    tags: ["Pricing"],
  })
    .input(z.unknown())
    .output(z.array(CurrencyApiRecordSchema)),
  pricingMoneyAmountCreate: defineApiContractRoute({
    description: "Create a money amount attached to a price set.",
    method: "POST",
    operationId: "pricingMoneyAmountCreate",
    path: "/pricing/money-amounts",
    successDescription: "Money amount created.",
    summary: "Create money amount",
    tags: ["Pricing"],
  })
    .input(CreateMoneyAmountInputSchema)
    .output(MoneyAmountApiRecordSchema),
  pricingPriceListCreate: defineApiContractRoute({
    description: "Create a price list for rule-based pricing.",
    method: "POST",
    operationId: "pricingPriceListCreate",
    path: "/pricing/price-lists",
    successDescription: "Price list created.",
    summary: "Create price list",
    tags: ["Pricing"],
  })
    .input(CreatePriceListInputSchema)
    .output(PriceListApiRecordSchema),
  pricingPriceRuleCreate: defineApiContractRoute({
    description: "Create a rule that scopes a price list.",
    method: "POST",
    operationId: "pricingPriceRuleCreate",
    path: "/pricing/price-rules",
    successDescription: "Price rule created.",
    summary: "Create price rule",
    tags: ["Pricing"],
  })
    .input(CreatePriceRuleInputSchema)
    .output(PriceRuleApiRecordSchema),
  pricingPriceSetCreate: defineApiContractRoute({
    description: "Create a price set that groups sellable object prices.",
    method: "POST",
    operationId: "pricingPriceSetCreate",
    path: "/pricing/price-sets",
    successDescription: "Price set created.",
    summary: "Create price set",
    tags: ["Pricing"],
  })
    .input(CreatePriceSetInputSchema)
    .output(PriceSetApiRecordSchema),
} as const;
