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

// One row per dividend event for the "최근 배당금 히스토리" table.
export type SchdDividendHistoryRow = {
  date: string;        // ex-dividend date (YYYY-MM-DD)
  year: number;
  quarter: number;     // 1-4 calendar quarter
  amount: number;      // actual paid dividend amount
  yoyPct: number | null; // vs same quarter previous year ("-" when no base)
};

// One row per calendar year for the "배당성장률 히스토리" table.
export type SchdDividendGrowthRow = {
  year: number;
  payout: number;          // sum of dividends paid in the year
  count: number;           // number of dividend events in the year
  complete: boolean;       // whether the year has a full set of payments
  yearEndYield: number | null;   // payout / year-end close * 100
  annualGrowthPct: number | null; // YoY growth vs previous calendar year
  cagrPct: number | null;        // compound annual growth rate from base year
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
  latestFourDividends: number[]; // individual amounts, oldest → newest
  recentQuarterDividend: number | null;
  targetRows: SchdTargetPriceRow[];
  dividendHistory: SchdDividendHistoryRow[];     // latest first
  dividendGrowthHistory: SchdDividendGrowthRow[]; // latest first
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

function getYearQuarter(date: string): { year: number; quarter: number } | null {
  const d = new Date(`${normalizeDate(date)}T00:00:00Z`);
  const ms = d.getTime();
  if (!Number.isFinite(ms)) return null;
  return { year: d.getUTCFullYear(), quarter: Math.floor(d.getUTCMonth() / 3) + 1 };
}

// Most frequent value in a list (used to infer the typical payments-per-year).
function mostFrequent(values: number[], fallback: number): number {
  if (!values.length) return fallback;
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best = fallback;
  let bestCount = -1;
  Array.from(counts.entries()).forEach(([value, count]) => {
    if (count > bestCount || (count === bestCount && value > best)) {
      best = value;
      bestCount = count;
    }
  });
  return best;
}

// Builds the per-event dividend history with YoY (vs same calendar quarter of
// the previous year) and the per-year dividend growth history (payout, year-end
// yield, annual growth, and compound annual growth rate from the first full year).
export function buildSchdDividendHistories(
  dividends: Array<{ date: string; amount: number }>,
  prices: Array<{ date: string; price: number }>,
): { history: SchdDividendHistoryRow[]; growth: SchdDividendGrowthRow[] } {
  // Sum per (year, quarter) so the YoY base is robust to occasional special payments.
  const quarterSum = new Map<string, number>();
  for (const dividend of dividends) {
    const yq = getYearQuarter(dividend.date);
    if (!yq) continue;
    const key = `${yq.year}-${yq.quarter}`;
    quarterSum.set(key, (quarterSum.get(key) ?? 0) + dividend.amount);
  }

  const historyAsc: SchdDividendHistoryRow[] = [];
  for (const dividend of dividends) {
    const yq = getYearQuarter(dividend.date);
    if (!yq) continue;
    const prior = quarterSum.get(`${yq.year - 1}-${yq.quarter}`);
    const yoyPct = isFinitePositive(prior) ? (dividend.amount / prior - 1) * 100 : null;
    historyAsc.push({ date: dividend.date, year: yq.year, quarter: yq.quarter, amount: dividend.amount, yoyPct });
  }

  // Year-end close: prices are ascending, so the last entry per year wins.
  const yearEndClose = new Map<number, number>();
  for (const price of prices) {
    const year = getYearQuarter(price.date)?.year;
    if (year != null && isFinitePositive(price.price)) yearEndClose.set(year, price.price);
  }

  // Aggregate payout + payment count per calendar year.
  const yearAgg = new Map<number, { payout: number; count: number }>();
  for (const dividend of dividends) {
    const year = getYearQuarter(dividend.date)?.year;
    if (year == null) continue;
    const current = yearAgg.get(year) ?? { payout: 0, count: 0 };
    current.payout += dividend.amount;
    current.count += 1;
    yearAgg.set(year, current);
  }

  const typicalCount = mostFrequent(Array.from(yearAgg.values()).map((entry) => entry.count), 4);
  const yearsAsc = Array.from(yearAgg.keys()).sort((a, b) => a - b);

  const growthAsc: SchdDividendGrowthRow[] = yearsAsc.map((year) => {
    const agg = yearAgg.get(year)!;
    const complete = agg.count >= typicalCount;
    const yearEnd = yearEndClose.get(year);
    const yearEndYield = complete && isFinitePositive(yearEnd) ? (agg.payout / yearEnd) * 100 : null;
    return { year, payout: agg.payout, count: agg.count, complete, yearEndYield, annualGrowthPct: null, cagrPct: null };
  });

  const baseRow = growthAsc.find((row) => row.complete);
  const byYear = new Map(growthAsc.map((row) => [row.year, row]));
  for (const row of growthAsc) {
    if (!row.complete) continue;
    const prev = byYear.get(row.year - 1);
    if (prev && prev.complete && isFinitePositive(prev.payout)) {
      row.annualGrowthPct = (row.payout / prev.payout - 1) * 100;
    }
    if (baseRow && baseRow.year < row.year && isFinitePositive(baseRow.payout)) {
      const span = row.year - baseRow.year;
      row.cagrPct = (Math.pow(row.payout / baseRow.payout, 1 / span) - 1) * 100;
    }
  }

  return {
    history: historyAsc.reverse(),
    growth: growthAsc.reverse(),
  };
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
  const latestFourDividends = dividends.slice(-4).map((dividend) => dividend.amount);
  const { history: dividendHistory, growth: dividendGrowthHistory } = buildSchdDividendHistories(dividends, prices);

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
    latestFourDividends,
    recentQuarterDividend,
    targetRows,
    dividendHistory,
    dividendGrowthHistory,
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
