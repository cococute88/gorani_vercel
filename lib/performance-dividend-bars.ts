// =============================================================
// 투자성과 "평가금 추이" 차트의 배당 막대 데이터.
// 스냅샷별로 위탁/절세 계좌의 환산예상배당(평가금액 × 3.5%)과
// 위탁 연간예상배당(실배당 TTM 라이브 추정)을 계산한다.
//
// 기존 함수를 그대로 재사용한다 (중복 구현 금지):
//  - buildDividendHoldingGroupsFromSnapshot: 위탁/절세 그룹 분류 + 평가금액 합계
//  - computeConvertedAnnualDividendKRW: 환산예상배당 (배당현황과 동일한 3.5% 방식)
//  - buildDividendEstimateForHolding: 종목별 실배당 TTM 기반 연간예상배당
// =============================================================

import type { PortfolioSnapshot } from "./portfolio-types";
import { buildDividendHoldingGroupsFromSnapshot } from "./dividend-holdings-from-portfolio";
import {
  buildDividendEstimateForHolding,
  computeConvertedAnnualDividendKRW,
  type DividendEstimateMarketData,
} from "./dividend-estimates";

export type PerformanceDividendBarPoint = {
  date: string;
  label: string;
  // 위탁계좌 연간예상배당 (실배당 TTM 라이브 추정) — 왼쪽 초록 막대.
  taxableAnnualKRW: number;
  // 위탁계좌 환산예상배당 (평가금액 × 3.5%) — 오른쪽 stacked 하단(파랑).
  taxableConvertedKRW: number;
  // 절세계좌 환산예상배당 (평가금액 × 3.5%) — 오른쪽 stacked 상단(겨자).
  taxAdvantagedConvertedKRW: number;
  // 합산 환산예상배당 (위탁 + 절세) — 툴팁 표기용.
  combinedConvertedKRW: number;
};

function isValidDate(value: string | undefined | null): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function labelOf(date: string): string {
  const [, month, day] = date.split("-");
  return `${month}.${day}`;
}

// 차트의 위탁 연간예상배당 막대에 필요한 시세 티커(배당 버킷) 집합.
// 모든 스냅샷의 위탁 보유종목 displayTicker(SCHD/SPY/MSFT 등)를 모은다.
export function collectPerformanceDividendTickers(snapshots: PortfolioSnapshot[]): string[] {
  const tickers = new Set<string>();
  for (const snapshot of snapshots) {
    const groups = buildDividendHoldingGroupsFromSnapshot(snapshot, false);
    for (const row of groups.taxableHoldings) {
      const ticker = row.ticker?.trim().toUpperCase();
      if (ticker) tickers.add(ticker);
    }
  }
  return Array.from(tickers).sort();
}

export function buildPerformanceDividendBars(
  snapshots: PortfolioSnapshot[],
  marketDataByTicker: Record<string, DividendEstimateMarketData>,
  options: { afterTax?: boolean } = {},
): PerformanceDividendBarPoint[] {
  const afterTax = options.afterTax ?? true;

  return snapshots
    .filter((snapshot) => isValidDate(snapshot.snapshotDate))
    .map((snapshot) => {
      const date = snapshot.snapshotDate;
      const groups = buildDividendHoldingGroupsFromSnapshot(snapshot, afterTax);

      // 환산예상배당: 위탁/절세 평가금액에 배당현황과 동일한 3.5% 방식 적용.
      const taxableConvertedKRW = computeConvertedAnnualDividendKRW(groups.taxableTotalKRW, { afterTax });
      const taxAdvantagedConvertedKRW = computeConvertedAnnualDividendKRW(groups.taxAdvantagedTotalKRW, { afterTax });

      // 위탁 연간예상배당: 위탁 보유종목별 실배당 TTM 추정(배당현황과 동일한 함수).
      const taxableAnnualKRW = groups.taxableHoldings.reduce((sum, row) => {
        const ticker = row.ticker.trim().toUpperCase();
        const estimate = buildDividendEstimateForHolding(
          { ticker, valueKRW: row.valueKRW, principalKRW: row.principalKRW },
          marketDataByTicker[ticker] ?? {},
          { afterTax },
        );
        return sum + (estimate.annualDividendKRW ?? 0);
      }, 0);

      return {
        date,
        label: labelOf(date),
        taxableAnnualKRW,
        taxableConvertedKRW,
        taxAdvantagedConvertedKRW,
        combinedConvertedKRW: taxableConvertedKRW + taxAdvantagedConvertedKRW,
      } satisfies PerformanceDividendBarPoint;
    })
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
