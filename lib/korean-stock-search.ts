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

export function normalizeKoreanStockSearchText(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("ko-KR")
    .replace(/[\s\-‐‑‒–—_()\[\]{}·ㆍ.,/\\]+/g, "");
}

function searchTokens(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("ko-KR")
    .replace(/([a-z])([0-9가-힣])/g, "$1 $2")
    .replace(/([0-9])([a-z가-힣])/g, "$1 $2")
    .replace(/([가-힣])([a-z0-9])/g, "$1 $2")
    .split(/[\s\-‐‑‒–—_()\[\]{}·ㆍ.,/\\]+/g)
    .map(normalizeKoreanStockSearchText)
    .filter(Boolean);
}

export function isDirectKoreanTicker(value: string) {
  return /^\d{6}(?:\.(?:KS|KQ))?$/i.test(value.trim());
}

export function isKoreanStockNameQuery(value: string) {
  const normalized = normalizeKoreanStockSearchText(value);
  // 한글 부분검색은 3글자부터 시작한다. KODEX처럼 영문으로만 검색하는 ETF
  // 사용 사례도 지원하되, 숫자 6자리 티커는 기존 직접 분석 경로를 유지한다.
  return normalized.length >= 3 && /[a-z가-힣]/.test(normalized) && !isDirectKoreanTicker(normalized);
}

export function rankKoreanStockSearchResults(query: string, results: KoreanStockSearchResult[]) {
  const normalizedQuery = normalizeKoreanStockSearchText(query);
  const queryTokens = searchTokens(query);
  const uniqueByCode = new Map<string, KoreanStockSearchResult>();

  for (const result of results) {
    if (!uniqueByCode.has(result.code)) uniqueByCode.set(result.code, result);
  }

  const score = (result: KoreanStockSearchResult) => {
    const name = normalizeKoreanStockSearchText(result.displayName);
    const tokens = searchTokens(result.displayName);
    if (result.code === normalizedQuery) return 0;
    if (result.displayName.trim().toLocaleLowerCase("ko-KR") === query.trim().toLocaleLowerCase("ko-KR")) return 1;
    if (name === normalizedQuery) return 2;
    if (name.startsWith(normalizedQuery)) return 3;
    if (queryTokens.length > 0 && queryTokens.every((token) => tokens.some((nameToken) => nameToken.startsWith(token)))) return 4;
    if (name.includes(normalizedQuery)) return 5;
    if (queryTokens.length > 1 && queryTokens.every((token) => name.includes(token))) return 6;
    return 7;
  };

  return Array.from(uniqueByCode.values())
    .filter((result) => score(result) < 7)
    // 동일 우선순위 안에서는 종목 마스터의 안정적인 순서를 보존한다.
    .sort((a, b) => score(a) - score(b))
    .slice(0, KOREAN_STOCK_SEARCH_LIMIT);
}
