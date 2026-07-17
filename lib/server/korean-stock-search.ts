import "server-only";

import {
  KOREAN_STOCK_SEARCH_LIMIT,
  rankKoreanStockSearchResults,
  type KoreanStockSearchResponse,
  type KoreanStockSearchResult,
} from "@/lib/korean-stock-search";

const NAVER_AUTOCOMPLETE_URL = "https://m.stock.naver.com/front-api/search/autoComplete";
const SEARCH_TIMEOUT_MS = 5_000;

type NaverAutocompleteItem = {
  code?: string;
  name?: string;
  typeCode?: string;
  category?: string;
};

type NaverAutocompleteResponse = {
  isSuccess?: boolean;
  result?: { items?: NaverAutocompleteItem[] };
};

function toSearchResult(item: NaverAutocompleteItem): KoreanStockSearchResult | null {
  const code = item.code?.trim();
  const displayName = item.name?.trim();
  const market = item.typeCode === "KOSPI" || item.typeCode === "KOSDAQ" ? item.typeCode : null;

  // MDD 분석이 지원하는 6자리 KRX 보통주·ETF 코드만 노출한다. 지수·코인·IPO와
  // 영문/파생 코드가 섞인 Naver 자동완성 결과는 직접 티커로 해석하지 않는다.
  if (!code || !/^\d{6}$/.test(code) || !displayName || !market || item.category !== "stock") return null;

  return {
    code,
    symbol: `${code}.${market === "KOSPI" ? "KS" : "KQ"}`,
    displayName,
    market,
    exchange: market,
    currency: "KRW",
    quoteType: /ETF|ETN/i.test(displayName) ? "ETF" : "EQUITY",
  };
}

export async function searchKoreanStocks(query: string): Promise<KoreanStockSearchResponse> {
  const normalizedQuery = query.trim().slice(0, 50);
  if (!normalizedQuery) return { query: normalizedQuery, results: [] };

  const url = new URL(NAVER_AUTOCOMPLETE_URL);
  url.searchParams.set("query", normalizedQuery);
  url.searchParams.set("target", "stock,index,marketindicator,coin,ipo");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "Mozilla/5.0 gorani-finance korean-stock-search",
      },
      next: { revalidate: 60 * 60 * 6 },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Naver autocomplete HTTP ${response.status}`);

    const payload = (await response.json()) as NaverAutocompleteResponse;
    if (!payload.isSuccess) throw new Error("Naver autocomplete returned an unsuccessful response");

    const results = (payload.result?.items ?? [])
      .map(toSearchResult)
      .filter((item): item is KoreanStockSearchResult => item !== null);

    return { query: normalizedQuery, results: rankKoreanStockSearchResults(normalizedQuery, results).slice(0, KOREAN_STOCK_SEARCH_LIMIT) };
  } finally {
    clearTimeout(timeout);
  }
}
