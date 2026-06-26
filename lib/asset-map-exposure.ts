import {
  getAssetMapEtfFixture,
  KNOWN_ASSET_MAP_ETF_TICKERS,
} from "./asset-map-etf-constituents";
import {
  ASSET_MAP_KOREAN_NAME_TO_TICKER,
  getAssetMapSectorEntry,
  UNKNOWN_ASSET_MAP_SECTOR,
} from "./asset-map-sector-map";
import { normalizeHoldingTickerInfo } from "./holding-ticker-normalizer";

export type AssetMapPortfolioHoldingInput = {
  ticker?: string | null;
  name?: string | null;
  valueKRW?: number | null;
  assetType?: string | null;
};

export type AssetMapExposureResult = {
  source: "portfolio" | "mock";
  totalValueKRW: number;
  analyzedValueKRW: number;
  directValueKRW: number;
  etfValueKRW: number;
  coveredEtfValueKRW: number;
  uncoveredEtfValueKRW: number;
  coveragePct: number;
  sectorAllocation: Array<{
    sector: string;
    amountKRW: number;
    weightPct: number;
  }>;
  effectiveHoldingsTop: Array<{
    ticker: string;
    name: string;
    sector: string;
    amountKRW: number;
    weightPct: number;
    sources: string[];
  }>;
  warnings: string[];
  excludedHoldings: Array<{
    name: string;
    ticker: string | null;
    reason: "ticker_unresolved" | "constituents_unavailable" | "not_look_through_target";
    amountKRW: number;
  }>;
};

type EffectiveHoldingAccumulator = {
  ticker: string;
  name: string;
  sector: string;
  amountKRW: number;
  sources: Set<string>;
};

const LEADING_SYMBOLS_RE = /^[\s#①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]+/;
const US_TICKER_RE = /^[A-Z][A-Z0-9.-]{0,9}$/;
const KR_TICKER_RE = /^\d{6}\.KS$/;
const WRAPPER_KEYWORDS_RE = /(ETF|ETN|펀드|위탁|연금|ISA|ACE|TIGER|RISE|KODEX|SOL|KBSTAR|키움|토스|삼성|미래)/i;

function cleanTickerCandidate(value: string): string {
  return value
    .trim()
    .replace(LEADING_SYMBOLS_RE, "")
    .replace(/^[([]+|[)\]]+$/g, "")
    .replace(/^[#$]+/, "")
    .toUpperCase();
}

function findKnownTickerInText(text: string): string | null {
  const normalizedText = text.toUpperCase();
  for (const [name, ticker] of Object.entries(ASSET_MAP_KOREAN_NAME_TO_TICKER)) {
    if (text.includes(name)) return ticker;
  }

  const candidates = [
    ...Array.from(KNOWN_ASSET_MAP_ETF_TICKERS),
    "MSFT",
    "AAPL",
    "GOOGL",
    "GOOG",
    "NVDA",
    "TSLA",
    "NFLX",
    "AMZN",
    "META",
    "SPYM",
    "005930.KS",
    "000660.KS",
  ];

  for (const ticker of candidates) {
    const pattern = new RegExp(`(^|[^A-Z0-9.])${ticker.replace(".", "\\.")}([^A-Z0-9.]|$)`, "i");
    if (pattern.test(normalizedText)) return ticker;
  }

  const circledMatch = normalizedText.match(/[①②③④⑤⑥⑦⑧⑨⑩]\s*([A-Z][A-Z0-9.-]{0,9})/);
  if (circledMatch) return cleanTickerCandidate(circledMatch[1]);

  return null;
}

export function normalizeAssetMapTicker(holding: AssetMapPortfolioHoldingInput): string | null {
  const normalized = normalizeHoldingTickerInfo({
    ticker: holding.ticker ?? undefined,
    productName: holding.name ?? undefined,
    name: holding.name,
    assetType: holding.assetType ?? undefined,
  });
  if (normalized.isCashLike) return null;
  if (normalized.exposureProxy) return normalized.exposureProxy;

  const explicitTicker = holding.ticker ? cleanTickerCandidate(holding.ticker) : "";
  if (explicitTicker && (US_TICKER_RE.test(explicitTicker) || KR_TICKER_RE.test(explicitTicker))) {
    return explicitTicker;
  }

  const rawName = holding.name?.trim() ?? "";
  if (!rawName) return null;

  const known = findKnownTickerInText(rawName);
  if (known) return known;

  const cleanedName = cleanTickerCandidate(rawName);
  if (US_TICKER_RE.test(cleanedName) || KR_TICKER_RE.test(cleanedName)) return cleanedName;

  return null;
}

// 현금성 자산 이름/티커 패턴. 기존 cash-like 감지(MMF/현금/달러 등)에 더해
// SGOV 계열 단기 국채 ETF 등 현금 등가물을 자산맵/섹터 분석에서 제외하기 위함.
const CASH_LIKE_NAME_PATTERNS = ["SGOV", "MMF", "머니마켓", "현금", "예수금", "CMA", "달러"];

// 현금성 자산(원화/달러 현금, 예수금, MMF, SGOV 계열 등)은 자산맵 TreeMap 및
// 섹터 비중 분석 대상에서 제외한다. 평가금액 합산에는 영향을 주지 않는다.
function isCashLikeHolding(holding: AssetMapPortfolioHoldingInput): boolean {
  const normalized = normalizeHoldingTickerInfo({
    ticker: holding.ticker ?? undefined,
    productName: holding.name ?? undefined,
    name: holding.name,
    assetType: holding.assetType ?? undefined,
  });
  if (normalized.isCashLike) return true;
  const haystack = `${holding.name ?? ""} ${holding.ticker ?? ""}`.toUpperCase();
  return CASH_LIKE_NAME_PATTERNS.some((pattern) => haystack.includes(pattern.toUpperCase()));
}

function isEtfHolding(ticker: string, holding: AssetMapPortfolioHoldingInput): boolean {
  const haystack = `${holding.assetType ?? ""} ${holding.name ?? ""} ${ticker}`.toUpperCase();
  return (
    KNOWN_ASSET_MAP_ETF_TICKERS.has(ticker) ||
    haystack.includes("ETF") ||
    haystack.includes("ETN") ||
    haystack.includes("펀드")
  );
}

function isLikelyWrapperHolding(holding: AssetMapPortfolioHoldingInput): boolean {
  const haystack = `${holding.assetType ?? ""} ${holding.name ?? ""} ${holding.ticker ?? ""}`;
  return WRAPPER_KEYWORDS_RE.test(haystack) || /\d{6}\.(KS|KQ)/i.test(haystack);
}

function addEffectiveHolding(
  rows: Map<string, EffectiveHoldingAccumulator>,
  input: {
    ticker: string;
    name: string;
    sector: string;
    amountKRW: number;
    source: string;
  },
) {
  if (input.amountKRW <= 0) return;
  const existing = rows.get(input.ticker);
  if (existing) {
    existing.amountKRW += input.amountKRW;
    existing.sources.add(input.source);
    if (existing.sector === UNKNOWN_ASSET_MAP_SECTOR && input.sector !== UNKNOWN_ASSET_MAP_SECTOR) {
      existing.sector = input.sector;
    }
    return;
  }

  rows.set(input.ticker, {
    ticker: input.ticker,
    name: input.name,
    sector: input.sector,
    amountKRW: input.amountKRW,
    sources: new Set([input.source]),
  });
}

function roundPct(value: number): number {
  return Math.round(value * 100) / 100;
}

export function buildAssetMapExposureFromHoldings(
  holdings: AssetMapPortfolioHoldingInput[],
): AssetMapExposureResult {
  const effectiveRows = new Map<string, EffectiveHoldingAccumulator>();
  const warnings: string[] = [];
  const excludedHoldings: AssetMapExposureResult["excludedHoldings"] = [];
  const uncoveredEtfs = new Set<string>();
  const partialEtfs = new Map<string, number>();

  let totalValueKRW = 0;
  let directValueKRW = 0;
  let etfValueKRW = 0;
  let coveredEtfValueKRW = 0;
  let uncoveredEtfValueKRW = 0;
  let lookedThroughEtfValueKRW = 0;

  for (const holding of holdings) {
    const amountKRW = Number(holding.valueKRW ?? 0);
    if (!Number.isFinite(amountKRW) || amountKRW <= 0) continue;
    // 현금성 자산은 자산맵/섹터 분석에서 제외(평가금액에는 이미 반영됨).
    if (isCashLikeHolding(holding)) continue;
    totalValueKRW += amountKRW;

    const ticker = normalizeAssetMapTicker(holding);
    if (!ticker) {
      const reason = isLikelyWrapperHolding(holding) ? "not_look_through_target" : "ticker_unresolved";
      excludedHoldings.push({
        name: holding.name ?? "이름 없음",
        ticker: null,
        reason,
        amountKRW: Math.round(amountKRW),
      });
      warnings.push(`${reason === "not_look_through_target" ? "look-through 대상 아님" : "티커 확인 불가"}: ${holding.name ?? "이름 없음"}`);
      continue;
    }

    const etfFixture = getAssetMapEtfFixture(ticker);
    const isEtf = isEtfHolding(ticker, holding);

    if (isEtf) {
      etfValueKRW += amountKRW;
      if (!etfFixture) {
        uncoveredEtfValueKRW += amountKRW;
        uncoveredEtfs.add(ticker);
        excludedHoldings.push({
          name: holding.name ?? ticker,
          ticker,
          reason: "constituents_unavailable",
          amountKRW: Math.round(amountKRW),
        });
        continue;
      }

      coveredEtfValueKRW += amountKRW;
      const fixtureWeightPct = etfFixture.constituents.reduce((sum, row) => sum + row.weightPct, 0);
      lookedThroughEtfValueKRW += amountKRW * (fixtureWeightPct / 100);
      if (fixtureWeightPct < 99.9) partialEtfs.set(ticker, roundPct(fixtureWeightPct));

      for (const constituent of etfFixture.constituents) {
        addEffectiveHolding(effectiveRows, {
          ticker: constituent.ticker,
          name: constituent.name,
          sector: constituent.sector,
          amountKRW: amountKRW * (constituent.weightPct / 100),
          source: ticker,
        });
      }
      continue;
    }

    directValueKRW += amountKRW;
    const sectorEntry = getAssetMapSectorEntry(ticker);
    addEffectiveHolding(effectiveRows, {
      ticker,
      name: sectorEntry.name !== ticker ? sectorEntry.name : holding.name || ticker,
      sector: sectorEntry.sector,
      amountKRW,
      source: "direct",
    });
  }

  for (const ticker of Array.from(uncoveredEtfs)) {
    warnings.push(`ETF 구성종목 데이터가 없어 ${ticker} ETF는 투시에 제외됩니다.`);
  }
  for (const [ticker, fixtureWeightPct] of Array.from(partialEtfs.entries())) {
    warnings.push(`${ticker} ETF fixture는 상위 구성종목 ${fixtureWeightPct}%만 분석합니다.`);
  }

  const analyzedValueKRW = Array.from(effectiveRows.values()).reduce(
    (sum, row) => sum + row.amountKRW,
    0,
  );

  const effectiveHoldingsTop = Array.from(effectiveRows.values())
    .sort((a, b) => b.amountKRW - a.amountKRW)
    .slice(0, 100)
    .map((row) => ({
      ticker: row.ticker,
      name: row.name,
      sector: row.sector,
      amountKRW: Math.round(row.amountKRW),
      weightPct: analyzedValueKRW > 0 ? roundPct((row.amountKRW / analyzedValueKRW) * 100) : 0,
      sources: Array.from(row.sources).sort((a, b) => (a === "direct" ? -1 : b === "direct" ? 1 : a.localeCompare(b))),
    }));

  const sectorAmounts = new Map<string, number>();
  for (const row of Array.from(effectiveRows.values())) {
    sectorAmounts.set(row.sector, (sectorAmounts.get(row.sector) ?? 0) + row.amountKRW);
  }

  const sectorAllocation = Array.from(sectorAmounts.entries())
    .map(([sector, amountKRW]) => ({
      sector,
      amountKRW: Math.round(amountKRW),
      weightPct: analyzedValueKRW > 0 ? roundPct((amountKRW / analyzedValueKRW) * 100) : 0,
    }))
    .sort((a, b) => b.amountKRW - a.amountKRW);

  return {
    source: totalValueKRW > 0 && analyzedValueKRW > 0 ? "portfolio" : "mock",
    totalValueKRW: Math.round(totalValueKRW),
    analyzedValueKRW: Math.round(analyzedValueKRW),
    directValueKRW: Math.round(directValueKRW),
    etfValueKRW: Math.round(etfValueKRW),
    coveredEtfValueKRW: Math.round(coveredEtfValueKRW),
    uncoveredEtfValueKRW: Math.round(uncoveredEtfValueKRW),
    coveragePct: etfValueKRW > 0 ? roundPct((lookedThroughEtfValueKRW / etfValueKRW) * 100) : 0,
    sectorAllocation,
    effectiveHoldingsTop,
    warnings,
    excludedHoldings,
  };
}
