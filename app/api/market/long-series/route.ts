import { NextResponse } from "next/server";
import { getLongDailySeries } from "@/lib/server/long-series-fetcher";

export const dynamic = "force-dynamic";

// Long-range DAILY history (close + adjusted close + dividend events) used by
// the SCHD detail modal's US10Y and SPY/SCHD Total-Return comparison tabs.
// Yahoo range tokens cap daily history at ~5y ("max" downgrades to monthly),
// so this route queries period1/period2 with interval=1d for full history.
export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const response = await getLongDailySeries({
    symbol: searchParams.get("symbol") ?? "SPY",
    start: searchParams.get("start"),
  });

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
    },
  });
}
