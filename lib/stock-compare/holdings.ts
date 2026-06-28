// =============================================================
// ETF 구성종목 중복 분석.
//
// 데이터 출처/우선순위(Fallback 체인)
//   1차) lib/asset-map-etf-constituents.ts 의 직접 fixture(QQQ/SPY/SCHD/SPMO …).
//   2차) 동일 지수 별칭(alias) → 대표 fixture 로 look-through
//        (예: IVV/SPLG/VTI → SPY, QQQM → QQQ).
//   3차) fixture 도 별칭도 없으면 "구성종목 없음"으로 처리하되,
//        개별 종목(stock)인지 지원되지 않는 ETF(unsupported)인지 원인을 구분한다.
//
// 핵심: 중복도는 "단순 종목 수"가 아니라 반드시 "비중"까지 반영한다.
//   - 공통 종목 수 / 종목 수  → 개수 기준 중복(참고용)
//   - 공통 종목 비중 합 / 전체 비중 합 → 실제 비중 기준 중복(핵심 지표)
//   - min-weight 합 → 양방향 공통 노출(서로 겹치는 최소 비중)
// =============================================================

import {
  ASSET_MAP_ETF_CONSTITUENTS,
  ASSET_MAP_ETF_ALIASES,
  KNOWN_ASSET_MAP_ETF_TICKERS,
  getAssetMapEtfFixture,
  resolveEtfFixtureTicker,
} from "@/lib/asset-map-etf-constituents";
import type {
  HoldingComparisonRow,
  HoldingRow,
  HoldingsResolution,
  HoldingsStatus,
  OverlapResult,
} from "@/lib/stock-compare/types";

function round(value: number, digits = 1): number {
  return Number(value.toFixed(digits));
}

// 현재 코드 기준으로 구성종목 분석이 가능한 ETF 티커 전체(직접 fixture + 별칭).
export function supportedHoldingsTickers(): string[] {
  return Array.from(
    new Set([...Object.keys(ASSET_MAP_ETF_CONSTITUENTS), ...Object.keys(ASSET_MAP_ETF_ALIASES)]),
  ).sort();
}

// 한 티커의 구성종목을 Fallback 체인에 따라 해석한다.
//   직접 fixture → 별칭(alias) fixture → 없음(원인 구분).
export function resolveHoldings(rawTicker: string): HoldingsResolution {
  const ticker = rawTicker.trim().replace(/^\$/, "").replace(/\s+/g, "").toUpperCase();

  // 1차: 직접 fixture.
  const direct = ASSET_MAP_ETF_CONSTITUENTS[ticker];
  if (direct) {
    return { ticker, holdings: toHoldingRows(direct.constituents), status: "ok", proxyOf: null };
  }

  // 2차: 동일 지수 별칭 → 대표 fixture.
  const proxyTicker = resolveEtfFixtureTicker(ticker);
  if (proxyTicker !== ticker) {
    const proxied = getAssetMapEtfFixture(proxyTicker);
    if (proxied) {
      return {
        ticker,
        holdings: toHoldingRows(proxied.constituents),
        status: "proxy",
        proxyOf: proxyTicker,
      };
    }
  }

  // 3차: 데이터 없음. 지원되지 않는 ETF 인지, 개별 종목인지 구분한다.
  const status: HoldingsStatus = KNOWN_ASSET_MAP_ETF_TICKERS.has(ticker) ? "unsupported" : "stock";
  return { ticker, holdings: [], status, proxyOf: null };
}

function toHoldingRows(
  constituents: { ticker: string; name: string; sector: string; weightPct: number }[],
): HoldingRow[] {
  return constituents
    .map((c) => ({ ticker: c.ticker, name: c.name, sector: c.sector, weightPct: c.weightPct }))
    .sort((a, b) => b.weightPct - a.weightPct);
}

export function getHoldings(ticker: string): HoldingRow[] {
  return resolveHoldings(ticker).holdings;
}

const EMPTY_OVERLAP: Omit<OverlapResult, "statusA" | "statusB" | "proxyOfA" | "proxyOfB"> = {
  hasHoldings: false,
  commonTickers: [],
  commonCount: 0,
  countOverlapPctA: 0,
  countOverlapPctB: 0,
  weightOverlapPctA: 0,
  weightOverlapPctB: 0,
  mutualWeightPct: 0,
  holdingsA: [],
  holdingsB: [],
  comparisonRows: [],
};

// 두 종목의 Top-N 보유 종목을 순위별로 나란히 병합한 비교 행.
function buildComparisonRows(
  holdingsA: HoldingRow[],
  holdingsB: HoldingRow[],
): HoldingComparisonRow[] {
  const rows: HoldingComparisonRow[] = [];
  const max = Math.max(holdingsA.length, holdingsB.length);
  for (let i = 0; i < max; i += 1) {
    rows.push({ rank: i + 1, a: holdingsA[i] ?? null, b: holdingsB[i] ?? null });
  }
  return rows;
}

export function analyzeOverlap(tickerA: string, tickerB: string): OverlapResult {
  const resA = resolveHoldings(tickerA);
  const resB = resolveHoldings(tickerB);
  const holdingsA = resA.holdings;
  const holdingsB = resB.holdings;

  const statusFields = {
    statusA: resA.status,
    statusB: resB.status,
    proxyOfA: resA.proxyOf,
    proxyOfB: resB.proxyOf,
  };

  if (holdingsA.length === 0 || holdingsB.length === 0) {
    return {
      ...EMPTY_OVERLAP,
      ...statusFields,
      holdingsA,
      holdingsB,
      comparisonRows: buildComparisonRows(holdingsA, holdingsB),
    };
  }

  const weightByTickerA = new Map(holdingsA.map((h) => [h.ticker, h.weightPct]));
  const weightByTickerB = new Map(holdingsB.map((h) => [h.ticker, h.weightPct]));

  const commonTickers = holdingsA
    .map((h) => h.ticker)
    .filter((t) => weightByTickerB.has(t));

  const totalWeightA = holdingsA.reduce((sum, h) => sum + h.weightPct, 0);
  const totalWeightB = holdingsB.reduce((sum, h) => sum + h.weightPct, 0);

  // 공통 종목 비중 합(각 ETF 내부 비중 기준).
  const commonWeightA = commonTickers.reduce((sum, t) => sum + (weightByTickerA.get(t) ?? 0), 0);
  const commonWeightB = commonTickers.reduce((sum, t) => sum + (weightByTickerB.get(t) ?? 0), 0);

  // 양방향 공통 노출 = Σ min(weightA, weightB).
  const mutualWeight = commonTickers.reduce(
    (sum, t) => sum + Math.min(weightByTickerA.get(t) ?? 0, weightByTickerB.get(t) ?? 0),
    0,
  );

  return {
    hasHoldings: true,
    ...statusFields,
    commonTickers,
    commonCount: commonTickers.length,
    countOverlapPctA: round((commonTickers.length / holdingsA.length) * 100),
    countOverlapPctB: round((commonTickers.length / holdingsB.length) * 100),
    // "전체 비중 합 대비 공통 비중" — top-holdings fixture 기준 상대 중복도.
    weightOverlapPctA: totalWeightA > 0 ? round((commonWeightA / totalWeightA) * 100) : 0,
    weightOverlapPctB: totalWeightB > 0 ? round((commonWeightB / totalWeightB) * 100) : 0,
    mutualWeightPct: round(mutualWeight),
    holdingsA,
    holdingsB,
    comparisonRows: buildComparisonRows(holdingsA, holdingsB),
  };
}
