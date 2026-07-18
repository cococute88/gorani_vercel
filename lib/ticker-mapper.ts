import type { Holding, TickerConfidence } from "./portfolio-types";
import { normalizeHoldingTickerInfo } from "./holding-ticker-normalizer";

export interface TickerGuess {
  ticker: string | null;
  confidence: TickerConfidence;
  matchedBy: "hashtag" | "exact" | "keyword" | "cash" | "none";
}

export type PortfolioAssetClassification =
  | "us_quote"
  | "cash_like"
  | "korean_equity"
  | "crypto"
  | "deposit_or_pension"
  | "unmapped";

const KNOWN_TICKERS = [
  "TQQQ",
  "QLD",
  "QQQM",
  "QQQ",
  "SPY",
  "SPYM",
  "VOO",
  "SCHD",
  "MSFT",
  "GOOGL",
  "AAPL",
  "TSLA",
  "NFLX",
  "NVDA",
  "JEPI",
  "SGOV",
  "BIL",
];

interface KeywordRule {
  ticker: string;
  confidence: TickerConfidence;
  keywords: string[];
}

const KEYWORD_RULES: KeywordRule[] = [
  { ticker: "TQQQ", confidence: "high", keywords: ["tqqq"] },
  { ticker: "QLD", confidence: "high", keywords: ["qld"] },
  { ticker: "QQQM", confidence: "high", keywords: ["qqqm"] },
  { ticker: "QQQ", confidence: "high", keywords: ["invesco qqq", "nasdaq 100", "nasdaq100", "나스닥 100 인베스코", "나스닥100 인베스코"] },
  { ticker: "SPY", confidence: "high", keywords: ["spdr s&p 500", "spdr sp500", "spdr s&p500"] },
  { ticker: "SPYM", confidence: "high", keywords: ["spym"] },
  { ticker: "VOO", confidence: "high", keywords: ["voo", "vanguard s&p 500", "vanguard sp500"] },
  { ticker: "SCHD", confidence: "medium", keywords: ["schd", "schwab 미국 배당", "schwab us dividend", "us dividend equity", "미국배당다우존", "미국배당다우존스"] },
  { ticker: "MSFT", confidence: "high", keywords: ["msft", "microsoft", "마이크로소프트"] },
  { ticker: "GOOGL", confidence: "high", keywords: ["googl", "alphabet", "google", "알파벳", "구글"] },
  { ticker: "AAPL", confidence: "high", keywords: ["aapl", "apple", "애플"] },
  { ticker: "TSLA", confidence: "high", keywords: ["tsla", "tesla", "테슬라"] },
  { ticker: "NFLX", confidence: "high", keywords: ["nflx", "netflix", "넷플릭스"] },
  { ticker: "NVDA", confidence: "high", keywords: ["nvda", "nvidia", "엔비디아"] },
  { ticker: "JEPI", confidence: "high", keywords: ["jepi"] },
  // SGOV(미국 단기국채 ETF): "SGOV", "SGOV US", "SGOV ETF" 등 변형 표기를 모두 인식한다.
  { ticker: "SGOV", confidence: "high", keywords: ["sgov"] },
  { ticker: "QQQ", confidence: "medium", keywords: ["qqq"] },
  { ticker: "SPY", confidence: "medium", keywords: ["spy"] },
];

const CASH_KEYWORDS = [
  "cash",
  "cma",
  "mmf",
  "money market",
  "rp",
  // "sgov" 는 현금성 키워드에서 제외한다. SGOV 는 실제 가격을 사용하는 달러 단기국채 ETF 로 인식한다.
  "bil",
  "box",
  "treasury bond",
  "deposit",
  "saving",
  "pension",
  "annuity",
  "파킹",
  "통장",
  "예수금",
  "예금",
  "적금",
  "연금",
  "현금",
  "입출금",
  "달러",
  "머니",
  "저금통",
  "세이프박스",
  "플러스박스",
];

const NON_QUOTE_TICKERS = new Set(["", "-", "CASH", "CASH_LIKE", "KRW", "USD"]);

function normalizeTickerValue(value: string | undefined): string {
  return (value ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

function normalizeQuoteTicker(value: string | undefined): string | null {
  const ticker = normalizeTickerValue(value);
  if (!ticker || NON_QUOTE_TICKERS.has(ticker)) return null;
  return ticker;
}

function holdingSearchText(
  holding: Pick<
    Holding,
    "ticker" | "productName" | "assetType" | "tag" | "symbolGroup" | "purposeGroup" | "statusGroup"
  >,
): string {
  return [
    holding.ticker,
    holding.productName,
    holding.assetType,
    holding.tag,
    holding.symbolGroup,
    holding.purposeGroup,
    holding.statusGroup,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function hasAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 영문 ticker 한 단어는 ASCII 문자 경계로만 매칭한다. 예를 들어 QQQ가
// QQQM에, SPY가 SPYM에 부분 일치해 더 구체적인 ticker를 덮지 않게 한다.
function matchesTickerKeyword(text: string, keyword: string): boolean {
  // 기존 계좌 라벨의 키움TQQQ1/키움TQQQ3은 같은 TQQQ 종목을 계좌별로
  // 구분한 이름이다. 끝의 숫자만 허용하고 중간 부분문자열은 허용하지 않는다.
  if (keyword.toLowerCase() === "tqqq") {
    return /(^|[^a-z0-9])tqqq\d*$/i.test(text);
  }
  if (/^[a-z][a-z0-9.-]{0,9}$/i.test(keyword)) {
    return new RegExp(`(^|[^a-z0-9])${escapeRegExp(keyword)}([^a-z0-9]|$)`, "i").test(text);
  }
  return text.includes(keyword);
}

// 상품명 전체가 명확한 상용명/별칭일 때만 레버리지 ticker를 복원한다.
// 단순히 "QQQ 2배"라는 문구가 포함됐다는 이유로 다른 상품을 QLD로 만들지 않는다.
function exactLeveragedQqqAlias(product: string): TickerGuess | null {
  const compact = product
    .trim()
    .toLowerCase()
    .replace(/[®™]/g, "")
    .replace(/\s+/g, " ");
  if (/^(?:qqq\s*2(?:x|배)\s*(?:프로셰어즈|proshares)(?:\s+ultra)?(?:\s+etf)?|proshares\s+ultra\s+qqq(?:\s+etf)?)$/i.test(compact)) {
    return { ticker: "QLD", confidence: "high", matchedBy: "keyword" };
  }
  if (/^(?:qqq\s*3(?:x|배)\s*(?:프로셰어즈|proshares)(?:\s+ultrapro)?(?:\s+etf)?|proshares\s+ultrapro\s+qqq(?:\s+etf)?)$/i.test(compact)) {
    return { ticker: "TQQQ", confidence: "high", matchedBy: "keyword" };
  }
  return null;
}

export function guessTicker(productNameRaw: string): TickerGuess {
  const product = (productNameRaw || "").trim();
  if (!product) return { ticker: null, confidence: "none", matchedBy: "none" };

  const lower = product.toLowerCase();

  const hash = product.match(/#([A-Za-z][A-Za-z0-9.]{0,5})/);
  if (hash) {
    return { ticker: hash[1].toUpperCase(), confidence: "high", matchedBy: "hashtag" };
  }

  if (CASH_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    return { ticker: null, confidence: "none", matchedBy: "cash" };
  }

  const leveragedAlias = exactLeveragedQqqAlias(product);
  if (leveragedAlias) return leveragedAlias;

  const token = product.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (token.length >= 1 && KNOWN_TICKERS.includes(token)) {
    return { ticker: token, confidence: "high", matchedBy: "exact" };
  }

  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some((keyword) => matchesTickerKeyword(lower, keyword))) {
      return { ticker: rule.ticker, confidence: rule.confidence, matchedBy: "keyword" };
    }
  }

  return { ticker: null, confidence: "none", matchedBy: "none" };
}

export function extractTag(productNameRaw: string): string | undefined {
  const match = (productNameRaw || "").match(/#(\S+)/);
  return match ? match[1] : undefined;
}

export function needsTickerReview(confidence: TickerConfidence | undefined): boolean {
  return confidence === "none" || confidence === "low";
}

export function classifyPortfolioAsset(
  holding: Pick<
    Holding,
    "ticker" | "productName" | "assetType" | "tag" | "symbolGroup" | "purposeGroup" | "statusGroup"
  >,
): PortfolioAssetClassification {
  const ticker = normalizeTickerValue(holding.ticker);
  const text = holdingSearchText(holding);

  if (NON_QUOTE_TICKERS.has(ticker) || hasAny(text, CASH_KEYWORDS)) {
    return hasAny(text, ["deposit", "saving", "pension", "annuity", "예금", "적금", "연금"])
      ? "deposit_or_pension"
      : "cash_like";
  }
  if (ticker === "BTC" || ticker === "BTC-KRW" || hasAny(text, ["bitcoin", "btc", "coin", "crypto", "코인"])) {
    return "crypto";
  }
  if (/^\d{6}(\.(KS|KQ))?$/.test(ticker) || ticker.endsWith(".KS") || ticker.endsWith(".KQ")) {
    return "korean_equity";
  }
  if (/^[A-Z][A-Z0-9-]{0,9}$/.test(ticker)) {
    return "us_quote";
  }
  return "unmapped";
}

export function getQuoteTickerForHolding(
  holding: Pick<
    Holding,
    "ticker" | "productName" | "assetType" | "tag" | "symbolGroup" | "purposeGroup" | "statusGroup"
  >,
): string | null {
  const normalized = normalizeHoldingTickerInfo(holding);
  if (normalized.isCashLike) return null;
  if (
    normalized.source === "fallback" &&
    !normalized.quoteTicker &&
    holding.ticker &&
    ["SCHD", "SPY", "QQQ", "QLD", "TQQQ"].includes(holding.ticker.toUpperCase())
  ) {
    return null;
  }
  if (
    normalized.quoteTicker &&
    /^\d{6}\.(KS|KQ)$/.test(normalized.quoteTicker) &&
    Boolean(normalized.dividendBucket || normalized.exposureProxy)
  ) {
    return normalizeQuoteTicker(normalized.quoteTicker);
  }

  const classification = classifyPortfolioAsset(holding);
  if (classification === "us_quote") return normalizeQuoteTicker(holding.ticker);
  if (classification !== "korean_equity") return null;

  const haystack = `${holding.assetType ?? ""} ${holding.productName ?? ""}`.toUpperCase();
  const isKoreanEtf =
    Boolean(normalized.dividendBucket || normalized.exposureProxy) ||
    haystack.includes("ETF") ||
    haystack.includes("ETN") ||
    haystack.includes("펀드");
  if (!isKoreanEtf) return null;

  return normalizeQuoteTicker(holding.ticker);
}

export function isQuoteEligibleHolding(
  holding: Pick<
    Holding,
    "ticker" | "productName" | "assetType" | "tag" | "symbolGroup" | "purposeGroup" | "statusGroup"
  >,
): boolean {
  return getQuoteTickerForHolding(holding) !== null;
}

export function hasPositiveQuantity(holding: Pick<Holding, "quantity">): boolean {
  return (
    holding.quantity !== undefined &&
    Number.isFinite(holding.quantity) &&
    holding.quantity > 0
  );
}

export function canRevalueHoldingWithQuote(
  holding: Pick<
    Holding,
    | "ticker"
    | "productName"
    | "assetType"
    | "tag"
    | "symbolGroup"
    | "purposeGroup"
    | "statusGroup"
    | "quantity"
  >,
): boolean {
  return getQuoteTickerForHolding(holding) !== null && hasPositiveQuantity(holding);
}
