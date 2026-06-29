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

function positiveAmount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * 한 재무자산 행의 "현금성 확신도"를 매긴다 (이중집계 잔여분을 잘라낼 때의 우선순위).
 *   2 = 명시적 현금성 (category 현금/예적금 또는 강한 현금성 신호) — 항상 현금으로 본다.
 *   1 = 모호(ambiguous) — 현금 신호도 투자 신호도 없는 "기타" 류. 보험 해약환급금 같은
 *       비투자 자산일 수도, 키워드가 빠진 투자 계좌 잔액일 수도 있다.
 * (투자 신호가 있는 행은 애초에 selectAllocationFinanceAssets 에서 제외되므로 여기 오지 않는다.)
 */
function cashConfidence(asset: FinanceAsset): 1 | 2 {
  if (asset.category === "현금" || asset.category === "예적금") return 2;
  const text = financeAssetText(asset);
  if (includesAny(text, CASH_OVERRIDE_SIGNALS)) return 2;
  return 1;
}

export interface SelectAllocationFinanceAssetsOptions {
  /**
   * 스냅샷이 내려준 "권위 있는" 현금 합계(total_cash_krw). 존재하면, 보유종목이 있을 때
   * 선별된 현금성 잔액 합계가 이 값을 넘지 않도록 reconcile 한다(아래 설명 참고).
   * 오프라인/레거시(권위 합계 없음) 스냅샷에서는 undefined 로 두면 기존 키워드 동작만 한다.
   */
  authoritativeCashKRW?: number | null;
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
 * 권위 합계 anchor(PORTFOLIO-TOTAL-CONSISTENCY-FIX-2):
 *   키워드 기반 투자행 제외(isInvestmentFinanceAsset)는 producer 가 투자 계좌 행에
 *   기대한 키워드(투자/연금/증권/위탁/ETF...)를 안 넣어주면 일부 행이 빠져나가
 *   holdings 와 이중집계되어 총자산이 부풀어 오른다(예: 권위 총자산 6.51억인데 도넛은
 *   7.52억). 따라서 스냅샷이 권위 있는 현금 합계(total_cash_krw)를 주면, 선별된
 *   현금성 잔액 합계가 그 값을 넘는 경우(=키워드를 빠져나간 투자 계좌 잔액이 남은 경우)
 *   현금성 확신도가 낮은(모호한) 행부터 권위 현금 한도까지만 남기고 초과분을 떨궈
 *   "holdings + 현금 = 권위 총자산" 이 성립하도록 reconcile 한다.
 *   이는 숫자를 임의로 보정하는 게 아니라(각 행 금액은 그대로 유지) 잘못된 합산 경로를
 *   단일 기준(스냅샷 권위 합계)에 맞추는 수정이다.
 *
 * 이 함수를 모든 자산 배분 차트가 공유하므로, 동일 스냅샷에서 모든 차트의 총자산
 * 기준이 일치한다.
 */
export function selectAllocationFinanceAssets(
  holdings: readonly Holding[] | null | undefined,
  financeAssets: readonly FinanceAsset[] | null | undefined,
  options: SelectAllocationFinanceAssetsOptions = {},
): FinanceAsset[] {
  const hasHoldings = (holdings?.length ?? 0) > 0;
  const nonDebt = (financeAssets ?? []).filter((asset) => asset.isDebt !== true);

  // 보유종목이 없으면 중복될 대상이 없다 → 비부채 재무자산을 모두 사용.
  if (!hasHoldings) return nonDebt;

  // 1차: 키워드로 투자 계좌(보유종목과 중복)로 판별된 행을 제외한다(기존 동작).
  const keywordKept = nonDebt.filter((asset) => !isInvestmentFinanceAsset(asset));

  const authoritativeCashKRW = options.authoritativeCashKRW;
  if (
    typeof authoritativeCashKRW !== "number" ||
    !Number.isFinite(authoritativeCashKRW) ||
    authoritativeCashKRW < 0
  ) {
    // 권위 현금 합계가 없는(레거시/오프라인) 스냅샷 → 키워드 결과를 그대로 사용(회귀 없음).
    return keywordKept;
  }

  // 2차: 권위 현금 합계로 reconcile. 키워드 결과 합계가 권위 현금을 (오차범위 내에서)
  // 넘지 않으면 그대로 사용한다(=키워드 제외만으로 충분했던 정상 케이스, 회귀 없음).
  const tolerance = Math.max(1000, authoritativeCashKRW * 0.005);
  const keptSum = keywordKept.reduce((sum, asset) => sum + positiveAmount(asset.amountKRW), 0);
  if (keptSum <= authoritativeCashKRW + tolerance) {
    return keywordKept;
  }

  // 초과분 존재 = 키워드를 빠져나간 투자 계좌 잔액이 현금성에 섞여 있다.
  // 현금성 확신도 높은 행(명시적 현금/예적금)을 먼저 확정해 항상 보존하고,
  // 모호한 행은 권위 현금 한도 안에서만 남긴다(한도를 넘기는 모호한 큰 금액 = 투자 잔액 → 제외).
  const ranked = [...keywordKept].sort((a, b) => {
    const confDiff = cashConfidence(b) - cashConfidence(a); // 확신도 높은 행 우선
    if (confDiff !== 0) return confDiff;
    return positiveAmount(a.amountKRW) - positiveAmount(b.amountKRW); // 같은 확신도면 작은 금액 우선
  });

  const reconciled: FinanceAsset[] = [];
  let running = 0;
  for (const asset of ranked) {
    const amount = positiveAmount(asset.amountKRW);
    if (running + amount <= authoritativeCashKRW + tolerance) {
      reconciled.push(asset);
      running += amount;
    }
    // 한도를 넘기는 행은 건너뛴다(키워드를 빠져나간 투자 계좌 잔액으로 간주).
  }

  // 원본 순서를 보존해 반환한다(정렬은 선별에만 사용).
  const keepSet = new Set(reconciled);
  return keywordKept.filter((asset) => keepSet.has(asset));
}
