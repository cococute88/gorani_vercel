"use client";

import { normalizeTickerText } from "@/lib/krx-ticker";
import { hasUsablePricePoints } from "@/lib/price-series-validation";
import type { PortfolioMarket, ResolvedMarketSeries } from "@/lib/portfolio-compare/types";

const CACHE_TTL_MS = 5 * 60_000;
const HISTORY_START = "1970-01-02";
type CacheEntry = { at: number; promise: Promise<ResolvedMarketSeries> };
const seriesCache = new Map<string, CacheEntry>();

export function resolvedMarketSeriesCacheKey(market: PortfolioMarket, ticker: string): string {
  return `${market}:${normalizeTickerText(ticker)}`;
}

export function fetchResolvedMarketSeries(ticker: string, market: PortfolioMarket): Promise<ResolvedMarketSeries> {
  const normalizedTicker = normalizeTickerText(ticker);
  const key = resolvedMarketSeriesCacheKey(market, normalizedTicker);
  const cached = seriesCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.promise;

  const promise = (async () => {
    const response = await fetch(
      `/api/calculator/portfolio-compare-series?ticker=${encodeURIComponent(normalizedTicker)}&market=${market}&start=${HISTORY_START}`,
    );
    const payload = await response.json() as ResolvedMarketSeries & { error?: string; warnings?: string[] };
    if (!response.ok) {
      const detail = payload.warnings?.length ? ` ${payload.warnings.join(" ")}` : "";
      throw new Error(`${payload.error || `HTTP ${response.status}`}${detail}`);
    }
    if (!hasUsablePricePoints(payload.points)) {
      throw new Error(`${normalizedTicker}의 가격 데이터가 비어 있거나 유효한 양수 가격이 부족합니다.`);
    }
    return payload;
  })();
  promise.catch(() => seriesCache.delete(key));
  seriesCache.set(key, { at: Date.now(), promise });
  return promise;
}
