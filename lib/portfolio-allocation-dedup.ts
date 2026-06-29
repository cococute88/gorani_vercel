// =============================================================
// PORTFOLIO-TOTAL-CONSISTENCY-FIX-1
//
// 자산 배분(도넛/자산군/자산구성/투자·현금 비중) 차트가 공유하는 "이중집계 방지"
// 단일 기준.
//
// 배경(원인):
//   bs-report-auto 가 Firestore 에 저장하는 스냅샷은
//     - current_snapshot : 8개 권위 합계 (총자산/투자/현금/...) — KPI·파싱요약이 사용
//     - investment_status : 보유종목(holdings) 상세
//     - financial_status  : 재무현황(financeAssets) — 현금/예적금뿐 아니라
//                           "투자성/연금/위탁/증권" 같은 투자 계좌 잔액까지 포함한
//                           "전체 자산 목록"
//   즉 investment_status(보유종목) 와 financial_status(재무현황) 는
//   투자 계좌 금액이 서로 겹친다(overlap). 그래서 holdings + financeAssets 를
//   단순 합산하면 투자 평가금액이 두 번 더해져 총자산이 약 2배로 부풀려진다.
//
//   기존 차트들은 이 중복을 막으려고 `asset.category === "투자성"` 인 재무자산만
//   제외했다. 하지만 그 "투자성" 문자열은 레거시 엑셀 파서(banksalad-parser)가
//   직접 찍어주던 분류값이고, Firestore 계약(producer)의 `category` 는 임의 문자열
//   (영문/원시 그룹명/빈 값 등)이라 정확히 "투자성" 이 아닐 수 있다. 그러면 제외가
//   동작하지 않아 투자 계좌 잔액이 살아남고 → 도넛 총자산이 KPI(권위 총자산)의
//   약 2배로 표시된다.
//
// 해결:
//   `category === "투자성"` 한 가지에만 의존하지 않고, 재무자산 행이 "투자 계좌(보유
//   종목과 중복되는 행)"인지 더 견고하게 판별한다. 현금성 신호를 먼저 확정(override)
//   하고, 그 외에 투자/연금/펀드/신탁/증권/위탁/주식/ETF/ISA/IRP 등 투자 신호가
//   있으면 투자 계좌로 보고 제외한다. 이도 저도 아닌(모호한) 행은 보유종목과 중복될
//   가능성이 낮으므로 레거시 동작 보존을 위해 그대로 둔다.
//
//   * 레거시(엑셀) 경로: 재무자산이 현금/예적금/투자성/기타 로 분류됨.
//       - 투자성 → 투자 신호로 제외 (기존과 동일)
//       - 현금/예적금 → 현금 override 로 유지 (기존과 동일)
//       - 기타(보험 등) → 유지 (기존과 동일, 회귀 없음)
//   * Firestore 경로: financial_status 의 투자 계좌 잔액(group_name/product_name 에
//       투자성/연금/증권/위탁 등 신호 포함) → 제외, 현금성 잔액 → 유지.
// =============================================================

import type { FinanceAsset, Holding } from "./portfolio-types";

// 현금성을 "확정"하는 신호. (모호한 "저축/채권" 은 의도적으로 제외한다 —
// "연금저축/저축보험/채권형펀드" 같은 투자 상품과 충돌하기 때문.)
const CASH_OVERRIDE_SIGNALS = [
  "현금",
  "예수금",
  "예치금",
  "입출금",
  "수시입출",
  "보통예금",
  "정기예금",
  "자유예금",
  "정기적금",
  "자유적금",
  "예적금",
  "예금",
  "적금",
  "cma",
  "mmf",
  "mmw",
  "mmda",
  "파킹",
  "통장",
  "대기자금",
  "rp",
  "청약",
  "달러",
  "외화",
  "usd",
  "us$",
  "sgov",
];

// 투자 계좌(= 보유종목과 중복되는 재무현황 행)를 가리키는 신호.
const INVESTMENT_SIGNALS = [
  "투자성",
  "투자",
  "펀드",
  "신탁",
  "연금",
  "irp",
  "isa",
  "퇴직",
  "변액",
  "랩",
  "wrap",
  "증권",
  "위탁",
  "주식",
  "etf",
  "etn",
  "수익증권",
  "els",
  "dls",
  "채권형",
  "리츠",
  "reit",
];

function financeAssetText(asset: FinanceAsset): string {
  return [
    asset.category,
    asset.groupName,
    asset.productName,
    asset.cleanName,
    asset.inferredTag,
    asset.statusGroup,
    asset.purposeGroup,
    asset.accountGroup,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function includesAny(haystack: string, signals: readonly string[]): boolean {
  return signals.some((signal) => haystack.includes(signal));
}

/**
 * 재무현황(financeAssets) 한 행이 "투자 계좌 잔액"인지(= 보유종목과 중복되어
 * 자산 배분 차트에서 이중집계를 일으키는 행인지) 판별한다.
 *
 * 우선순위:
 *   1) category 가 명시적 현금성(현금/예적금) → 현금 (투자 아님)
 *   2) 이름/그룹/태그에 강한 현금성 신호 → 현금 (투자 아님; 예: "키움증권 예수금")
 *   3) category 가 "투자성" → 투자 (레거시 동작)
 *   4) 이름/그룹/태그에 투자 신호(투자/연금/펀드/증권/위탁/주식/ETF/ISA/IRP 등) → 투자
 *   5) 그 외(모호/기타) → 투자 아님 (레거시 "기타" 보존)
 */
export function isInvestmentFinanceAsset(asset: FinanceAsset): boolean {
  if (asset.category === "현금" || asset.category === "예적금") return false;

  const text = financeAssetText(asset);
  if (includesAny(text, CASH_OVERRIDE_SIGNALS)) return false;
  if (asset.category === "투자성") return true;
  if (includesAny(text, INVESTMENT_SIGNALS)) return true;
  return false;
}

/**
 * 자산 배분 차트(자산군 도넛 / 자산군 합산 / 자산구성·투자현금 비중)가 공유하는
 * 재무자산 선별 기준.
 *
 *   - 부채(isDebt) 는 항상 제외한다.
 *   - 보유종목이 있으면(holdings.length > 0) 투자 계좌 잔액(보유종목과 중복)은
 *     제외해 이중집계를 막는다. (현금성 잔액만 남겨 holdings + 현금 = 총자산)
 *   - 보유종목이 없으면 중복될 대상이 없으므로 비부채 재무자산을 모두 사용한다.
 *
 * 이 함수를 모든 자산 배분 차트가 공유하므로, 동일 스냅샷에서 모든 차트의 총자산
 * 기준이 일치한다.
 */
export function selectAllocationFinanceAssets(
  holdings: readonly Holding[] | null | undefined,
  financeAssets: readonly FinanceAsset[] | null | undefined,
): FinanceAsset[] {
  const hasHoldings = (holdings?.length ?? 0) > 0;
  return (financeAssets ?? []).filter((asset) => {
    if (asset.isDebt === true) return false;
    if (hasHoldings && isInvestmentFinanceAsset(asset)) return false;
    return true;
  });
}
