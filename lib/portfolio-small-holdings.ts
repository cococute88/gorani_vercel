// =============================================================
// 보유종목 리스트(표시용) 소액 항목 숨김 helper.
//
// /portfolio-manager 보유종목 리스트가 #소액/소액 잔량으로 길어지지 않도록
// "표시 단계"에서만 숨긴다. parser 원천 데이터/저장 데이터는 건드리지 않는다.
// (parser 단계 원천 제외는 후속 Codex 작업 — docs/PORTFOLIO_MANAGER_SUMMARY_UX_POLISH1.md 참고.)
// =============================================================

import type { Holding } from "./portfolio-types";

// 평가금액(valueKRW)이 이 금액 미만이면 소액으로 본다.
export const SMALL_HOLDING_THRESHOLD_KRW = 200000;

// 표시 단계에서 숨길 소액 보유종목인지 판정한다.
//   1) #소액 태그/이름이면 숨김
//   2) 평가금액이 양수이고 임계값 미만이면 숨김
//   3) 금액이 없고(0/누락) 소액 태그도 없으면 표시(false)
export function isHiddenSmallHolding(holding: Holding): boolean {
  const tagText = `${holding.tag ?? ""} ${holding.cleanName ?? ""} ${holding.productName ?? ""}`;
  if (tagText.includes("소액")) return true;

  const value = holding.valueKRW;
  if (typeof value === "number" && Number.isFinite(value) && value > 0 && value < SMALL_HOLDING_THRESHOLD_KRW) {
    return true;
  }
  return false;
}

export interface SplitSmallHoldingsResult {
  visible: Holding[];
  hidden: Holding[];
  hiddenCount: number;
}

// 보유종목을 표시용(visible)과 소액 숨김(hidden)으로 나눈다.
export function splitSmallHoldings(
  holdings: readonly Holding[] | null | undefined,
): SplitSmallHoldingsResult {
  const visible: Holding[] = [];
  const hidden: Holding[] = [];
  for (const holding of holdings ?? []) {
    if (isHiddenSmallHolding(holding)) hidden.push(holding);
    else visible.push(holding);
  }
  return { visible, hidden, hiddenCount: hidden.length };
}
