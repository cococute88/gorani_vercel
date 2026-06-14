import type { Holding } from "./portfolio-types";
import { findKrxTickerMappingForHolding } from "./krx-ticker-name-map";
import {
  findKoreanEtfMapping,
  inferKoreanEtfFallbackBucket,
} from "./korean-etf-registry";

export type NormalizedHoldingTickerInfo = {
  quoteTicker?: string;
  krxCode?: string;
  dividendBucket?: string;
  exposureProxy?: string;
  displayTicker?: string;
  isCashLike: boolean;
  source: "manual" | "manual-name-map" | "korean-etf-registry" | "marker" | "fallback" | "cash-like" | "unknown";
  warnings: string[];
};

type HoldingTickerInput = Partial<Pick<
  Holding,
  | "ticker"
  | "productName"
  | "cleanName"
  | "assetType"
  | "tag"
  | "symbolGroup"
  | "accountGroup"
  | "purposeGroup"
  | "statusGroup"
>> & {
  name?: string | null;
};

const NON_QUOTE_TICKERS = new Set(["", "-", "CASH", "CASH_LIKE", "KRW", "USD"]);
const MARKER_BUCKETS = new Set(["SCHD", "SPY", "MSFT", "QQQ", "QLD", "TQQQ", "VOO", "JEPI"]);
const BUCKET_LIKE_TICKERS = new Set(["SCHD", "SPY", "QQQ", "QLD", "TQQQ"]);
const CASH_LIKE_SUBSTRINGS = ["MMF", "머니마켓", "현금", "예수금", "CMA", "달러"];
const CASH_LIKE_EXACT = new Set(["KRW", "USD", "원"]);

function clean(value: string | undefined | null): string {
  return (value ?? "")
    .replace(/^[#\s①②③④:：-]+/g, "")
    .replace(/[\][),.;:]+$/g, "")
    .trim();
}

function normalizeTicker(value: string | undefined | null): string | undefined {
  const ticker = clean(value).replace(/\s+/g, "").toUpperCase();
  if (!ticker || NON_QUOTE_TICKERS.has(ticker)) return undefined;
  return ticker;
}

function normalizeBucket(value: string | undefined | null): string | undefined {
  const bucket = normalizeTicker(value);
  return bucket && MARKER_BUCKETS.has(bucket) ? bucket : undefined;
}

function normalizeKrxTicker(value: string | undefined, registryQuoteTicker?: string): string | undefined {
  if (!value) return undefined;
  const registryCode = registryQuoteTicker?.match(/^(\d{6})\.(KS|KQ)$/)?.[1];
  if (/^\d{6}$/.test(value) && registryCode && value === registryCode) return registryQuoteTicker;
  return value;
}

function textOf(input: HoldingTickerInput): string {
  return [
    input.ticker,
    input.productName,
    input.cleanName,
    input.name,
    input.assetType,
    input.tag,
    input.symbolGroup,
    input.accountGroup,
    input.purposeGroup,
    input.statusGroup,
  ]
    .filter(Boolean)
    .join(" ");
}

function fieldsOf(input: HoldingTickerInput): string[] {
  return [
    input.ticker,
    input.productName,
    input.cleanName,
    input.name,
    input.assetType,
    input.tag,
    input.symbolGroup,
    input.accountGroup,
    input.purposeGroup,
    input.statusGroup,
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => String(value));
}

function isCashLikeInput(input: HoldingTickerInput): boolean {
  return fieldsOf(input).some((field) => {
    const normalized = clean(field).replace(/\s+/g, "").toUpperCase();
    if (!normalized) return false;
    if (CASH_LIKE_EXACT.has(normalized)) return true;
    return CASH_LIKE_SUBSTRINGS.some((keyword) => normalized.includes(keyword.toUpperCase()));
  });
}

export function normalizeHoldingTickerInfo(
  input: HoldingTickerInput,
): NormalizedHoldingTickerInfo {
  const warnings: string[] = [];
  const quoteTicker = normalizeTicker(input.ticker);
  const markerBucket = normalizeBucket(input.symbolGroup);
  const searchableText = textOf(input);
  const hasKoreanText = /[가-힣]/.test(searchableText);
  const isCashLike = isCashLikeInput(input);

  if (isCashLike) {
    return {
      dividendBucket: "KRW",
      displayTicker: "KRW",
      isCashLike: true,
      source: "cash-like",
      warnings: ["cash_like"],
    };
  }

  const registry = findKoreanEtfMapping(searchableText);
  const fallback = registry ? null : inferKoreanEtfFallbackBucket(searchableText);
  const nameMapping = quoteTicker ? null : findKrxTickerMappingForHolding(input);
  const dividendBucket = markerBucket ?? registry?.dividendBucket ?? fallback?.dividendBucket;
  const exposureProxy = markerBucket ?? registry?.exposureProxy ?? fallback?.exposureProxy;
  const isBucketLikeTicker = quoteTicker ? BUCKET_LIKE_TICKERS.has(quoteTicker) : false;

  if (!registry?.quoteTicker && fallback) warnings.push("missing_krx_code_mapping");

  if (nameMapping) {
    return {
      quoteTicker: nameMapping.displayTicker,
      krxCode: nameMapping.ticker,
      dividendBucket,
      exposureProxy,
      displayTicker: nameMapping.displayTicker,
      isCashLike: false,
      source: "manual-name-map",
      warnings,
    };
  }

  if (registry && registry.quoteTicker && isBucketLikeTicker) {
    warnings.push("upgraded_bucket_ticker_to_korean_quote_ticker");
    return {
      quoteTicker: registry.quoteTicker,
      krxCode: registry.krxCode,
      dividendBucket,
      exposureProxy,
      displayTicker: registry.quoteTicker,
      isCashLike: false,
      source: "korean-etf-registry",
      warnings,
    };
  }

  if (registry && registry.quoteTicker && quoteTicker) {
    const normalizedKrxTicker = normalizeKrxTicker(quoteTicker, registry.quoteTicker);
    return {
      quoteTicker: normalizedKrxTicker,
      krxCode: registry?.krxCode,
      dividendBucket,
      exposureProxy,
      displayTicker: normalizedKrxTicker,
      isCashLike: false,
      source: "manual",
      warnings,
    };
  }

  if (fallback && isBucketLikeTicker && hasKoreanText) {
    return {
      dividendBucket,
      exposureProxy,
      displayTicker: dividendBucket,
      isCashLike: false,
      source: "fallback",
      warnings,
    };
  }

  if (quoteTicker) {
    return {
      quoteTicker,
      dividendBucket,
      exposureProxy,
      displayTicker: quoteTicker,
      isCashLike: false,
      source: "manual",
      warnings,
    };
  }

  if (registry) {
    return {
      quoteTicker: registry.quoteTicker,
      krxCode: registry.krxCode,
      dividendBucket,
      exposureProxy,
      displayTicker: registry.quoteTicker ?? dividendBucket,
      isCashLike: false,
      source: "korean-etf-registry",
      warnings,
    };
  }

  if (markerBucket) {
    return {
      dividendBucket,
      exposureProxy,
      displayTicker: markerBucket,
      isCashLike: false,
      source: "marker",
      warnings,
    };
  }

  if (fallback) {
    return {
      dividendBucket,
      exposureProxy,
      displayTicker: dividendBucket,
      isCashLike: false,
      source: "fallback",
      warnings,
    };
  }

  return { isCashLike: false, source: "unknown", warnings };
}

export function applyKnownQuoteTickerToHolding(holding: Holding): Holding {
  const normalized = normalizeHoldingTickerInfo(holding);
  const currentTicker = normalizeTicker(holding.ticker);
  if (!normalized.quoteTicker && normalized.source === "fallback" && currentTicker && BUCKET_LIKE_TICKERS.has(currentTicker)) {
    return {
      ...holding,
      ticker: undefined,
      tickerConfidence: "none",
      needsReview: true,
    };
  }
  if (!normalized.quoteTicker) return holding;
  if (currentTicker === normalized.quoteTicker) return holding;

  return {
    ...holding,
    ticker: normalized.quoteTicker,
    tickerConfidence: "high",
    needsReview: false,
  };
}
