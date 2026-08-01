import { NextResponse } from "next/server";
import { fallbackCurrency, fallbackExchange, resolveMddTicker, type MddMarket } from "@/lib/mdd-market";
import { normalizeTickerText, parseKrxTicker } from "@/lib/krx-ticker";
import { resolveKrxSeriesError } from "@/lib/krx-series-error";
import { hasUsablePricePoints } from "@/lib/price-series-validation";
import type { ResolvedMarketSeries } from "@/lib/portfolio-compare/types";
import { lookupKoreanStockMetadata } from "@/lib/server/korean-stock-metadata";
import { getLongDailySeries } from "@/lib/server/long-series-fetcher";

export const dynamic = "force-dynamic";

const DEFAULT_START = "1970-01-02";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const requestedTicker = params.get("ticker") ?? "";
  const market: MddMarket = params.get("market") === "KR" ? "KR" : "US";
  const start = params.get("start") ?? DEFAULT_START;
  const normalizedRequested = normalizeTickerText(requestedTicker);
  const resolution = market === "US" && normalizedRequested === "KRW=X"
    ? { ok: true as const, requestedTicker: normalizedRequested, candidates: [normalizedRequested] }
    : resolveMddTicker(requestedTicker, market);
  if (!resolution.ok) return NextResponse.json({ error: resolution.error }, { status: 400 });

  const warnings: string[] = [];
  const koreanMetadata = market === "KR" ? await lookupKoreanStockMetadata(resolution.requestedTicker) : null;
  if (koreanMetadata?.status === "not_found") {
    const failure = resolveKrxSeriesError({ requestedTicker: resolution.requestedTicker, metadataStatus: "not_found" });
    return NextResponse.json({ error: failure.error, warnings }, { status: failure.status });
  }

  let candidates = resolution.candidates;
  if (koreanMetadata?.status === "found") {
    const parsed = parseKrxTicker(resolution.requestedTicker)!;
    const metadataSuffix = koreanMetadata.metadata.market === "KOSDAQ" ? "KQ" : "KS";
    if (parsed.suffix && parsed.suffix !== metadataSuffix) {
      return NextResponse.json(
        { error: `${resolution.requestedTicker} 종목을 요청한 .${parsed.suffix} 시장에서 찾을 수 없습니다. 실제 상장 시장은 ${koreanMetadata.metadata.market}입니다.` },
        { status: 404 },
      );
    }
    candidates = [`${parsed.code}.${metadataSuffix}`];
  } else if (koreanMetadata?.status === "unavailable") {
    warnings.push(`한국 시장 메타데이터 조회 실패: ${koreanMetadata.error}`);
  }

  for (const candidate of candidates) {
    const response = await getLongDailySeries({ symbol: candidate, start });
    warnings.push(...response.warnings.map((warning) => `${candidate}: ${warning}`));
    if (response.source !== "yahoo" || !hasUsablePricePoints(response.points)) continue;
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
      name: koreanMetadata?.status === "found" ? koreanMetadata.metadata.stockName : response.metadata?.name || resolvedSymbol,
      market,
      exchange: koreanMetadata?.status === "found" ? koreanMetadata.metadata.market : response.metadata?.exchange || fallbackExchange(resolvedSymbol) || null,
      currency: rawCurrency,
      source: "yahoo",
      points: response.points,
      dataStart: response.points[0].date,
      dataEnd: response.points.at(-1)!.date,
      dividendCount: response.dividends.length,
      warnings,
    };
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" },
    });
  }

  if (market === "KR") {
    const failure = resolveKrxSeriesError({
      requestedTicker: resolution.requestedTicker,
      metadataStatus: koreanMetadata?.status ?? "unavailable",
    });
    return NextResponse.json({ error: failure.error, warnings }, { status: failure.status });
  }

  return NextResponse.json({ error: `${resolution.requestedTicker} 종목을 찾을 수 없습니다.`, warnings }, { status: 404 });
}
