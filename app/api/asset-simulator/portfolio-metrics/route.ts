import { NextResponse } from "next/server";

import { fetchYahooChart, normalizeTicker, toIsoDate } from "@/lib/server/quote-fetchers";
import { resolvePortfolioHoldingMetrics } from "@/lib/asset-simulator-portfolio-resolver";
import type { PortfolioResolverSeries } from "@/lib/asset-simulator-portfolio-resolver";
import type {
  PortfolioAccountType,
  PortfolioHoldingResolution,
} from "@/lib/asset-simulator-types";

export const dynamic = "force-dynamic";

// Yahoo's long-range chart payload includes an adjusted-close series that the
// shared quote fetchers do not expose. The resolver needs both raw close (for
// price CAGR / dividends) and adjusted close (for total-return CAGR), so this
// route builds the resolver series in place rather than reusing getQuoteHistory.
type YahooLongSeriesResult = {
  timestamp?: number[];
  indicators?: {
    quote?: Array<{ close?: Array<number | null> }>;
    adjclose?: Array<{ adjclose?: Array<number | null> }>;
  };
  events?: {
    dividends?: Record<string, { amount?: number; date?: number }>;
  };
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseAccountType(value: string | null): PortfolioAccountType | null {
  if (value === "taxSaving" || value === "brokerage") return value;
  return null;
}

async function fetchPortfolioResolverSeries(ticker: string): Promise<PortfolioResolverSeries> {
  const updatedAt = new Date().toISOString();
  try {
    const payload = await fetchYahooChart({ ticker, range: "max", events: "div" });
    const result = (payload.chart?.result?.[0] ?? {}) as YahooLongSeriesResult;
    const timestamps = result.timestamp ?? [];
    const closeSeries = result.indicators?.quote?.[0]?.close ?? [];
    const adjSeries = result.indicators?.adjclose?.[0]?.adjclose ?? [];

    const byDate = new Map<string, { date: string; close: number; adjClose: number | null }>();
    timestamps.forEach((timestamp, index) => {
      const close = closeSeries[index];
      if (!isFiniteNumber(close) || close <= 0) return;
      const adjClose = adjSeries[index];
      const date = toIsoDate(timestamp);
      byDate.set(date, {
        date,
        close: Number(close.toFixed(6)),
        adjClose: isFiniteNumber(adjClose) && adjClose > 0 ? Number(adjClose.toFixed(6)) : null,
      });
    });
    const points = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));

    const dividendEvents = result.events?.dividends ?? {};
    const dividends = Object.values(dividendEvents)
      .flatMap((event) => {
        if (!isFiniteNumber(event.amount) || event.amount <= 0 || !event.date) return [];
        return [{ date: toIsoDate(event.date), amount: Number(event.amount.toFixed(6)) }];
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    if (points.length === 0) {
      return { symbol: ticker, source: "empty", updatedAt, points: [], dividends: [], warnings: ["Yahoo long-series 조회에 유효한 관측값이 없습니다."] };
    }
    return { symbol: ticker, source: "yahoo", updatedAt, points, dividends, warnings: [] };
  } catch (error) {
    return {
      symbol: ticker,
      source: "empty",
      updatedAt,
      points: [],
      dividends: [],
      warnings: [error instanceof Error ? error.message : "Yahoo long-series 조회에 실패했습니다."],
    };
  }
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const ticker = normalizeTicker(searchParams.get("ticker") ?? "");
  const accountType = parseAccountType(searchParams.get("accountType"));

  if (!ticker) {
    return NextResponse.json({ error: "ticker is required" }, { status: 400 });
  }
  if (!accountType) {
    return NextResponse.json({ error: "accountType must be taxSaving or brokerage" }, { status: 400 });
  }

  const series = await fetchPortfolioResolverSeries(ticker);
  const resolution: PortfolioHoldingResolution = resolvePortfolioHoldingMetrics(
    { ticker, accountType },
    series,
  );

  return NextResponse.json({ ticker, accountType, seriesSource: series.source, resolution });
}
