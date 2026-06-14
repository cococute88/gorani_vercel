import { buildDividendHoldingRows, type DividendHoldingRow } from "./mock-dividend-data";
import { normalizeHoldingTickerInfo } from "./holding-ticker-normalizer";
import { applyKrxTickerMappingsToHoldings, type KrxTickerNameMap } from "./krx-ticker-name-map";
import { parsePortfolioTags } from "./portfolio-tags";
import type { Holding, PortfolioSnapshot } from "./portfolio-types";

export type DividendHoldingGroupResult = {
  taxableHoldings: DividendHoldingRow[];
  taxAdvantagedHoldings: DividendHoldingRow[];
  taxableTotalKRW: number;
  taxAdvantagedTotalKRW: number;
  warnings: string[];
  coverage: DividendHoldingCoverage;
  mappedTickerCount: number;
  dividendDataAvailable: boolean;
};

export type DividendHoldingCoverage = {
  total: number;
  ticker: number;
  productName: number;
  cleanName: number;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  valueKRW: number;
  principalKRW: number;
  currency: number;
  accountName: number;
  accountGroup: number;
  broker: number;
  assetType: number;
  tag: number;
  purposeGroup: number;
};

const TAXABLE_MIN_VALUE_KRW = 200_000;
const TAXABLE_ACCOUNT_MARKER = "위탁";
const TAXABLE_SYMBOL_GROUPS = new Set(["SCHD", "SPY", "MSFT"]);
const TAX_ADVANTAGED_KEYWORDS = ["미래연금", "퇴직연금", "연금저축", "연금", "ISA", "IRP", "절세"];
const CASH_LIKE_BUCKETS = new Set(["CASH_LIKE", "CASH", "KRW", "USD", "현금"]);
const CASH_LIKE_TOKEN_KEYWORDS = ["CASH", "KRW", "USD"];
const CASH_LIKE_SUBSTRING_KEYWORDS = ["CASH_LIKE", "현금", "원", "달러", "예수금", "MMF", "머니마켓", "CMA"];
const DIVIDEND_BUCKETS = ["SCHD", "SPY", "MSFT", "QQQ", "QLD", "TQQQ", "VOO", "JEPI"] as const;
const MARKER_1_VALUES = ["SCHD", "SPY", "MSFT", "QQQ", "QLD", "TQQQ", "KRW", "USD", "현금", "기타"] as const;

type DividendBucket = (typeof DIVIDEND_BUCKETS)[number];

type DividendHoldingClassification = {
  originalIndex: number;
  quoteTicker: string | null;
  dividendBucket: DividendBucket | null;
  exposureProxy: string | null;
  displayTicker: string | null;
  marker1: string | null;
  marker2: string | null;
  isSmall: boolean;
  isCashLike: boolean;
  hasTaxAdvantagedSignal: boolean;
  isTaxableEligible: boolean;
  isTaxAdvantagedEligible: boolean;
  exclusionReasons: string[];
  classificationReason: string;
};

function compact(value: string | undefined | null): string {
  return (value ?? "")
    .replace(/^[#\s①②③④:：-]+/g, "")
    .replace(/[\][),.;:]+$/g, "")
    .trim();
}

function normalize(value: string | undefined | null): string {
  return compact(value).replace(/\s+/g, "").toUpperCase();
}

function normalizeSearchable(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stringifyUnknown(value: unknown): string[] {
  if (value == null) return [];
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }
  if (Array.isArray(value)) return value.flatMap(stringifyUnknown);
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(stringifyUnknown);
  }
  return [];
}

function fieldsOf(holding: Holding): string[] {
  const generic = holding as Holding & Record<string, unknown>;
  const fieldNames = [
    "ticker",
    "name",
    "productName",
    "displayName",
    "cleanName",
    "tag",
    "tags",
    "broker",
    "account",
    "accountName",
    "accountType",
    "assetType",
    "category",
    "group",
    "memo",
    "rawName",
    "symbolGroup",
    "accountGroup",
    "purposeGroup",
    "statusGroup",
    "parsedTags",
  ];

  return fieldNames.flatMap((fieldName) => stringifyUnknown(generic[fieldName]));
}

function hasFiniteNumber(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function normalizeDividendHoldingInput(holdings: Holding[], tickerNameMap?: KrxTickerNameMap): {
  holdings: Holding[];
  mappedTickerCount: number;
} {
  const mapped = applyKrxTickerMappingsToHoldings(holdings, tickerNameMap);
  return {
    holdings: mapped.holdings,
    mappedTickerCount: mapped.appliedCount,
  };
}

export function getDividendHoldingCoverage(holdings: Holding[]): DividendHoldingCoverage {
  return holdings.reduce<DividendHoldingCoverage>(
    (coverage, holding) => {
      const extras = holding as Holding & Record<string, unknown>;
      coverage.total += 1;
      if (hasText(holding.ticker)) coverage.ticker += 1;
      if (hasText(holding.productName)) coverage.productName += 1;
      if (hasText(holding.cleanName)) coverage.cleanName += 1;
      if (hasFiniteNumber(holding.quantity)) coverage.quantity += 1;
      if (
        hasFiniteNumber(holding.averagePrice) ||
        hasFiniteNumber(extras.averageCost) ||
        hasFiniteNumber(extras.averageCostKRW) ||
        hasFiniteNumber(extras.averageCostUSD) ||
        hasFiniteNumber(extras.avgPrice)
      ) {
        coverage.averagePrice += 1;
      }
      if (
        hasFiniteNumber(holding.currentPrice) ||
        hasFiniteNumber(extras.currentPriceKRW) ||
        hasFiniteNumber(extras.currentPriceUSD)
      ) {
        coverage.currentPrice += 1;
      }
      if (hasFiniteNumber(holding.valueKRW)) coverage.valueKRW += 1;
      if (hasFiniteNumber(holding.principalKRW)) coverage.principalKRW += 1;
      if (hasText(holding.currency)) coverage.currency += 1;
      if (hasText(holding.accountName)) coverage.accountName += 1;
      if (hasText(holding.accountGroup)) coverage.accountGroup += 1;
      if (hasText(holding.broker)) coverage.broker += 1;
      if (hasText(holding.assetType)) coverage.assetType += 1;
      if (hasText(holding.tag)) coverage.tag += 1;
      if (hasText(holding.purposeGroup)) coverage.purposeGroup += 1;
      return coverage;
    },
    {
      total: 0,
      ticker: 0,
      productName: 0,
      cleanName: 0,
      quantity: 0,
      averagePrice: 0,
      currentPrice: 0,
      valueKRW: 0,
      principalKRW: 0,
      currency: 0,
      accountName: 0,
      accountGroup: 0,
      broker: 0,
      assetType: 0,
      tag: 0,
      purposeGroup: 0,
    },
  );
}

function searchableTextOf(holding: Holding): string {
  return normalizeSearchable(fieldsOf(holding).join(" "));
}

function parseFreshTags(holding: Holding) {
  return parsePortfolioTags(holding.productName ?? "");
}

function symbolGroupOf(holding: Holding): string | undefined {
  const parsedTags = holding.parsedTags ?? parseFreshTags(holding);
  return parsedTags.symbolGroup ?? holding.symbolGroup;
}

function accountGroupOf(holding: Holding): string | undefined {
  const parsedTags = holding.parsedTags ?? parseFreshTags(holding);
  return parsedTags.accountGroup ?? holding.accountGroup;
}

function normalizeBucket(value: string | undefined | null): DividendBucket | undefined {
  const normalized = normalize(value);
  return DIVIDEND_BUCKETS.find((bucket) => normalized === bucket);
}

function primaryMarkerBucketOf(holding: Holding): DividendBucket | undefined {
  const structuredMarker = marker1Of(holding);
  const structured = normalizeBucket(structuredMarker);
  if (structured) return structured;

  const text = searchableTextOf(holding);
  const markerMatch = text.match(/①\s*(SCHD|SPY|MSFT|QQQ|QLD|TQQQ|기타|현금|KRW|USD)(?=$|[\s/#①②③④])/i);
  return normalizeBucket(markerMatch?.[1]);
}

function marker1Of(holding: Holding): string | undefined {
  const parsedTags = holding.parsedTags ?? parseFreshTags(holding);
  const structured = compact(parsedTags.symbolGroup ?? holding.symbolGroup);
  const normalizedStructured = normalize(structured);
  if (structured && MARKER_1_VALUES.some((value) => normalize(value) === normalizedStructured)) return structured;

  const text = searchableTextOf(holding);
  const markerMatch = text.match(/①\s*(SCHD|SPY|MSFT|QQQ|QLD|TQQQ|기타|현금|KRW|USD)(?=$|[\s/#①②③④])/i);
  return markerMatch?.[1] ? compact(markerMatch[1]) : undefined;
}

function marker2Of(holding: Holding): string | undefined {
  const text = searchableTextOf(holding);
  const markerMatch = text.match(/②\s*(위탁|연금저축|퇴직연금|연금|ISA|IRP|절세|현금|기타)(?=$|[\s/#①②③④])/i);
  if (markerMatch?.[1]) return compact(markerMatch[1]);

  const structured = accountGroupOf(holding);
  const structuredNormalized = compact(structured);
  if (structuredNormalized) return structuredNormalized;
  return undefined;
}

function productNameFallbackBucketOf(holding: Holding): DividendBucket | undefined {
  const text = searchableTextOf(holding);
  const compacted = normalize(text);
  const lower = text.toLowerCase();

  if (
    compacted.includes("S&P500") ||
    compacted.includes("S&P 500".replace(/\s+/g, "")) ||
    compacted.includes("미국S&P500") ||
    compacted.includes("에센피") ||
    compacted.includes("에스앤피") ||
    compacted.includes("스탠더드앤푸어스")
  ) {
    return "SPY";
  }
  if (
    compacted.includes("나스닥100") ||
    compacted.includes("NASDAQ100") ||
    compacted.includes("미국나스닥100")
  ) {
    return "QQQ";
  }
  if (compacted.includes("SCHD")) return "SCHD";
  if (compacted.includes("MSFT") || lower.includes("microsoft")) return "MSFT";

  return undefined;
}

function dividendBucketOf(holding: Holding): DividendBucket | undefined {
  const normalized = normalizeHoldingTickerInfo(holding);
  if (normalized.isCashLike) return undefined;
  return normalizeBucket(normalized.dividendBucket) ?? primaryMarkerBucketOf(holding) ?? productNameFallbackBucketOf(holding);
}

function displayTickerOf(classification: Pick<DividendHoldingClassification, "dividendBucket">): string | null {
  return classification.dividendBucket;
}

function withDividendDisplayTicker(holding: Holding, displayTicker: string): Holding {
  return {
    ...holding,
    quoteTicker: holding.ticker,
    ticker: displayTicker,
  } as Holding;
}

function hasSmallTag(holding: Holding): boolean {
  const parsedTags = holding.parsedTags ?? parseFreshTags(holding);
  if (parsedTags.isSmallExcluded) return true;

  return fieldsOf(holding).some((field) => {
    const trimmed = field.trim();
    return trimmed === "소액" || trimmed === "#소액" || /(^|\s)#소액(\s|$)/.test(trimmed);
  });
}

function isPositiveValue(holding: Holding): boolean {
  return Number.isFinite(holding.valueKRW) && holding.valueKRW > 0;
}

function hasTaxAdvantagedSignal(holding: Holding): boolean {
  const searchableText = normalize(searchableTextOf(holding));
  return TAX_ADVANTAGED_KEYWORDS.some((keyword) => searchableText.includes(normalize(keyword)));
}

function isCashLikeHolding(holding: Holding, normalizedTickerInfo: ReturnType<typeof normalizeHoldingTickerInfo>, marker1: string | null): boolean {
  if (normalizedTickerInfo.isCashLike) return true;
  if (marker1 && CASH_LIKE_BUCKETS.has(normalize(marker1))) return true;
  if (holding.ticker && CASH_LIKE_BUCKETS.has(normalize(holding.ticker))) return true;

  return fieldsOf(holding).some((field) => {
    const normalizedField = normalize(field);
    if (!normalizedField) return false;
    if (CASH_LIKE_SUBSTRING_KEYWORDS.some((keyword) => normalizedField.includes(normalize(keyword)))) return true;

    const upperField = field.toUpperCase();
    return CASH_LIKE_TOKEN_KEYWORDS.some((keyword) => {
      const pattern = new RegExp(`(^|[^A-Z0-9가-힣])${keyword}([^A-Z0-9가-힣]|$)`);
      return pattern.test(upperField);
    });
  });
}

function classifyDividendHolding(holding: Holding, originalIndex: number): DividendHoldingClassification {
  const normalizedTickerInfo = normalizeHoldingTickerInfo(holding);
  const marker1 = marker1Of(holding) ?? null;
  const marker2 = marker2Of(holding) ?? null;
  const dividendBucket = dividendBucketOf(holding) ?? null;
  const taxAdvantagedSignal = hasTaxAdvantagedSignal(holding);
  const isSmall = hasSmallTag(holding);
  const isCashLike = isCashLikeHolding(holding, normalizedTickerInfo, marker1);
  const commonExclusionReasons: string[] = [];

  if (!isPositiveValue(holding)) commonExclusionReasons.push("invalid_or_zero_value");
  if (Number.isFinite(holding.valueKRW) && holding.valueKRW <= TAXABLE_MIN_VALUE_KRW) {
    commonExclusionReasons.push("below_minimum_value");
  }
  if (isSmall) commonExclusionReasons.push("small_tag");
  if (isCashLike) commonExclusionReasons.push("cash_like");
  if (!dividendBucket) commonExclusionReasons.push("unknown_bucket");

  const passesCommonRules = commonExclusionReasons.length === 0;
  const taxableOnlyReasons: string[] = [];
  if (passesCommonRules && (!dividendBucket || !TAXABLE_SYMBOL_GROUPS.has(dividendBucket))) {
    taxableOnlyReasons.push("unsupported_taxable_bucket");
  }
  if (passesCommonRules && normalize(marker2) !== normalize(TAXABLE_ACCOUNT_MARKER)) taxableOnlyReasons.push("not_strict_taxable_account");
  if (passesCommonRules && taxAdvantagedSignal) taxableOnlyReasons.push("tax_advantaged_signal");

  const taxableEligibility = passesCommonRules && taxableOnlyReasons.length === 0;
  const taxAdvantagedEligibility = passesCommonRules && taxAdvantagedSignal;
  const exclusionReasons = [...commonExclusionReasons, ...taxableOnlyReasons];
  const classificationReason = taxableEligibility
    ? "strict-taxable"
    : taxAdvantagedEligibility
      ? "tax-advantaged-signal"
      : (exclusionReasons[0] ?? "not_classified");

  return {
    originalIndex,
    quoteTicker: normalizedTickerInfo.quoteTicker ?? null,
    dividendBucket,
    exposureProxy: normalizedTickerInfo.exposureProxy ?? null,
    displayTicker: displayTickerOf({ dividendBucket }),
    marker1,
    marker2,
    isSmall,
    isCashLike,
    hasTaxAdvantagedSignal: taxAdvantagedSignal,
    isTaxableEligible: taxableEligibility,
    isTaxAdvantagedEligible: taxAdvantagedEligibility,
    exclusionReasons,
    classificationReason,
  };
}

export function buildDividendHoldingGroupsFromHoldings(
  holdings: Holding[],
  afterTax = false,
  tickerNameMap?: KrxTickerNameMap,
): DividendHoldingGroupResult {
  const normalizedInput = normalizeDividendHoldingInput(holdings, tickerNameMap);
  const normalizedHoldings = normalizedInput.holdings;
  const classified = normalizedHoldings.map((holding, originalIndex) => ({
    holding,
    classification: classifyDividendHolding(holding, originalIndex),
  }));
  const taxableSourceHoldings = classified
    .filter(({ classification }) => classification.isTaxableEligible && classification.displayTicker)
    .map(({ holding, classification }) => withDividendDisplayTicker(holding, classification.displayTicker as string));
  const taxAdvantagedSourceHoldings = classified
    .filter(({ classification }) => classification.isTaxAdvantagedEligible && classification.displayTicker)
    .map(({ holding, classification }) => withDividendDisplayTicker(holding, classification.displayTicker as string));
  const warnings = Array.from(
    new Set(
      [
        ...(normalizedInput.mappedTickerCount > 0
          ? [`TICKER-4 name mapping applied to ${normalizedInput.mappedTickerCount} dividend holding(s).`]
          : []),
        "Dividend yield and expected dividend data are unavailable; mock yield values are not used.",
        ...classified
        .filter(({ classification }) => classification.exclusionReasons.length > 0)
        .flatMap(({ holding, classification }) =>
          classification.exclusionReasons.map((reason) => `${holding.productName}: ${reason}`),
        ),
        ...classified
          .filter(({ classification }) => classification.quoteTicker?.match(/\.(KS|KQ)$/))
          .map(({ holding, classification }) => `${holding.productName}: KRX ticker ${classification.quoteTicker} may not be supported by dividend quote data.`),
      ],
    ),
  );

  return {
    taxableHoldings: buildDividendHoldingRows(taxableSourceHoldings, afterTax),
    taxAdvantagedHoldings: buildDividendHoldingRows(taxAdvantagedSourceHoldings, afterTax),
    taxableTotalKRW: taxableSourceHoldings.reduce((sum, holding) => sum + holding.valueKRW, 0),
    taxAdvantagedTotalKRW: taxAdvantagedSourceHoldings.reduce((sum, holding) => sum + holding.valueKRW, 0),
    warnings,
    coverage: getDividendHoldingCoverage(normalizedHoldings),
    mappedTickerCount: normalizedInput.mappedTickerCount,
    dividendDataAvailable: false,
  };
}

export function buildDividendHoldingGroupsFromSnapshot(
  snapshot: PortfolioSnapshot | null | undefined,
  afterTax = false,
): DividendHoldingGroupResult {
  if (!snapshot) {
    return {
      taxableHoldings: [],
      taxAdvantagedHoldings: [],
      taxableTotalKRW: 0,
      taxAdvantagedTotalKRW: 0,
      warnings: ["No portfolio snapshot is available for dividend holding classification."],
      coverage: getDividendHoldingCoverage([]),
      mappedTickerCount: 0,
      dividendDataAvailable: false,
    };
  }

  return buildDividendHoldingGroupsFromHoldings(snapshot.holdings ?? [], afterTax);
}
