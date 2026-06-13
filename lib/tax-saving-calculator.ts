export const DEFAULT_TAX_SAVING_INVESTMENT_USD = 10000;
export const DEFAULT_TAX_RETENTION_RATE = 0.85;
export const DEFAULT_DIVIDEND_TAX_RATE = 0.22;

export type TaxSavingCalculationInput = {
  investmentAmountUsd?: number;
  currentPrice: number | null | undefined;
  dividendAmountPerShare: number | null | undefined;
  taxRetentionRate?: number;
  dividendTaxRate?: number;
};

export type TaxSavingCalculationResult = {
  canCalculate: boolean;
  expectedShares: number;
  expectedDividendUsd: number;
  taxSavingUsd: number;
  warnings: string[];
};

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function isNonNegativeFinite(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

export function calculateExpectedDividendTaxSaving(
  input: TaxSavingCalculationInput,
): TaxSavingCalculationResult {
  const warnings: string[] = [];
  const investmentAmountUsd = input.investmentAmountUsd ?? DEFAULT_TAX_SAVING_INVESTMENT_USD;
  const taxRetentionRate = input.taxRetentionRate ?? DEFAULT_TAX_RETENTION_RATE;
  const dividendTaxRate = input.dividendTaxRate ?? DEFAULT_DIVIDEND_TAX_RATE;

  if (input.currentPrice == null) {
    warnings.push("currentPrice is required.");
  } else if (!isPositiveFinite(input.currentPrice)) {
    warnings.push("currentPrice must be a positive finite number.");
  }

  if (input.dividendAmountPerShare == null) {
    warnings.push("dividendAmountPerShare is required.");
  } else if (!isPositiveFinite(input.dividendAmountPerShare)) {
    warnings.push("dividendAmountPerShare must be a positive finite number.");
  }

  if (!isPositiveFinite(investmentAmountUsd)) {
    warnings.push("investmentAmountUsd must be a positive finite number.");
  }

  if (!isNonNegativeFinite(taxRetentionRate)) {
    warnings.push("taxRetentionRate must be a non-negative finite number.");
  }

  if (!isNonNegativeFinite(dividendTaxRate)) {
    warnings.push("dividendTaxRate must be a non-negative finite number.");
  }

  if (warnings.length > 0) {
    return {
      canCalculate: false,
      expectedShares: 0,
      expectedDividendUsd: 0,
      taxSavingUsd: 0,
      warnings,
    };
  }

  const currentPrice = input.currentPrice as number;
  const dividendAmountPerShare = input.dividendAmountPerShare as number;
  const expectedShares = Math.floor(investmentAmountUsd / currentPrice);

  if (expectedShares <= 0) {
    return {
      canCalculate: false,
      expectedShares,
      expectedDividendUsd: 0,
      taxSavingUsd: 0,
      warnings: ["expectedShares must be greater than 0."],
    };
  }

  const expectedDividendUsd = expectedShares * dividendAmountPerShare;
  const taxSavingUsd = expectedDividendUsd * taxRetentionRate * dividendTaxRate;

  return {
    canCalculate: true,
    expectedShares,
    expectedDividendUsd,
    taxSavingUsd,
    warnings: [],
  };
}
