import type { QuoteDividendsResponse, QuoteFxResponse, QuoteLastResponse } from "./quote-types";

export type DividendEstimateWarningCode =
  | "quote_missing"
  | "quote_sample"
  | "fx_missing"
  | "fx_sample"
  | "dividend_missing"
  | "dividend_sample"
  | "value_missing"
  | "principal_missing";

export type DividendEstimateWarning = {
  code: DividendEstimateWarningCode;
  message: string;
};

export type DividendEstimateInput = {
  ticker: string;
  valueKRW: number;
  principalKRW?: number;
};

export type DividendEstimateMarketData = {
  quote?: QuoteLastResponse;
  dividends?: QuoteDividendsResponse;
  fx?: QuoteFxResponse;
};

export type DividendMonthAllocation = {
  month: number;
  amountKRW: number;
  source: "dividend-date";
};

export type DividendHoldingEstimate = {
  currentPrice?: number;
  currentPriceCurrency?: "USD" | "KRW";
  currentPriceKRW?: number;
  estimatedQuantity?: number;
  estimatedAverageCost?: number;
  estimatedAverageCostCurrency?: "USD" | "KRW";
  ttmDividendPerShare?: number;
  ttmDividendCurrency?: "USD" | "KRW";
  annualDividendKRW?: number;
  personalYieldPct?: number;
  personalYieldBasis?: "principal" | "value";
  dividendMonths: DividendMonthAllocation[];
  estimateSource: "value-current-price-ttm-dividends";
  isEstimated: true;
  warnings: DividendEstimateWarning[];
};

const DAY_MS = 86_400_000;

// PORTFOLIO-DIVIDEND-UX-FIX-3 #4: 환산 예상 배당.
// 평가금액을 연 3.5%로 인출한다고 가정한 연간 예상 인출액.
// 실제 배당소득세 계산이 아니라 인출 가정치이며, 세후 토글은 다른 배당 카드와
// 사용감을 맞추기 위해 동일한 배당세 계수(1 - 0.154)를 적용한다.
export const DIVIDEND_WITHDRAWAL_RATE = 0.035;
export const DIVIDEND_AFTER_TAX_FACTOR = 0.846;

export function computeConvertedAnnualDividendKRW(
  evaluationKRW: number,
  options: { afterTax?: boolean } = {},
): number {
  if (typeof evaluationKRW !== "number" || !Number.isFinite(evaluationKRW) || evaluationKRW <= 0) {
    return 0;
  }
  const taxFactor = options.afterTax ? DIVIDEND_AFTER_TAX_FACTOR : 1;
  return Math.round(evaluationKRW * DIVIDEND_WITHDRAWAL_RATE * taxFactor);
}

function isFinitePositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function isKrwTicker(ticker: string): boolean {
  return /^\d{6}\.(KS|KQ)$/.test(ticker.trim().toUpperCase()) || /\.(KS|KQ)$/.test(ticker.trim().toUpperCase());
}

export function inferQuoteCurrency(ticker: string, quote?: QuoteLastResponse): "USD" | "KRW" {
  const normalized = (quote?.normalizedTicker || ticker).trim().toUpperCase();
  return isKrwTicker(normalized) ? "KRW" : "USD";
}

function isUsableQuote(quote: QuoteLastResponse | undefined): quote is QuoteLastResponse & { price: number } {
  return Boolean(quote && quote.source !== "sample" && isFinitePositive(quote.price));
}

function isUsableFx(fx: QuoteFxResponse | undefined): fx is QuoteFxResponse & { rate: number } {
  return Boolean(fx && fx.source !== "sample" && isFinitePositive(fx.rate));
}

function isUsableDividends(dividends: QuoteDividendsResponse | undefined): boolean {
  return Boolean(dividends && dividends.source !== "sample" && Array.isArray(dividends.dividends));
}

export function estimateQuantityFromValue(valueKRW: number, currentPriceKRW: number): number | undefined {
  if (!isFinitePositive(valueKRW) || !isFinitePositive(currentPriceKRW)) return undefined;
  return valueKRW / currentPriceKRW;
}

export function estimateAverageCostFromPrincipal(
  principalKRW: number | undefined,
  estimatedQuantity: number | undefined,
  currency: "USD" | "KRW",
  usdKrw?: number,
): number | undefined {
  if (!isFinitePositive(principalKRW) || !isFinitePositive(estimatedQuantity)) return undefined;
  const averageCostKRW = principalKRW / estimatedQuantity;
  if (currency === "KRW") return averageCostKRW;
  if (!isFinitePositive(usdKrw)) return undefined;
  return averageCostKRW / usdKrw;
}

export function getTtmDividendPerShare(
  dividends: Array<{ date: string; amount: number }>,
  asOf = new Date(),
): { amount: number; rows: Array<{ date: string; amount: number }> } {
  const endTime = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
  const startTime = endTime - 365 * DAY_MS;
  const rows = dividends
    .filter((dividend) => {
      const time = Date.parse(`${dividend.date}T00:00:00.000Z`);
      return Number.isFinite(time) && time >= startTime && time <= endTime && isFinitePositive(dividend.amount);
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const amount = rows.reduce((sum, dividend) => sum + dividend.amount, 0);
  return { amount: Number(amount.toFixed(6)), rows };
}


export type SchdGoalProgress = {
  calculable: boolean;
  targetTicker: string;
  targetQty: number;
  actualShares: number;
  equivalentShares?: number;
  achievementPct?: number;
  targetPriceKRW?: number;
  evaluationKRW: number;
  error?: string;
};

export function computeSchdEquivalentGoalProgress(options: {
  targetTicker?: string;
  targetQty: number;
  evaluationKRW: number;
  targetPriceKRW?: number;
  actualShares?: number;
}): SchdGoalProgress {
  const targetTicker = (options.targetTicker ?? "SCHD").trim().toUpperCase() || "SCHD";
  const targetQty = Number.isFinite(options.targetQty) ? options.targetQty : 0;
  const evaluationKRW = Number.isFinite(options.evaluationKRW) ? options.evaluationKRW : 0;
  const actualShares = Math.max(0, Number.isFinite(options.actualShares ?? 0) ? options.actualShares ?? 0 : 0);
  const targetPriceKRW = options.targetPriceKRW;

  if (targetQty <= 0) {
    return { calculable: false, targetTicker, targetQty, actualShares, evaluationKRW, error: "목표 수량이 필요합니다" };
  }
  if (!targetPriceKRW || !Number.isFinite(targetPriceKRW) || targetPriceKRW <= 0) {
    return { calculable: false, targetTicker, targetQty, actualShares, evaluationKRW, error: "목표 종목 현재가 조회 불가" };
  }
  if (!Number.isFinite(evaluationKRW) || evaluationKRW <= 0) {
    return { calculable: false, targetTicker, targetQty, actualShares, targetPriceKRW, evaluationKRW, error: "환산 대상 평가금액 없음" };
  }

  const valueEquivalentShares = evaluationKRW / targetPriceKRW;
  const equivalentShares = Math.max(actualShares, valueEquivalentShares);
  return {
    calculable: true,
    targetTicker,
    targetQty,
    actualShares,
    equivalentShares,
    achievementPct: (equivalentShares / targetQty) * 100,
    targetPriceKRW,
    evaluationKRW,
  };
}

export function buildDividendEstimateForHolding(
  input: DividendEstimateInput,
  marketData: DividendEstimateMarketData,
  options: { afterTax?: boolean; asOf?: Date } = {},
): DividendHoldingEstimate {
  const warnings: DividendEstimateWarning[] = [];
  const currency = inferQuoteCurrency(input.ticker, marketData.quote);
  const taxFactor = options.afterTax ? 0.846 : 1;
  const estimate: DividendHoldingEstimate = {
    currentPriceCurrency: currency,
    dividendMonths: [],
    estimateSource: "value-current-price-ttm-dividends",
    isEstimated: true,
    warnings,
  };

  if (!isUsableQuote(marketData.quote)) {
    warnings.push({
      code: marketData.quote?.source === "sample" ? "quote_sample" : "quote_missing",
      message: `${input.ticker}: 현재가 없음`,
    });
    return estimate;
  }

  estimate.currentPrice = marketData.quote.price;
  estimate.currentPriceCurrency = currency;

  const fxRate = marketData.fx?.rate ?? undefined;
  if (currency === "USD" && !isUsableFx(marketData.fx)) {
    warnings.push({
      code: marketData.fx?.source === "sample" ? "fx_sample" : "fx_missing",
      message: `${input.ticker}: USD/KRW 환율 없음`,
    });
    return estimate;
  }

  estimate.currentPriceKRW = currency === "KRW" ? marketData.quote.price : marketData.quote.price * (fxRate as number);
  estimate.estimatedQuantity = estimateQuantityFromValue(input.valueKRW, estimate.currentPriceKRW);
  if (!estimate.estimatedQuantity) {
    warnings.push({ code: "value_missing", message: `${input.ticker}: 평가금액 기준 추정수량 계산 불가` });
  }

  estimate.estimatedAverageCost = estimateAverageCostFromPrincipal(
    input.principalKRW,
    estimate.estimatedQuantity,
    currency,
    fxRate,
  );
  estimate.estimatedAverageCostCurrency = currency;
  if (input.principalKRW === undefined || input.principalKRW <= 0) {
    warnings.push({ code: "principal_missing", message: `${input.ticker}: 투자원금 없음` });
  }

  const dividendResponse = marketData.dividends;
  if (!dividendResponse || !isUsableDividends(dividendResponse)) {
    const isSampleDividendSource = dividendResponse ? dividendResponse.source === "sample" : false;
    warnings.push({
      code: isSampleDividendSource ? "dividend_sample" : "dividend_missing",
      message: `${input.ticker}: 배당 데이터 없음`,
    });
    return estimate;
  }

  const ttm = getTtmDividendPerShare(dividendResponse.dividends, options.asOf);
  if (!isFinitePositive(ttm.amount)) {
    warnings.push({ code: "dividend_missing", message: `${input.ticker}: 배당 데이터 없음` });
    return estimate;
  }

  estimate.ttmDividendPerShare = ttm.amount;
  estimate.ttmDividendCurrency = currency;

  if (estimate.estimatedQuantity && estimate.currentPriceKRW) {
    const dividendPerShareKRW = currency === "KRW" ? ttm.amount : ttm.amount * (fxRate as number);
    estimate.annualDividendKRW = Math.round(estimate.estimatedQuantity * dividendPerShareKRW * taxFactor);
    const yieldBasis =
      isFinitePositive(input.principalKRW) ? input.principalKRW : isFinitePositive(input.valueKRW) ? input.valueKRW : undefined;
    if (yieldBasis) {
      estimate.personalYieldBasis = yieldBasis === input.principalKRW ? "principal" : "value";
      estimate.personalYieldPct = (estimate.annualDividendKRW / yieldBasis) * 100;
    }
    estimate.dividendMonths = ttm.rows.map((row) => {
      const date = new Date(`${row.date}T00:00:00.000Z`);
      const dividendPerShareKRW = currency === "KRW" ? row.amount : row.amount * (fxRate as number);
      return {
        month: date.getUTCMonth() + 1,
        amountKRW: estimate.estimatedQuantity ? estimate.estimatedQuantity * dividendPerShareKRW * taxFactor : 0,
        source: "dividend-date",
      };
    });
  }

  return estimate;
}

export function buildDividendEstimatesForHoldings(
  inputs: DividendEstimateInput[],
  marketDataByTicker: Record<string, DividendEstimateMarketData>,
  options: { afterTax?: boolean; asOf?: Date } = {},
): Record<string, DividendHoldingEstimate> {
  const estimates: Record<string, DividendHoldingEstimate> = {};
  for (const input of inputs) {
    const ticker = input.ticker.trim().toUpperCase();
    estimates[ticker] = buildDividendEstimateForHolding(input, marketDataByTicker[ticker] ?? {}, options);
  }
  return estimates;
}

export function getUniqueDividendEstimateTickers(inputs: Array<{ ticker?: string }>): string[] {
  return Array.from(
    new Set(
      inputs
        .map((input) => input.ticker?.trim().toUpperCase() ?? "")
        .filter(Boolean),
    ),
  ).sort();
}
