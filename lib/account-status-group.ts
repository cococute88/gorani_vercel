// =============================================================
// 계좌 현황 분류 헬퍼 (위탁 / 절세 / 미확인)
// PORTFOLIO-PERF-UI-1: /portfolio 계좌 현황을 위탁/절세로 안전하게 나눈다.
//
// 데이터 모양이 계좌 레벨 분류를 항상 보장하지 않으므로, 신호가 없으면
// 추측하지 않고 "미확인"으로 둔다 (조용히 위탁으로 떨어뜨리지 않는다).
// =============================================================

export type AccountStatusGroup = "위탁" | "절세" | "미확인";

// 절세(세제혜택) 계좌 신호. "비과세"는 "과세"를 부분 문자열로 포함하므로
// 위탁 신호보다 먼저 검사한다.
const TAX_SAVING_SIGNALS = [
  "ISA",
  "연금저축",
  "미래연금",
  "퇴직연금",
  "IRP",
  "연금",
  "절세",
  "비과세",
];

// 위탁(일반 과세 위탁) 계좌 신호.
const BROKERAGE_SIGNALS = [
  "위탁",
  "일반",
  "해외주식",
  "국내주식",
  "예수금",
  "현금",
  "과세",
];

export interface AccountStatusClassifiable {
  name?: string;
  type?: string;
  tax?: string;
  statusGroup?: string;
}

function includesSignal(haystack: string, signals: string[]): boolean {
  const upper = haystack.toUpperCase();
  return signals.some((signal) => upper.includes(signal.toUpperCase()));
}

// 계좌 카드/보유 신호를 보고 위탁/절세를 판단한다. 신호가 전혀 없으면 "미확인".
export function classifyAccountStatusGroup(input: AccountStatusClassifiable): AccountStatusGroup {
  const haystack = [input.name, input.type, input.statusGroup, input.tax]
    .filter(Boolean)
    .join(" ");

  // 절세 신호를 먼저 검사한다 (비과세 ⊃ 과세 문자열 충돌 회피).
  if (includesSignal(haystack, TAX_SAVING_SIGNALS)) return "절세";
  if (includesSignal(haystack, BROKERAGE_SIGNALS)) return "위탁";
  return "미확인";
}

export const ACCOUNT_STATUS_GROUP_ORDER: AccountStatusGroup[] = ["위탁", "절세", "미확인"];

export const ACCOUNT_STATUS_GROUP_LABEL: Record<AccountStatusGroup, string> = {
  위탁: "위탁 계좌 현황",
  절세: "절세 계좌 현황",
  미확인: "분류 미확인 계좌",
};
