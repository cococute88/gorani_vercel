import { NextResponse } from "next/server";
import { getUsdKrwHistory } from "@/lib/server/quote-fetchers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const response = await getUsdKrwHistory({
    start: searchParams.get("start"),
    end: searchParams.get("end"),
  });
  return NextResponse.json(response, {
    headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" },
  });
}
