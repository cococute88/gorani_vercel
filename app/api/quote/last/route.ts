import { NextResponse } from "next/server";
import { getQuoteLast } from "@/lib/server/quote-fetchers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const response = await getQuoteLast({
    ticker: searchParams.get("ticker") ?? "",
  });

  return NextResponse.json(response);
}
