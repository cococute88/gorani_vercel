import { normalizePortfolioTicker } from "./asset-simulator-portfolio";
import type {
  PortfolioAccountType,
  PortfolioHoldingResolution,
  PortfolioMetricSource,
  ResolvedPortfolioMetric,
  ResolvePortfolioHoldingInput,
} from "./asset-simulator-types";

const DAY_MS = 86_400_000;

export const DEFAULT_PORTFOLIO_RESOLVER_POLICY = {
  targetCagrYears: 10,
  minimumCagrYears: 5,
  targetDividendYearCount: 5,
  minimumDividendYearCount: 3,
} as const;

export type PortfolioResolverPolicy = {
  targetCagrYears: number;
  minimumCagrYears: number;
  targetDividendYearCount: number;
  minimumDividendYearCount: number;
};

export type PortfolioResolverSeries = {
  symbol: string;
  source: "yahoo" | "empty" | "sample";
  updatedAt: string;
  points: Array<{ date: string; close: number; adjClose: number | null }>;
  dividends: Array<{ date: string; amount: number }>;
  warnings: string[];
};

const LEVERAGED_ETF_TICKERS = new Set(["QLD", "TQQQ", "SSO", "UPRO"]);
const LEVERAGED_ETF_WARNING = "레버리지 ETF는 과거 CAGR을 장기 기대수익률로 그대로 쓰기 어렵습니다.";
const MANUAL_FALLBACK_WARNING = "관측 이력이 짧아 자동 계산할 수 없습니다. 수동 fallback 값을 입력해야 합니다.";
const SHORT_HISTORY_WARNING = "10년 이력이 없어 상장 이후 관측 구간으로 계산했습니다.";
const SHORT_DIVIDEND_HISTORY_WARNING = "5개 완전연도 이력이 없어 최근 3개 완전연도 구간으로 계산했습니다.";
const DIVIDEND_LIMITATION_WARNING = "특별배당과 배당 감액은 별도로 조정하지 않은 단순 연도 합계 기준입니다.";

function round(value: number, digits = 4): number {
  return Number(value.toFixed(digits));
}

function parseDate(date: string): number {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? Date.parse(`${date}T00:00:00.000Z`) : Number.NaN;
}

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function uniqueWarnings(warnings: string[]): string[] {
  return Array.from(new Set(warnings.filter(Boolean)));
}

function metric(
  source: PortfolioMetricSource,
  overrides: Partial<ResolvedPortfolioMetric> = {},
): ResolvedPortfolioMetric {
  const { warnings = [], ...rest } = overrides;
  return {
    valuePct: null,
    source,
    status: "failed",
    asOf: null,
    periodStart: null,
    periodEnd: null,
    observationYears: null,
    ...rest,
    warnings: uniqueWarnings(warnings),
  };
}

function failureResolution(ticker: string, warnings: string[]): PortfolioHoldingResolution {
  const shared = uniqueWarnings(warnings);
  return {
    ticker,
    totalReturnCagr: metric("yahoo-adj-close", { warnings: shared }),
    priceCagr: metric("yahoo-close", { warnings: shared }),
    dividendYield: metric("yahoo-dividends", { warnings: shared }),
    dividendGrowth: metric("yahoo-dividends", { warnings: shared }),
  };
}

function notApplicable(source: PortfolioMetricSource, warning: string, sharedWarnings: string[]): ResolvedPortfolioMetric {
  return metric(source, {
    status: "not_applicable",
    warnings: [...sharedWarnings, warning],
  });
}

function cleanLevels(
  points: PortfolioResolverSeries["points"],
  key: "close" | "adjClose",
): Array<{ date: string; value: number; ms: number }> {
  const byDate = new Map<string, { date: string; value: number; ms: number }>();
  for (const point of points) {
    const value = point[key];
    const ms = parseDate(point.date);
    if (typeof value === "number" && Number.isFinite(value) && value > 0 && Number.isFinite(ms)) {
      byDate.set(point.date, { date: point.date, value, ms });
    }
  }
  return Array.from(byDate.values()).sort((a, b) => a.ms - b.ms);
}

function resolveCagr(
  levels: Array<{ date: string; value: number; ms: number }>,
  source: "yahoo-adj-close" | "yahoo-close",
  policy: PortfolioResolverPolicy,
  sharedWarnings: string[],
): ResolvedPortfolioMetric {
  if (levels.length < 2) {
    return metric(source, { warnings: [...sharedWarnings, `${source} 시계열에 유효한 관측값이 없습니다.`] });
  }

  const firstAvailable = levels[0];
  const last = levels[levels.length - 1];
  const availableYears = (last.ms - firstAvailable.ms) / (365.25 * DAY_MS);
  if (availableYears < policy.minimumCagrYears) {
    return metric(source, {
      status: "insufficient_history",
      asOf: last.date,
      periodStart: firstAvailable.date,
      periodEnd: last.date,
      observationYears: round(Math.max(0, availableYears)),
      warnings: [...sharedWarnings, MANUAL_FALLBACK_WARNING],
    });
  }

  let first = firstAvailable;
  const warnings = [...sharedWarnings];
  if (availableYears >= policy.targetCagrYears) {
    const cutoff = last.ms - policy.targetCagrYears * 365.25 * DAY_MS;
    first = levels.find((level) => level.ms >= cutoff) ?? firstAvailable;
  } else {
    warnings.push(SHORT_HISTORY_WARNING);
  }

  const observationYears = (last.ms - first.ms) / (365.25 * DAY_MS);
  const ratio = last.value / first.value;
  const valuePct = ratio > 0 && observationYears > 0
    ? round((Math.pow(ratio, 1 / observationYears) - 1) * 100)
    : null;
  if (valuePct === null || !Number.isFinite(valuePct)) {
    return metric(source, { warnings: [...warnings, "CAGR 계산에 사용할 수 없는 가격 비율입니다."] });
  }

  return metric(source, {
    valuePct,
    status: "resolved",
    asOf: last.date,
    periodStart: first.date,
    periodEnd: last.date,
    observationYears: round(observationYears),
    warnings,
  });
}

function cleanDividends(dividends: PortfolioResolverSeries["dividends"]) {
  return dividends
    .map((dividend) => ({ ...dividend, ms: parseDate(dividend.date) }))
    .filter((dividend) => Number.isFinite(dividend.ms) && Number.isFinite(dividend.amount) && dividend.amount > 0)
    .sort((a, b) => a.ms - b.ms);
}

function resolveDividendYield(
  dividends: ReturnType<typeof cleanDividends>,
  latestClose: { date: string; value: number; ms: number },
  sharedWarnings: string[],
): ResolvedPortfolioMetric {
  if (dividends.length === 0) {
    return metric("yahoo-dividends", {
      valuePct: 0,
      status: "not_applicable",
      asOf: latestClose.date,
      periodStart: isoDate(latestClose.ms - 365 * DAY_MS),
      periodEnd: latestClose.date,
      observationYears: 1,
      warnings: [...sharedWarnings, "Yahoo 배당 이벤트가 없어 무배당 자산으로 처리했습니다."],
    });
  }

  const startMs = latestClose.ms - 365 * DAY_MS;
  const ttmAmount = dividends
    .filter((dividend) => dividend.ms >= startMs && dividend.ms <= latestClose.ms)
    .reduce((sum, dividend) => sum + dividend.amount, 0);
  if (!(ttmAmount > 0)) {
    return metric("yahoo-dividends", {
      valuePct: 0,
      status: "not_applicable",
      asOf: latestClose.date,
      periodStart: isoDate(startMs),
      periodEnd: latestClose.date,
      observationYears: 1,
      warnings: [...sharedWarnings, "최근 365일 배당 이벤트가 없어 현재 TTM 배당률을 적용할 수 없습니다."],
    });
  }

  return metric("yahoo-dividends", {
    valuePct: round((ttmAmount / latestClose.value) * 100),
    status: "resolved",
    asOf: latestClose.date,
    periodStart: isoDate(startMs),
    periodEnd: latestClose.date,
    observationYears: 1,
    warnings: sharedWarnings,
  });
}

function resolveDividendGrowth(
  dividends: ReturnType<typeof cleanDividends>,
  latestClose: { date: string; value: number; ms: number },
  policy: PortfolioResolverPolicy,
  sharedWarnings: string[],
): ResolvedPortfolioMetric {
  if (dividends.length === 0) {
    return metric("yahoo-dividends", {
      valuePct: 0,
      status: "not_applicable",
      asOf: latestClose.date,
      warnings: [...sharedWarnings, "Yahoo 배당 이벤트가 없어 무배당 자산으로 처리했습니다."],
    });
  }

  const currentYear = Number(latestClose.date.slice(0, 4));
  const totals = new Map<number, number>();
  for (const dividend of dividends) {
    const year = Number(dividend.date.slice(0, 4));
    if (Number.isInteger(year) && year < currentYear && dividend.ms <= latestClose.ms) {
      totals.set(year, (totals.get(year) ?? 0) + dividend.amount);
    }
  }
  const annual: Array<{ year: number; amount: number }> = [];
  for (let year = currentYear - 1; totals.has(year); year -= 1) {
    const amount = totals.get(year) ?? 0;
    if (!(amount > 0)) break;
    annual.unshift({ year, amount });
  }

  const requestedCount = annual.length >= policy.targetDividendYearCount
    ? policy.targetDividendYearCount
    : annual.length >= policy.minimumDividendYearCount
      ? policy.minimumDividendYearCount
      : 0;
  if (requestedCount === 0) {
    return metric("yahoo-dividends", {
      status: "insufficient_history",
      asOf: latestClose.date,
      periodStart: annual.length ? `${annual[0].year}-01-01` : null,
      periodEnd: annual.length ? `${annual[annual.length - 1].year}-12-31` : null,
      observationYears: annual.length >= 2 ? annual[annual.length - 1].year - annual[0].year : 0,
      warnings: [...sharedWarnings, MANUAL_FALLBACK_WARNING, DIVIDEND_LIMITATION_WARNING],
    });
  }

  const window = annual.slice(-requestedCount);
  const first = window[0];
  const last = window[window.length - 1];
  const observationYears = last.year - first.year;
  const ratio = last.amount / first.amount;
  const valuePct = ratio > 0 && observationYears > 0
    ? round((Math.pow(ratio, 1 / observationYears) - 1) * 100)
    : null;
  if (valuePct === null || !Number.isFinite(valuePct)) {
    return metric("yahoo-dividends", {
      warnings: [...sharedWarnings, "배당성장률 계산에 사용할 수 없는 연도별 배당 합계입니다.", DIVIDEND_LIMITATION_WARNING],
    });
  }

  return metric("yahoo-dividends", {
    valuePct,
    status: "resolved",
    asOf: latestClose.date,
    periodStart: `${first.year}-01-01`,
    periodEnd: `${last.year}-12-31`,
    observationYears,
    warnings: [
      ...sharedWarnings,
      ...(requestedCount < policy.targetDividendYearCount ? [SHORT_DIVIDEND_HISTORY_WARNING] : []),
      DIVIDEND_LIMITATION_WARNING,
    ],
  });
}

function accountNotApplicable(
  accountType: PortfolioAccountType,
  sharedWarnings: string[],
): Pick<PortfolioHoldingResolution, "totalReturnCagr" | "priceCagr" | "dividendYield" | "dividendGrowth"> {
  if (accountType === "taxSaving") {
    return {
      totalReturnCagr: metric("yahoo-adj-close"),
      priceCagr: notApplicable("yahoo-close", "절세계좌에는 가격 CAGR을 적용하지 않습니다.", sharedWarnings),
      dividendYield: notApplicable("yahoo-dividends", "절세계좌에는 배당률을 별도 적용하지 않습니다.", sharedWarnings),
      dividendGrowth: notApplicable("yahoo-dividends", "절세계좌에는 배당성장률을 별도 적용하지 않습니다.", sharedWarnings),
    };
  }
  return {
    totalReturnCagr: notApplicable("yahoo-adj-close", "위탁계좌에는 total-return CAGR을 적용하지 않습니다.", sharedWarnings),
    priceCagr: metric("yahoo-close"),
    dividendYield: metric("yahoo-dividends"),
    dividendGrowth: metric("yahoo-dividends"),
  };
}

export function resolvePortfolioHoldingMetrics(
  input: ResolvePortfolioHoldingInput,
  series: PortfolioResolverSeries,
  policy: PortfolioResolverPolicy = DEFAULT_PORTFOLIO_RESOLVER_POLICY,
): PortfolioHoldingResolution {
  const ticker = normalizePortfolioTicker(input.ticker);
  const leverageWarnings = LEVERAGED_ETF_TICKERS.has(ticker) ? [LEVERAGED_ETF_WARNING] : [];
  if (!ticker) return failureResolution("", ["티커를 입력해야 합니다."]);
  if (series.source !== "yahoo") {
    const sourceWarning = series.source === "sample"
      ? "sample fallback은 포트폴리오 metric의 성공 데이터로 인정하지 않습니다."
      : "Yahoo long-series 조회에 실패했습니다.";
    return failureResolution(ticker, [...leverageWarnings, sourceWarning, ...(series.warnings ?? [])]);
  }

  const closeLevels = cleanLevels(series.points, "close");
  if (closeLevels.length === 0) {
    return failureResolution(ticker, [...leverageWarnings, "Yahoo close 시계열에 유효한 관측값이 없습니다.", ...(series.warnings ?? [])]);
  }

  const sharedWarnings = uniqueWarnings([...leverageWarnings, ...(series.warnings ?? [])]);
  const result = accountNotApplicable(input.accountType, sharedWarnings);
  if (input.accountType === "taxSaving") {
    result.totalReturnCagr = resolveCagr(cleanLevels(series.points, "adjClose"), "yahoo-adj-close", policy, sharedWarnings);
  } else {
    const latestClose = closeLevels[closeLevels.length - 1];
    const dividends = cleanDividends(series.dividends);
    result.priceCagr = resolveCagr(closeLevels, "yahoo-close", policy, sharedWarnings);
    result.dividendYield = resolveDividendYield(dividends, latestClose, sharedWarnings);
    result.dividendGrowth = resolveDividendGrowth(dividends, latestClose, policy, sharedWarnings);
  }

  return { ticker, ...result };
}
