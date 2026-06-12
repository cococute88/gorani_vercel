import { NextResponse } from "next/server";
import { getQuoteDividends } from "@/lib/server/quote-fetchers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const response = await getQuoteDividends({
    ticker: searchParams.get("ticker") ?? "",
    range: searchParams.get("range"),
    start: searchParams.get("start"),
    end: searchParams.get("end"),
  });

  return NextResponse.json(response);
}
