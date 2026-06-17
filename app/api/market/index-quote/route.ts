import { NextResponse } from "next/server";
import { getIndexQuote } from "@/lib/server/index-quote-fetchers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const response = await getIndexQuote({
    symbol: searchParams.get("symbol") ?? "SPY",
    range: searchParams.get("range"),
  });

  // Allow the CDN to serve cached index quotes briefly while revalidating;
  // the upstream Yahoo fetch is also cached per-range via next.revalidate.
  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
