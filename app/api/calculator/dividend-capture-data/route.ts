import { NextResponse } from "next/server";
import { getDividendCaptureYahooData } from "@/lib/dividend-capture-yahoo";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  try {
    const response = await getDividendCaptureYahooData({
      ticker: searchParams.get("ticker") ?? "ARCC",
      recent5yOnly: searchParams.get("recent5yOnly") === "true",
    });
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error), warnings: ["Yahoo chart 단일소스 배당치기 데이터를 가져오지 못했습니다."] }, { status: 502 });
  }
}
