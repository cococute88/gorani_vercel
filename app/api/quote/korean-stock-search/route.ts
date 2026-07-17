import { NextResponse } from "next/server";
import { isKoreanStockNameQuery } from "@/lib/korean-stock-search";
import { searchKoreanStocks } from "@/lib/server/korean-stock-search";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!isKoreanStockNameQuery(query)) {
    return NextResponse.json({ query, results: [] }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" },
    });
  }

  try {
    const response = await searchKoreanStocks(query);
    return NextResponse.json(response, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" },
    });
  } catch {
    return NextResponse.json({ error: "한국 종목 검색에 실패했습니다. 6자리 종목코드를 직접 입력할 수 있습니다." }, { status: 502 });
  }
}
