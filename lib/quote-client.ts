import type {
  QuoteDividendsResponse,
  QuoteFxResponse,
  QuoteHistoryResponse,
  QuoteLastResponse,
} from "@/lib/quote-types";
import type { QuoteMarket } from "@/lib/quote-types";

export type QuoteRange = "1m" | "6m" | "1y" | "3y" | "5y" | "max" | string;

export type QuoteHistoryRequest = {
  ticker: string;
  market?: QuoteMarket;
  range?: QuoteRange;
  start?: string;
  end?: string;
};

export type QuoteDividendsRequest = QuoteHistoryRequest;

export type QuoteLastRequest = {
  ticker: string;
};

function createQuery(input: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  Object.entries(input).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return params.toString();
}

async function fetchQuoteApi<T extends { warnings?: string[] }>(path: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as T;
  } catch (error) {
    return {
      ...fallback,
      warnings: [
        ...(fallback.warnings ?? []),
        `Quote API request failed, sample fallback was used: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
}

export function quoteHistoryPath(input: QuoteHistoryRequest) {
  return `/api/quote/history?${createQuery({
    ticker: input.ticker,
    market: input.market,
    range: input.range,
    start: input.start,
    end: input.end,
  })}`;
}

export function quoteDividendsPath(input: QuoteDividendsRequest) {
  return `/api/quote/dividends?${createQuery({
    ticker: input.ticker,
    range: input.range,
    start: input.start,
    end: input.end,
  })}`;
}

export function quoteDividendsPrecisePath(input: QuoteDividendsRequest) {
  return `/api/quote/dividends-precise?${createQuery({
    ticker: input.ticker,
    start: input.start,
    end: input.end,
  })}`;
}

export function quoteLastPath(input: QuoteLastRequest) {
  return `/api/quote/last?${createQuery({ ticker: input.ticker })}`;
}

export function quoteFxPath() {
  return "/api/quote/fx";
}

export function requestQuoteHistory(input: QuoteHistoryRequest, fallback: QuoteHistoryResponse) {
  return fetchQuoteApi<QuoteHistoryResponse>(quoteHistoryPath(input), fallback);
}

export function requestQuoteDividends(input: QuoteDividendsRequest, fallback: QuoteDividendsResponse) {
  return fetchQuoteApi<QuoteDividendsResponse>(quoteDividendsPath(input), fallback);
}

export function requestQuoteLast(input: QuoteLastRequest, fallback: QuoteLastResponse) {
  return fetchQuoteApi<QuoteLastResponse>(quoteLastPath(input), fallback);
}

export function requestQuoteFx(fallback: QuoteFxResponse) {
  return fetchQuoteApi<QuoteFxResponse>(quoteFxPath(), fallback);
}

