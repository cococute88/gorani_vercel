"use client";

import { computePortfolioComparison, portfolioSeriesKey } from "@/lib/portfolio-compare/engine";
import type {
  PortfolioCompareRequest,
  PortfolioCompareResult,
  PortfolioHoldingInput,
  PortfolioMarket,
  ResolvedMarketSeries,
} from "@/lib/portfolio-compare/types";
import { validatePortfolioCompareRequest } from "@/lib/portfolio-compare/validation";

const CACHE_TTL_MS = 5 * 60_000;
const HISTORY_START = "1970-01-02";
type CacheEntry = { at: number; promise: Promise<ResolvedMarketSeries> };
const seriesCache = new Map<string, CacheEntry>();

function fetchSeries(ticker: string, market: PortfolioMarket): Promise<ResolvedMarketSeries> {
  const key = portfolioSeriesKey(market, ticker);
  const cached = seriesCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.promise;
  const promise = (async () => {
    const response = await fetch(
      `/api/calculator/portfolio-compare-series?ticker=${encodeURIComponent(ticker)}&market=${market}&start=${HISTORY_START}`,
    );
    const payload = await response.json() as ResolvedMarketSeries & { error?: string; warnings?: string[] };
    if (!response.ok) {
      const detail = payload.warnings?.length ? ` ${payload.warnings.join(" ")}` : "";
      throw new Error(`${payload.error || `HTTP ${response.status}`}${detail}`);
    }
    return payload;
  })();
  promise.catch(() => seriesCache.delete(key));
  seriesCache.set(key, { at: Date.now(), promise });
  return promise;
}

function collectHoldings(request: PortfolioCompareRequest): PortfolioHoldingInput[] {
  const holdings = [...request.portfolioA.holdings, ...request.portfolioB.holdings];
  if (request.analysisMode === "virtual") {
    for (const holding of [...holdings]) {
      if (holding.virtual?.enabled) holdings.push(...holding.virtual.proxies.map((proxy) => ({ ...proxy })));
    }
  }
  return holdings;
}

export async function analyzePortfolioComparison(request: PortfolioCompareRequest): Promise<PortfolioCompareResult> {
  const validation = validatePortfolioCompareRequest(request);
  if (validation.length) throw new Error(validation.join("\n"));

  const holdings = collectHoldings(request);
  const unique = new Map<string, PortfolioHoldingInput>();
  for (const holding of holdings) unique.set(portfolioSeriesKey(holding.market, holding.ticker), holding);
  const loaded = await Promise.all(
    Array.from(unique.entries()).map(async ([key, holding]) => [key, await fetchSeries(holding.ticker, holding.market)] as const),
  );
  const seriesByKey = new Map<string, ResolvedMarketSeries>(loaded);
  const needsFx = Array.from(seriesByKey.values()).some((series) => series.currency !== request.baseCurrency);
  const fxSeries = needsFx ? await fetchSeries("KRW=X", "US") : null;
  return computePortfolioComparison({ request, seriesByKey, fxSeries });
}
