import { NextResponse } from "next/server";
import { getPreciseDividends } from "@/lib/server/quote-fetchers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const response = await getPreciseDividends({
    ticker: searchParams.get("ticker") ?? "",
    start: searchParams.get("start"),
    end: searchParams.get("end"),
  });

  return NextResponse.json(response);
}
