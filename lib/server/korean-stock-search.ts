import "server-only";

import {
  KOREAN_STOCK_SEARCH_LIMIT,
  rankKoreanStockSearchResults,
  type KoreanStockSearchResponse,
  type KoreanStockSearchResult,
} from "@/lib/korean-stock-search";

const KRX_CORPORATION_LIST_URL = "https://kind.krx.co.kr/corpgeneral/corpList.do?method=download&searchType=13";
const NAVER_ETF_LIST_URL = "https://finance.naver.com/api/sise/etfItemList.nhn";
const SEARCH_TIMEOUT_MS = 5_000;
const MASTER_REVALIDATE_MS = 1000 * 60 * 60 * 6;

type NaverEtfItem = {
  itemcode?: string;
  itemname?: string;
};

type NaverEtfResponse = {
  resultCode?: string;
  result?: { etfItemList?: NaverEtfItem[] };
};

type MasterCache = {
  expiresAt: number;
  stocks: KoreanStockSearchResult[];
};

let masterCache: MasterCache | null = null;
let masterRequest: Promise<KoreanStockSearchResult[]> | null = null;

function toSearchResult({ code, displayName, market, quoteType }: {
  code: string | undefined;
  displayName: string | undefined;
  market: "KOSPI" | "KOSDAQ" | null;
  quoteType: "EQUITY" | "ETF";
}): KoreanStockSearchResult | null {
  const normalizedCode = code?.trim();
  const normalizedName = displayName?.trim();

  if (!normalizedCode || !/^\d{6}$/.test(normalizedCode) || !normalizedName || !market) return null;

  return {
    code: normalizedCode,
    symbol: `${normalizedCode}.${market === "KOSPI" ? "KS" : "KQ"}`,
    displayName: normalizedName,
    market,
    exchange: market,
    currency: "KRW",
    quoteType,
  };
}

function decodeHtmlText(value: string) {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseKrxCorporationList(html: string) {
  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  return rows.flatMap((row) => {
    const cells = Array.from(row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi), (match) => decodeHtmlText(match[1]));
    if (cells.length < 3) return [];
    const market = cells[1].includes("유가") ? "KOSPI" : cells[1].includes("코스닥") ? "KOSDAQ" : null;
    const result = toSearchResult({ code: cells[2], displayName: cells[0], market, quoteType: "EQUITY" });
    return result ? [result] : [];
  });
}

export function parseNaverEtfList(payload: NaverEtfResponse) {
  if (payload.resultCode !== "success") return [];
  return (payload.result?.etfItemList ?? []).flatMap((item) => {
    const result = toSearchResult({ code: item.itemcode, displayName: item.itemname, market: "KOSPI", quoteType: "ETF" });
    return result ? [result] : [];
  });
}

function mergeMasterStocks(...lists: KoreanStockSearchResult[][]) {
  const unique = new Map<string, KoreanStockSearchResult>();
  for (const stock of lists.flat()) {
    // ETF 목록은 ETF 여부를 정확히 제공하므로 같은 코드가 있으면 우선한다.
    if (!unique.has(stock.code) || stock.quoteType === "ETF") unique.set(stock.code, stock);
  }
  return Array.from(unique.values());
}

async function fetchWithTimeout(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json, text/html;q=0.9",
        "user-agent": "Mozilla/5.0 gorani-finance korean-stock-search",
      },
      next: { revalidate: 60 * 60 * 6 },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Korean stock master HTTP ${response.status}`);
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchKoreanStockMaster() {
  const [krx, etf] = await Promise.allSettled([
    fetchWithTimeout(KRX_CORPORATION_LIST_URL).then(async (response) => parseKrxCorporationList(new TextDecoder("euc-kr").decode(await response.arrayBuffer()))),
    fetchWithTimeout(NAVER_ETF_LIST_URL).then(async (response) => parseNaverEtfList(JSON.parse(new TextDecoder("euc-kr").decode(await response.arrayBuffer())) as NaverEtfResponse)),
  ]);
  const lists = [krx, etf].flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  const stocks = mergeMasterStocks(...lists);
  if (stocks.length === 0) throw new Error("Korean stock master is unavailable");
  return stocks;
}

export async function getKoreanStockMaster() {
  if (masterCache && masterCache.expiresAt > Date.now()) return masterCache.stocks;
  if (!masterRequest) {
    masterRequest = fetchKoreanStockMaster()
      .then((stocks) => {
        masterCache = { stocks, expiresAt: Date.now() + MASTER_REVALIDATE_MS };
        return stocks;
      })
      .catch((error) => {
        if (masterCache) return masterCache.stocks;
        throw error;
      })
      .finally(() => {
        masterRequest = null;
      });
  }
  return masterRequest;
}

export async function searchKoreanStocks(query: string): Promise<KoreanStockSearchResponse> {
  const normalizedQuery = query.trim().slice(0, 50);
  if (!normalizedQuery) return { query: normalizedQuery, results: [] };

  const stocks = await getKoreanStockMaster();
  return { query: normalizedQuery, results: rankKoreanStockSearchResults(normalizedQuery, stocks).slice(0, KOREAN_STOCK_SEARCH_LIMIT) };
}
