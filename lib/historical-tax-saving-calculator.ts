export const DEFAULT_HISTORICAL_TAX_SAVING_INVESTMENT_USD = 10000;
export const DEFAULT_HISTORICAL_TAX_RETENTION_RATE = 0.85;
export const DEFAULT_HISTORICAL_TAX_EFFECT_RATE = 0.22;

export type HistoricalDividendPoint = {
  date: string;
  amount: number;
};

export type HistoricalPriceBar = {
  date: string;
  close: number;
  high: number;
};

export type HistoricalTaxSavingInput = {
  dividends: HistoricalDividendPoint[];
  prices: HistoricalPriceBar[];
  investmentAmountUsd?: number;
  taxRetentionRate?: number;
  taxEffectRate?: number;
};

export type HistoricalTaxSavingSample = {
  exDivDate: string;
  previousTradingDate: string;
  dividendAmount: number;
  buyPrice: number;
  exDivHigh: number;
  afterTaxDividend: number;
  breakEvenPrice: number;
  success: boolean;
  profitPct: number;
};

export type HistoricalTaxSavingResult = {
  canCalculate: boolean;
  taxSavingUsd: number;
  avgProfitPct: number;
  totalCount: number;
  successCount: number;
  failureCount: number;
  samples: HistoricalTaxSavingSample[];
  warnings: string[];
};

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function isNonNegativeFinite(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function normalizeIsoDate(value: string): string | null {
  if (typeof value !== "string") return null;
  const date = value.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function emptyResult(warnings: string[]): HistoricalTaxSavingResult {
  return {
    canCalculate: false,
    taxSavingUsd: 0,
    avgProfitPct: 0,
    totalCount: 0,
    successCount: 0,
    failureCount: 0,
    samples: [],
    warnings,
  };
}

export function calculateHistoricalTaxSavingMetric(
  input: HistoricalTaxSavingInput,
): HistoricalTaxSavingResult {
  const safeInput = input ?? { dividends: [], prices: [] };
  const warnings: string[] = [];
  const dividends = Array.isArray(safeInput.dividends) ? safeInput.dividends : [];
  const prices = Array.isArray(safeInput.prices) ? safeInput.prices : [];
  const investmentAmountUsd = safeInput.investmentAmountUsd ?? DEFAULT_HISTORICAL_TAX_SAVING_INVESTMENT_USD;
  const taxRetentionRate = safeInput.taxRetentionRate ?? DEFAULT_HISTORICAL_TAX_RETENTION_RATE;
  const taxEffectRate = safeInput.taxEffectRate ?? DEFAULT_HISTORICAL_TAX_EFFECT_RATE;

  if (dividends.length === 0) warnings.push("No dividends were provided.");
  if (prices.length === 0) warnings.push("No price history was provided.");
  if (!isPositiveFinite(investmentAmountUsd)) {
    warnings.push("investmentAmountUsd must be a positive finite number.");
  }
  if (!isNonNegativeFinite(taxRetentionRate)) {
    warnings.push("taxRetentionRate must be a non-negative finite number.");
  }
  if (!isNonNegativeFinite(taxEffectRate)) {
    warnings.push("taxEffectRate must be a non-negative finite number.");
  }

  if (
    dividends.length === 0 ||
    prices.length === 0 ||
    !isPositiveFinite(investmentAmountUsd) ||
    !isNonNegativeFinite(taxRetentionRate) ||
    !isNonNegativeFinite(taxEffectRate)
  ) {
    return emptyResult(warnings);
  }

  const sortedPrices = prices
    .map((price) => ({ ...price, date: normalizeIsoDate(price.date) }))
    .filter((price): price is HistoricalPriceBar & { date: string } => price.date != null)
    .sort((a, b) => a.date.localeCompare(b.date));
  const priceByDate = new Map(sortedPrices.map((price) => [price.date, price]));
  const samples: HistoricalTaxSavingSample[] = [];

  if (sortedPrices.length === 0) {
    return emptyResult([...warnings, "No price history rows had valid YYYY-MM-DD dates."]);
  }

  const sortedDividends = [...dividends].sort((a, b) => String(a.date).localeCompare(String(b.date)));

  for (const dividend of sortedDividends) {
    const exDivDate = normalizeIsoDate(dividend.date);
    if (!exDivDate) {
      warnings.push(`Invalid dividend date: ${String(dividend.date)}.`);
      continue;
    }

    if (!isPositiveFinite(dividend.amount)) {
      warnings.push(`Invalid dividend amount for ${exDivDate}.`);
      continue;
    }

    const exDivPrice = priceByDate.get(exDivDate);
    if (!exDivPrice) {
      warnings.push(`Missing ex-dividend price bar for ${exDivDate}.`);
      continue;
    }

    const previousTradingDay = [...sortedPrices].reverse().find((price) => price.date < exDivDate);
    if (!previousTradingDay) {
      warnings.push(`Missing previous trading day price bar before ${exDivDate}.`);
      continue;
    }

    const buyPrice = previousTradingDay.close;
    const exDivHigh = exDivPrice.high;

    if (!isPositiveFinite(buyPrice)) {
      warnings.push(`Invalid buy price for ${exDivDate}.`);
      continue;
    }

    if (!isPositiveFinite(exDivHigh)) {
      warnings.push(`Invalid ex-dividend high for ${exDivDate}.`);
      continue;
    }

    const afterTaxDividend = dividend.amount * taxRetentionRate;
    const breakEvenPrice = buyPrice - afterTaxDividend;
    const success = exDivHigh >= breakEvenPrice;
    const profitPct = success ? (afterTaxDividend / buyPrice) * 100 : 0;

    samples.push({
      exDivDate,
      previousTradingDate: previousTradingDay.date,
      dividendAmount: dividend.amount,
      buyPrice,
      exDivHigh,
      afterTaxDividend,
      breakEvenPrice,
      success,
      profitPct,
    });
  }

  if (samples.length === 0) {
    return emptyResult(warnings.length > 0 ? warnings : ["No valid historical tax-saving samples could be calculated."]);
  }

  const successfulSamples = samples.filter((sample) => sample.success);
  const successCount = successfulSamples.length;
  const failureCount = samples.length - successCount;
  const avgProfitPct =
    successCount > 0
      ? successfulSamples.reduce((total, sample) => total + sample.profitPct, 0) / successCount
      : 0;
  const taxSavingUsd = successCount > 0 ? (avgProfitPct / 100) * investmentAmountUsd * taxEffectRate : 0;

  return {
    canCalculate: true,
    taxSavingUsd,
    avgProfitPct,
    totalCount: samples.length,
    successCount,
    failureCount,
    samples,
    warnings,
  };
}
