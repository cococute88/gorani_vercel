import { NextResponse } from "next/server";
import { getQuoteFx } from "@/lib/server/quote-fetchers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const response = await getQuoteFx({
    pair: searchParams.get("pair"),
  });

  return NextResponse.json(response);
}
