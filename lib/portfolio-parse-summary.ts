// =============================================================
// 파싱 결과 요약(view model).
//
// "파싱 결과 요약" 카드는 두 곳에서 같은 모양으로 쓰인다.
//   1) 엑셀 업로드/파싱 직후 (ParseResult 기준)
//   2) 과거 스냅샷 상세(도넛 옆) (PortfolioSnapshot 기준)
//
// 두 source 를 같은 ParseSummaryModel 로 환산해 components/portfolio/ParseSummaryCard
// 한 컴포넌트로 렌더한다. (parser/계산 로직은 건드리지 않고 표시용으로만 환산한다.)
// =============================================================

import type { ParseResult } from "./banksalad-parser";
import type { FinanceAsset, Holding, PortfolioSnapshot } from "./portfolio-types";

export interface ParseSummaryModel {
  ok: boolean;
  caption: string; // 카드 우상단 보조 캡션 (시트명 · 날짜 등)
  totalAssetKRW: number; // 총 금융자산
  investmentValueKRW: number; // 투자자산 합계 (구 "평가금액 합계")
  cashAssetKRW: number | null; // 현금자산 (KRW/USD 현금성 합계, 불명확하면 null → "—")
  investmentPrincipalKRW: number; // 투자원금 합계
  returnAmountKRW: number; // 수익금
  returnPct: number; // 수익률(%)
  recognizedCount: number; // 인식 보유종목 수
  reviewCount: number; // 확인 필요 수
  excludedTotal: number; // 제외 항목 총합
  excludedSmallCount: number; // #소액 제외 수
  excludedBelowMinimumCount: number; // 최소금액 미만 제외 수
  quantityCount: number; // 보강: 수량
  currencyCount: number; // 보강: 통화
  tickerCount: number; // 보강: 티커
  priceCount: number; // 보강: 가격
}

// 현금자산 = 재무현황(financeAssets) 중 부채가 아니고 현금/예적금 계열인 항목 합계.
// 현금성 source 가 전혀 없으면(빈 배열/undefined) null 을 반환해 카드에서 "—" 로 표시한다.
// (KRW·USD 모두 banksalad-parser classifyAsset 이 "현금"/"예적금" 으로 분류한 금액을 쓴다.)
export function computeCashAssetKRW(
  financeAssets: readonly FinanceAsset[] | null | undefined,
): number | null {
  if (!financeAssets || financeAssets.length === 0) return null;
  const cashLike = financeAssets.filter(
    (asset) =>
      asset.isDebt !== true &&
      (asset.category === "현금" || asset.category === "예적금"),
  );
  if (cashLike.length === 0) return null;
  return cashLike.reduce((sum, asset) => sum + (asset.amountKRW ?? 0), 0);
}

function fieldCounts(holdings: readonly Holding[]) {
  return {
    quantityCount: holdings.filter((h) => h.quantity != null).length,
    currencyCount: holdings.filter((h) => Boolean(h.currency)).length,
    tickerCount: holdings.filter((h) => Boolean(h.ticker)).length,
    priceCount: holdings.filter((h) => h.currentPrice != null).length,
  };
}

export function parseSummaryFromResult(result: ParseResult): ParseSummaryModel {
  const reviewCount = result.holdings.filter((h) => h.needsReview).length;
  const excludedTotal = result.excludedSmallCount + result.excludedBelowMinimumCount;
  return {
    ok: result.ok,
    caption: `${result.sheetName} · ${result.snapshotDate}`,
    totalAssetKRW: result.totalAssetKRW,
    investmentValueKRW: result.investmentValueKRW,
    cashAssetKRW: computeCashAssetKRW(result.financeAssets),
    investmentPrincipalKRW: result.investmentPrincipalKRW,
    returnAmountKRW: result.returnAmountKRW,
    returnPct: result.returnPct,
    recognizedCount: result.holdings.length,
    reviewCount,
    excludedTotal,
    excludedSmallCount: result.excludedSmallCount,
    excludedBelowMinimumCount: result.excludedBelowMinimumCount,
    ...fieldCounts(result.holdings),
  };
}

export function parseSummaryFromSnapshot(
  snapshot: PortfolioSnapshot,
): ParseSummaryModel {
  const holdings = snapshot.holdings ?? [];
  const reviewCount = holdings.filter((h) => h.needsReview).length;
  const excludedSmallCount = snapshot.metadata?.excludedSmallCount ?? 0;
  const excludedBelowMinimumCount = snapshot.metadata?.excludedBelowMinimumCount ?? 0;
  return {
    ok: true,
    caption: `${snapshot.snapshotDate} 스냅샷`,
    totalAssetKRW: snapshot.totalAssetKRW,
    investmentValueKRW: snapshot.investmentValueKRW,
    cashAssetKRW: computeCashAssetKRW(snapshot.financeAssets),
    investmentPrincipalKRW: snapshot.investmentPrincipalKRW,
    returnAmountKRW: snapshot.returnAmountKRW,
    returnPct: snapshot.returnPct,
    recognizedCount: holdings.length,
    reviewCount,
    excludedTotal: excludedSmallCount + excludedBelowMinimumCount,
    excludedSmallCount,
    excludedBelowMinimumCount,
    ...fieldCounts(holdings),
  };
}
