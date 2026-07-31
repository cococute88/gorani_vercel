"use client";

import { computePortfolioComparison, portfolioSeriesKey, resolveUsableSeriesStart } from "@/lib/portfolio-compare/engine";
import type {
  BaseCurrency,
  PortfolioCompareRequest,
  PortfolioCompareResult,
  PortfolioHoldingInput,
  PortfolioMarket,
  PortfolioProxyHolding,
  ResolvedMarketSeries,
  ReturnMode,
} from "@/lib/portfolio-compare/types";
import { validatePortfolioCompareRequest } from "@/lib/portfolio-compare/validation";

const CACHE_TTL_MS = 5 * 60_000;
const HISTORY_START = "1970-01-02";
type CacheEntry = { at: number; promise: Promise<ResolvedMarketSeries> };
const seriesCache = new Map<string, CacheEntry>();

export type PortfolioSeriesLoader = (ticker: string, market: PortfolioMarket) => Promise<ResolvedMarketSeries>;

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

export type VirtualProxyStartRow = {
  id: string;
  requestedTicker: string;
  resolvedSymbol: string | null;
  name: string | null;
  usableStart: string | null;
  warnings: string[];
  error: string | null;
};

export type VirtualProxyStartResolution = {
  autoStart: string | null;
  proxies: VirtualProxyStartRow[];
  warnings: string[];
};

export async function resolveVirtualProxyStarts(
  proxies: PortfolioProxyHolding[],
  returnMode: ReturnMode,
  baseCurrency: BaseCurrency,
  loadSeries: PortfolioSeriesLoader = fetchSeries,
): Promise<VirtualProxyStartResolution> {
  const loaded = await Promise.all(proxies.map(async (proxy) => {
    try {
      return { proxy, series: await loadSeries(proxy.ticker, proxy.market), error: null };
    } catch (error) {
      return { proxy, series: null, error: error instanceof Error ? error.message : String(error) };
    }
  }));
  const needsFx = loaded.some((row) => row.series && row.series.currency !== baseCurrency);
  let fxSeries: ResolvedMarketSeries | null = null;
  let fxError: string | null = null;
  if (needsFx) {
    try {
      fxSeries = await loadSeries("KRW=X", "US");
    } catch (error) {
      fxError = error instanceof Error ? error.message : String(error);
    }
  }
  const rows: VirtualProxyStartRow[] = loaded.map(({ proxy, series, error }) => {
    if (!series) {
      return { id: proxy.id, requestedTicker: proxy.ticker, resolvedSymbol: null, name: null, usableStart: null, warnings: [], error };
    }
    if (series.currency !== baseCurrency && (!fxSeries || fxError)) {
      return {
        id: proxy.id,
        requestedTicker: proxy.ticker,
        resolvedSymbol: series.resolvedSymbol,
        name: series.name,
        usableStart: null,
        warnings: series.warnings,
        error: `USD/KRW 환율 조회 실패: ${fxError || "사용 가능한 환율 시계열이 없습니다."}`,
      };
    }
    try {
      return {
        id: proxy.id,
        requestedTicker: proxy.ticker,
        resolvedSymbol: series.resolvedSymbol,
        name: series.name,
        usableStart: resolveUsableSeriesStart({ series, request: { returnMode, baseCurrency }, fxSeries }),
        warnings: series.warnings,
        error: null,
      };
    } catch (conversionError) {
      return {
        id: proxy.id,
        requestedTicker: proxy.ticker,
        resolvedSymbol: series.resolvedSymbol,
        name: series.name,
        usableStart: null,
        warnings: series.warnings,
        error: conversionError instanceof Error ? conversionError.message : String(conversionError),
      };
    }
  });
  const starts = rows.map((row) => row.usableStart).filter((value): value is string => Boolean(value));
  return {
    autoStart: rows.length > 0 && rows.every((row) => row.usableStart && !row.error) ? starts.sort().at(-1)! : null,
    proxies: rows,
    warnings: Array.from(new Set([
      ...rows.flatMap((row) => row.warnings.map((warning) => `${row.resolvedSymbol || row.requestedTicker}: ${warning}`)),
      ...(fxSeries?.warnings ?? []).map((warning) => `${fxSeries?.resolvedSymbol ?? "KRW=X"}: ${warning}`),
    ])),
  };
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
