import { NextResponse } from "next/server";
import { fallbackCurrency, fallbackExchange, resolveMddTicker, type MddMarket } from "@/lib/mdd-market";
import type { ResolvedMarketSeries } from "@/lib/portfolio-compare/types";
import { getLongDailySeries } from "@/lib/server/long-series-fetcher";

export const dynamic = "force-dynamic";

const DEFAULT_START = "1970-01-02";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const requestedTicker = params.get("ticker") ?? "";
  const market: MddMarket = params.get("market") === "KR" ? "KR" : "US";
  const start = params.get("start") ?? DEFAULT_START;
  const normalizedRequested = requestedTicker.trim().replace(/\s+/g, "").toUpperCase();
  const resolution = market === "US" && normalizedRequested === "KRW=X"
    ? { ok: true as const, requestedTicker: normalizedRequested, candidates: [normalizedRequested] }
    : resolveMddTicker(requestedTicker, market);
  if (!resolution.ok) return NextResponse.json({ error: resolution.error }, { status: 400 });

  const warnings: string[] = [];
  for (const candidate of resolution.candidates) {
    const response = await getLongDailySeries({ symbol: candidate, start });
    warnings.push(...response.warnings.map((warning) => `${candidate}: ${warning}`));
    if (response.source !== "yahoo" || response.points.length < 2) continue;
    const resolvedSymbol = response.metadata?.symbol || response.symbol || candidate;
    const rawCurrency = response.metadata?.currency || fallbackCurrency(resolvedSymbol, market);
    if (rawCurrency !== "USD" && rawCurrency !== "KRW") {
      return NextResponse.json(
        { error: `${resolvedSymbol}의 통화(${rawCurrency})는 현재 지원하지 않습니다.` },
        { status: 422 },
      );
    }
    const payload: ResolvedMarketSeries = {
      requestedTicker: resolution.requestedTicker,
      resolvedSymbol,
      name: response.metadata?.name || resolvedSymbol,
      market,
      exchange: response.metadata?.exchange || fallbackExchange(resolvedSymbol) || null,
      currency: rawCurrency,
      source: "yahoo",
      points: response.points,
      dataStart: response.points[0].date,
      dataEnd: response.points.at(-1)!.date,
      warnings,
    };
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" },
    });
  }

  return NextResponse.json(
    {
      error: `${resolution.requestedTicker}의 실제 Yahoo 일별 시세를 찾을 수 없습니다.`,
      warnings,
    },
    { status: 404 },
  );
}
