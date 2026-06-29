// =============================================================
// ACCOUNT-CARD-MIN-VISIBILITY-1
//
// 계좌 카드(AssetAccountCards) "표시 전용" 최소 평가금액 기준.
//
// 배경(원인):
//   계좌 행은 lib/portfolio-account-returns.ts 의 buildPortfolioAccountReturnRows
//   에서 "계좌 단위로 그룹핑된 뒤" MIN_VISIBLE_ACCOUNT_AMOUNT_KRW(20만원) 미만이
//   제외된다(그룹핑 → 필터 순서). 그 결과 행이 계좌 카드와 계좌별 비중 도넛에
//   동일하게 공급된다.
//
//   Firestore 전환 이후, 계좌 값의 source 가 보유종목(holdings)에서 재무현황
//   (financial_status → financeAssets)으로 바뀌었다(useFinanceValues =
//   financeTotals.size > 0). financial_status 는 계좌 단위 잔액을 더 잘게 나열해
//   (입출금/파킹/소액 예수금 등) 20만원~100만원 구간의 소액 계좌까지 행으로
//   만들어낸다. 기존 20만원 기준은 통과하므로 이 소액 계좌들이 "계좌 카드"로
//   다시 노출됐다. (legacy 보유종목 그룹핑에서는 이런 잘게 나뉜 소액 계좌 카드가
//   생기지 않았다.)
//
// 정책(요구사항):
//   - 평가금액 100만원 미만 계좌는 "계좌 카드"를 만들지 않는다(기존 UX 복원).
//   - 이는 표시(UI) 전용이다. 총자산/계좌 합계/차트/파싱 결과/Firestore 데이터/
//     계산식/수익률(buildPortfolioAccountReturnRows 등)은 절대 바꾸지 않는다.
//   - 계좌 "그룹핑 이후" 단계에서만 적용한다(그룹핑된 계좌 평가금액 기준).
// =============================================================

import type { PortfolioAccountRow } from "./portfolio-from-snapshots";

// 계좌 카드로 노출할 최소 평가금액(원). 이 금액 미만 계좌는 카드만 숨긴다(데이터/계산 불변).
export const MIN_VISIBLE_ACCOUNT_CARD_AMOUNT_KRW = 1_000_000;

/** 계좌 카드로 표시할 만한 계좌인지(평가금액 100만원 이상) 판별한다. */
export function isVisibleAccountCard(
  row: Pick<PortfolioAccountRow, "value">,
): boolean {
  return (
    typeof row.value === "number" &&
    Number.isFinite(row.value) &&
    row.value >= MIN_VISIBLE_ACCOUNT_CARD_AMOUNT_KRW
  );
}

/** 계좌 카드 표시 대상만 추린다(원본 배열은 보존, 표시 전용). */
export function selectVisibleAccountCards(
  rows: readonly PortfolioAccountRow[],
): PortfolioAccountRow[] {
  return rows.filter(isVisibleAccountCard);
}
