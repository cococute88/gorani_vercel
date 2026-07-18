import { NextResponse } from "next/server";
import { getQuoteHistory } from "@/lib/server/quote-fetchers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const response = await getQuoteHistory({
    ticker: searchParams.get("ticker") ?? "",
    market: searchParams.get("market") === "KR" ? "KR" : searchParams.get("market") === "US" ? "US" : undefined,
    range: searchParams.get("range"),
    start: searchParams.get("start"),
    end: searchParams.get("end"),
  });

  return NextResponse.json(response);
}
