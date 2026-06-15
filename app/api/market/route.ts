import { NextResponse } from "next/server";
import { buildMarketPayload } from "@/lib/server/market-fetchers";
import type { MarketRange } from "@/lib/market-data";

export const dynamic = "force-dynamic";

const ranges = new Set(["6개월", "1년", "3년", "5년", "전체"]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requested = searchParams.get("range") ?? "1년";
  const range = (ranges.has(requested) ? requested : "1년") as MarketRange;
  try {
    return NextResponse.json(await buildMarketPayload(range));
  } catch (error) {
    return NextResponse.json({
      source: "unavailable",
      updatedAt: null,
      fearGreed: null,
      briefing: [],
      temperatures: [],
      rsi: [],
      drawdown: [],
      vix: [],
      warnings: [{ code: "market_payload_failed", message: error instanceof Error ? error.message : String(error) }],
    }, { status: 200 });
  }
}
