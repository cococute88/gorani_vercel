// =============================================================
// ETF 구성종목 중복 분석.
//
// 데이터 출처: lib/asset-map-etf-constituents.ts 의 결정적(top-holdings)
// fixture (QQQ / SPY / SCHD + QLD/TQQQ/VOO/SPYM 프록시). 전체 구성종목이
// 아닌 상위 보유 종목 비중표이므로, 비중 합은 100% 미만일 수 있다.
//
// 핵심: 중복도는 "단순 종목 수"가 아니라 반드시 "비중"까지 반영한다.
//   - 공통 종목 수 / 종목 수  → 개수 기준 중복(참고용)
//   - 공통 종목 비중 합 / 전체 비중 합 → 실제 비중 기준 중복(핵심 지표)
//   - min-weight 합 → 양방향 공통 노출(서로 겹치는 최소 비중)
// =============================================================

import { getAssetMapEtfFixture } from "@/lib/asset-map-etf-constituents";
import type { HoldingComparisonRow, HoldingRow, OverlapResult } from "@/lib/stock-compare/types";

function round(value: number, digits = 1): number {
  return Number(value.toFixed(digits));
}

export function getHoldings(ticker: string): HoldingRow[] {
  const fixture = getAssetMapEtfFixture(ticker.trim().toUpperCase());
  if (!fixture) return [];
  return fixture.constituents
    .map((c) => ({ ticker: c.ticker, name: c.name, sector: c.sector, weightPct: c.weightPct }))
    .sort((a, b) => b.weightPct - a.weightPct);
}

const EMPTY_OVERLAP: OverlapResult = {
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
  const holdingsA = getHoldings(tickerA);
  const holdingsB = getHoldings(tickerB);

  if (holdingsA.length === 0 || holdingsB.length === 0) {
    return { ...EMPTY_OVERLAP, holdingsA, holdingsB, comparisonRows: buildComparisonRows(holdingsA, holdingsB) };
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
