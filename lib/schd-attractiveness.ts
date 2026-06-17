import type { QuoteDividendsResponse, QuoteHistoryResponse, QuoteLastResponse } from "@/lib/quote-types";

export const SCHD_TICKER = "SCHD";
export const SCHD_TARGET_YIELDS = [0.035, 0.036, 0.037, 0.038] as const;
export const SCHD_SEEKING_ALPHA_URL = "https://seekingalpha.com/symbol/SCHD/dividends/yield";

export type SchdRangeKey = "1M" | "6M" | "1Y" | "5Y" | "10Y";
export const SCHD_RANGE_OPTIONS: SchdRangeKey[] = ["1M", "6M", "1Y", "5Y", "10Y"];

export type SchdYieldPoint = {
  date: string;
  price: number;
  high: number | null;
  ttmDividend: number | null;
  ttmYield: number | null;
  ttmYieldRaw: number | null;
};

export type SchdTargetPriceRow = {
  targetYield: string;
  ttmBuyPrice: number | null;
  quarterBuyPrice: number | null;
  drawdownPct: number | null;
};

export type SchdAttractivenessMetrics = {
  points: SchdYieldPoint[];
  latestDate: string;
  currentPrice: number;
  currentTtmYield: number;
  high52w: number | null;
  drawdownFrom52wHighPct: number | null;
  fiveYearAverageYield: number | null;
  latestFourDividend: number;
  recentQuarterDividend: number | null;
  targetRows: SchdTargetPriceRow[];
  fetchedAt?: string;
  warnings: string[];
};

function parseDateMs(date: string) {
  const ms = new Date(`${date}T00:00:00Z`).getTime();
  return Number.isFinite(ms) ? ms : NaN;
}

function isFinitePositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function normalizeDate(date: string) {
  return date.slice(0, 10);
}

// Port of original/pages_app/8_attractiveness_score.py:
// _calculate_latest_four_dividend_sum counts exactly the latest four dividend
// events as of each price date instead of a rolling 365-day sum, preventing a
// temporary five-dividend spike around ex-dividend dates.
export function calculateLatestFourDividendSum(
  priceDates: string[],
  dividends: Array<{ date: string; amount: number }>,
): Array<number | null> {
  const cleanDividends = dividends
    .map((dividend) => ({ date: normalizeDate(dividend.date), ms: parseDateMs(dividend.date), amount: Number(dividend.amount) }))
    .filter((dividend) => Number.isFinite(dividend.ms) && isFinitePositive(dividend.amount))
    .sort((a, b) => a.ms - b.ms);

  if (cleanDividends.length < 4) return priceDates.map(() => null);

  const cumulative = [0];
  for (const dividend of cleanDividends) cumulative.push(cumulative[cumulative.length - 1] + dividend.amount);
  const dividendTimes = cleanDividends.map((dividend) => dividend.ms);

  return priceDates.map((date) => {
    const priceMs = parseDateMs(date);
    if (!Number.isFinite(priceMs)) return null;
    let right = 0;
    while (right < dividendTimes.length && dividendTimes[right] <= priceMs) right += 1;
    if (right < 4) return null;
    return cumulative[right] - cumulative[right - 4];
  });
}

export function getSchdAssessment(ttmYield: number | null | undefined) {
  if (!Number.isFinite(ttmYield ?? NaN)) return { label: "계산 대기", tone: "neutral" as const };
  if ((ttmYield as number) < 3.4) return { label: "🟥 비싸요", tone: "expensive" as const };
  if ((ttmYield as number) < 3.5) return { label: "🟧 진입고려", tone: "watch" as const };
  if ((ttmYield as number) < 3.6) return { label: "🟨 진입OK", tone: "ok" as const };
  if ((ttmYield as number) < 3.7) return { label: "🟩 매수GO", tone: "good" as const };
  if ((ttmYield as number) < 3.8) return { label: "💚 매수가자", tone: "strong" as const };
  return { label: "💚 강함", tone: "strong" as const };
}

export function calculateSchdAttractiveness(
  history: QuoteHistoryResponse,
  dividendsResponse: QuoteDividendsResponse,
  last?: QuoteLastResponse,
): SchdAttractivenessMetrics | null {
  if (history.source === "sample" || dividendsResponse.source === "sample" || last?.source === "sample") return null;

  const prices = history.prices
    .map((price) => ({ date: normalizeDate(price.date), price: Number(price.close), high: price.high == null ? null : Number(price.high) }))
    .filter((price) => Number.isFinite(parseDateMs(price.date)) && isFinitePositive(price.price))
    .sort((a, b) => parseDateMs(a.date) - parseDateMs(b.date));

  const dividends = dividendsResponse.dividends
    .map((dividend) => ({ date: normalizeDate(dividend.date), amount: Number(dividend.amount) }))
    .filter((dividend) => Number.isFinite(parseDateMs(dividend.date)) && isFinitePositive(dividend.amount))
    .sort((a, b) => parseDateMs(a.date) - parseDateMs(b.date));

  if (prices.length === 0 || dividends.length < 4) return null;

  const priceDates = prices.map((price) => price.date);
  const ttmDividends = calculateLatestFourDividendSum(priceDates, dividends);
  const points = prices.map((price, index) => {
    const ttmDividend = ttmDividends[index];
    const rawYield = isFinitePositive(ttmDividend) ? (ttmDividend / price.price) * 100 : null;
    const cleanYield = rawYield != null && rawYield >= 1.0 && rawYield <= 8.0 ? rawYield : null;
    return { date: price.date, price: price.price, high: Number.isFinite(price.high ?? NaN) ? price.high : null, ttmDividend, ttmYield: cleanYield, ttmYieldRaw: rawYield };
  });

  const valid = points.filter((point) => isFinitePositive(point.price) && isFinitePositive(point.ttmDividend) && Number.isFinite(point.ttmYield ?? NaN));
  if (valid.length === 0) return null;

  const latest = valid[valid.length - 1];
  const currentPrice = isFinitePositive(last?.price) ? last.price : latest.price;
  const latestDateMs = parseDateMs(latest.date);
  const oneYearAgoMs = latestDateMs - 365 * 24 * 60 * 60 * 1000;
  const last52w = prices.filter((price) => parseDateMs(price.date) >= oneYearAgoMs);
  const high52wValue = Math.max(...last52w.map((price) => (isFinitePositive(price.high) ? price.high : price.price)).filter(isFinitePositive));
  const high52w = isFinitePositive(high52wValue) ? high52wValue : null;
  const drawdownFrom52wHighPct = high52w ? (currentPrice / high52w - 1) * 100 : null;

  const fiveYearAgoMs = latestDateMs - 5 * 365.25 * 24 * 60 * 60 * 1000;
  const fiveYearYields = valid.map((point) => ({ ms: parseDateMs(point.date), value: point.ttmYield })).filter((point) => point.ms >= fiveYearAgoMs && Number.isFinite(point.value ?? NaN));
  const fiveYearAverageYield = fiveYearYields.length ? fiveYearYields.reduce((sum, point) => sum + (point.value ?? 0), 0) / fiveYearYields.length : null;
  const recentQuarterDividend = dividends.length ? dividends[dividends.length - 1].amount : null;

  const targetRows = SCHD_TARGET_YIELDS.map((targetYield) => {
    const ttmBuyPrice = latest.ttmDividend && latest.ttmDividend > 0 ? latest.ttmDividend / targetYield : null;
    const quarterBuyPrice = recentQuarterDividend && recentQuarterDividend > 0 ? (recentQuarterDividend * 4) / targetYield : null;
    return {
      targetYield: `${(targetYield * 100).toFixed(1)}%`,
      ttmBuyPrice,
      quarterBuyPrice,
      drawdownPct: ttmBuyPrice && currentPrice > 0 ? (ttmBuyPrice / currentPrice - 1) * 100 : null,
    };
  });

  return {
    points,
    latestDate: latest.date,
    currentPrice,
    currentTtmYield: latest.ttmYield ?? NaN,
    high52w,
    drawdownFrom52wHighPct,
    fiveYearAverageYield,
    latestFourDividend: latest.ttmDividend ?? NaN,
    recentQuarterDividend,
    targetRows,
    fetchedAt: history.updatedAt || dividendsResponse.updatedAt || last?.updatedAt,
    warnings: [...(history.warnings ?? []), ...(dividendsResponse.warnings ?? []), ...(last?.warnings ?? [])],
  };
}

export function filterSchdRange(points: SchdYieldPoint[], range: SchdRangeKey) {
  if (!points.length) return points;
  const latestMs = parseDateMs(points[points.length - 1].date);
  const daysByRange: Record<SchdRangeKey, number> = { "1M": 31, "6M": 183, "1Y": 365, "5Y": 365 * 5, "10Y": 365 * 10 };
  const startMs = latestMs - daysByRange[range] * 24 * 60 * 60 * 1000;
  return points.filter((point) => parseDateMs(point.date) >= startMs);
}
