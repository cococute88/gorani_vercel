export const KOREAN_STOCK_SEARCH_LIMIT = 10;

export type KoreanStockSearchResult = {
  code: string;
  symbol: string;
  displayName: string;
  market: "KOSPI" | "KOSDAQ";
  exchange: "KOSPI" | "KOSDAQ";
  currency: "KRW";
  quoteType: "EQUITY" | "ETF";
};

export type KoreanStockSearchResponse = {
  query: string;
  results: KoreanStockSearchResult[];
};

function normalizedSearchText(value: string) {
  return value.trim().replace(/\s+/g, "").toLocaleLowerCase("ko-KR");
}

export function isDirectKoreanTicker(value: string) {
  return /^\d{6}(?:\.(?:KS|KQ))?$/i.test(value.trim());
}

export function isKoreanStockNameQuery(value: string) {
  const normalized = normalizedSearchText(value);
  return normalized.length >= 2 && /[가-힣]/.test(normalized) && !isDirectKoreanTicker(normalized);
}

export function rankKoreanStockSearchResults(query: string, results: KoreanStockSearchResult[]) {
  const normalizedQuery = normalizedSearchText(query);
  const uniqueByCode = new Map<string, KoreanStockSearchResult>();

  for (const result of results) {
    if (!uniqueByCode.has(result.code)) uniqueByCode.set(result.code, result);
  }

  const score = (result: KoreanStockSearchResult) => {
    const name = normalizedSearchText(result.displayName);
    if (name === normalizedQuery) return 0;
    if (name.startsWith(normalizedQuery)) return 1;
    if (name.includes(normalizedQuery)) return 2;
    if (result.code === normalizedQuery) return 3;
    return 4;
  };

  return Array.from(uniqueByCode.values())
    // 동일 우선순위 안에서는 공급자의 검색 관련성 순서를 보존한다.
    .sort((a, b) => score(a) - score(b))
    .slice(0, KOREAN_STOCK_SEARCH_LIMIT);
}
