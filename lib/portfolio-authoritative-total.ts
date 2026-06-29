// =============================================================
// PORTFOLIO-TOTAL-CONSISTENCY-FIX-3
//
// 포트폴리오 전체(모든 도넛/자산군/자산구성/목적별/투자·현금/월별 추이)가 공유하는
// "유일한 총자산 기준" 접근점 + 현금 anchor.
//
// 배경(원인 — FIX-1/FIX-2 이후에도 남은 잔차):
//   bs-report-auto 가 Firestore 에 내려준 스냅샷은 8개 권위 합계
//   (current_snapshot.total_assets_krw / total_investments_krw / total_cash_krw …)
//   를 담는다. KPI·파싱요약·히스토리는 이 권위값을 그대로 쓴다(6.51억).
//   반면 자산 배분 차트는 보유종목(holdings)+재무현황(financeAssets)을 직접 합산해
//   총자산을 만들었다. FIX-1(키워드 dedup) + FIX-2(권위 현금 합계로 row 단위 reconcile)
//   로도 잔차가 남는다:
//     - row 단위 drop 만 가능해 권위 현금 합계에 "정확히" 맞출 수 없고,
//     - Σ(holdings) 가 total_investments_krw 와 미세하게 다르면 끝까지 어긋난다.
//   그래서 같은 스냅샷인데도 도넛 중앙 총자산이 7.52억 / 7.83억 / 7.74억 / 6.95억
//   처럼 차트마다 달라졌다.
//
// 해결(이 모듈):
//   "총자산 = 권위 total_assets_krw" 를 단일 기준으로 삼고, 자산 배분 차트의
//   현금성(비투자) bucket 을 권위 remainder(= total_assets − Σ보유종목평가금액)에
//   "정확히" 맞춘다. 보유종목(투자) 평가금액은 실제 값을 그대로 둔다(트리맵/랭킹의
//   종목 금액 왜곡 방지). 현금성 행은 권위 remainder 에 비례 스케일해 통화(원화/달러)
//   분해 비율을 보존한다. 이는 KPI 의 "현금성/기타 = 총자산 − 투자" 와 동일한 정의이며,
//   숫자를 임의로 만드는 게 아니라 "잘못된 합산 경로를 권위 합계 단일 기준에 맞추는"
//   수정이다. 권위 합계가 없는 레거시/오프라인 스냅샷은 손대지 않는다(기존 동작 유지).
// =============================================================

import type { FinanceAsset, Holding, PortfolioSnapshot } from "./portfolio-types";
import { isAllocationChartAmountVisible } from "./allocation-chart-filter";

type SnapshotLike = Pick<PortfolioSnapshot, "authoritativeTotals" | "totalAssetKRW"> &
  Partial<Pick<PortfolioSnapshot, "investmentValueKRW">>;

function positiveFinite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * 스냅샷의 "유일한 총자산 기준"(권위 total_assets_krw)을 반환한다.
 * Firestore 계약 스냅샷이면 authoritativeTotals.totalAssetsKRW 를, 그 값이 없으면
 * 동일 값으로 stamp 되는 totalAssetKRW 를 쓴다. 둘 다 없으면 null(레거시/오프라인).
 */
export function getAuthoritativeTotalAssetsKRW(
  snapshot: SnapshotLike | null | undefined,
): number | null {
  if (!snapshot) return null;
  const authoritative = positiveFinite(snapshot.authoritativeTotals?.totalAssetsKRW);
  if (authoritative !== null) return authoritative;
  // 권위 합계 객체가 없는 경우에만 totalAssetKRW 를 폴백으로 본다.
  // (레거시/오프라인 스냅샷은 authoritativeTotals 가 없고, 이 경우 차트는 자가합산을
  //  유지해야 하므로 여기서도 null 을 반환해 anchor 를 끈다.)
  return snapshot.authoritativeTotals ? authoritative : null;
}

/** 권위 현금 합계(total_cash_krw). 없으면 null. */
export function getAuthoritativeTotalCashKRW(
  snapshot: SnapshotLike | null | undefined,
): number | null {
  const cash = snapshot?.authoritativeTotals?.totalCashKRW;
  return typeof cash === "number" && Number.isFinite(cash) && cash >= 0 ? cash : null;
}

/** 권위 투자 평가금액 합계(total_investments_krw). 없으면 null. */
export function getAuthoritativeTotalInvestmentsKRW(
  snapshot: SnapshotLike | null | undefined,
): number | null {
  const inv = snapshot?.authoritativeTotals?.totalInvestmentsKRW;
  return typeof inv === "number" && Number.isFinite(inv) && inv >= 0 ? inv : null;
}

/** 보유종목 평가금액 합계(유효 금액만). */
export function sumHoldingValuesKRW(
  holdings: readonly Holding[] | null | undefined,
): number {
  let sum = 0;
  for (const holding of holdings ?? []) {
    if (isAllocationChartAmountVisible(holding.valueKRW)) sum += holding.valueKRW;
  }
  return sum;
}

function positiveAmount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

// 현금성 행이 0건일 때, 권위 remainder 를 담을 합성(synthetic) 현금성 자산 1건을 만든다.
// productName/category 를 현금성으로 두어 모든 분류기(getAssetType/classifyAssetClass/
// classifyFinanceAssetPurposeGroup)가 "현금/원화/현금(원)" 으로 일관되게 잡도록 한다.
function makeSyntheticCashAsset(amountKRW: number): FinanceAsset {
  return {
    id: "authoritative-cash-remainder",
    groupName: "현금성 자산",
    productName: "현금성 자산",
    cleanName: "현금성 자산",
    amountKRW: Math.round(amountKRW),
    inferredTag: "#현금",
    category: "현금",
  };
}

/**
 * 자산 배분 차트의 현금성(비투자) 재무자산을 권위 총자산 remainder 에 "정확히" 맞춘다.
 *
 *   target(현금성 합계) = max(0, 권위 총자산 − Σ보유종목평가금액)
 *
 * - 입력 financeAssets 는 이미 selectAllocationFinanceAssets(키워드 dedup + 부채 제외)로
 *   투자 계좌 중복분을 걸러낸 "현금성 후보" 행이어야 한다.
 * - 현금성 행이 있으면 target 합계가 되도록 각 행 금액을 비례 스케일한다(원화/달러 분해 보존).
 * - 현금성 행이 없고 target>0 이면 합성 현금성 1건을 만든다.
 * - target<=0 (보유종목만으로 총자산 도달/초과)이면 현금성 bucket 을 비운다.
 * - 권위 총자산이 없으면(authoritativeTotalAssetsKRW=null) 손대지 않고 그대로 반환한다.
 *
 * 결과적으로 Σ보유종목 + Σ(반환 현금성) == 권위 총자산 이 성립해, 이 입력을 쓰는 모든
 * 도넛/자산군/목적별 차트의 총자산이 권위 총자산과 100% 일치한다.
 */
export function anchorFinanceAssetsToAuthoritativeTotal(
  holdings: readonly Holding[] | null | undefined,
  financeAssets: readonly FinanceAsset[] | null | undefined,
  authoritativeTotalAssetsKRW: number | null | undefined,
): FinanceAsset[] {
  const rows = (financeAssets ?? []).slice();

  // 권위 총자산이 없으면(레거시/오프라인) 자가합산 동작을 유지한다.
  if (
    typeof authoritativeTotalAssetsKRW !== "number" ||
    !Number.isFinite(authoritativeTotalAssetsKRW) ||
    authoritativeTotalAssetsKRW <= 0
  ) {
    return rows;
  }

  const investmentSum = sumHoldingValuesKRW(holdings);
  const targetCash = authoritativeTotalAssetsKRW - investmentSum;

  // 보유종목만으로 권위 총자산에 도달/초과(잔여 현금성 없음) → 현금성 bucket 제거.
  if (targetCash <= 0) return [];

  const cashSum = rows.reduce((sum, asset) => sum + positiveAmount(asset.amountKRW), 0);

  // 현금성 행이 없으면 권위 remainder 를 담을 합성 현금성 1건 생성.
  if (cashSum <= 0) return [makeSyntheticCashAsset(targetCash)];

  // 이미 (오차범위 내) 일치하면 그대로 둔다(스케일로 인한 불필요한 반올림 방지).
  const tolerance = Math.max(1, targetCash * 1e-6);
  if (Math.abs(cashSum - targetCash) <= tolerance) return rows;

  // 현금성 합계가 권위 remainder 가 되도록 각 행을 비례 스케일(원화/달러 비율 보존).
  const factor = targetCash / cashSum;
  return rows.map((asset) => ({
    ...asset,
    amountKRW: Math.round(positiveAmount(asset.amountKRW) * factor),
  }));
}
