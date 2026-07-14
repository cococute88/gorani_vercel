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
  "증권",
  "BROKER",
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

function devLogAccountClassification(
  input: AccountStatusClassifiable,
  result: AccountStatusGroup,
  matchedRule: string,
  fallbackReason?: string,
): void {
  if (process.env.NODE_ENV === "production") return;
  console.info("[Account Classification]", {
    accountName: input.name ?? null,
    accountGroup: input.statusGroup ?? null,
    accountCategory: input.type ?? null,
    accountType: input.tax ?? null,
    matchedRule,
    fallbackReason: fallbackReason ?? null,
    result,
  });
}

// 계좌 카드/보유 신호를 보고 위탁/절세를 판단한다. 신호가 전혀 없으면 "미확인".
export function classifyAccountStatusGroup(input: AccountStatusClassifiable): AccountStatusGroup {
  const haystack = [input.name, input.type, input.statusGroup, input.tax]
    .filter(Boolean)
    .join(" ");

  // 절세 신호를 먼저 검사한다 (비과세 ⊃ 과세 문자열 충돌 회피).
  if (includesSignal(haystack, TAX_SAVING_SIGNALS)) {
    devLogAccountClassification(input, "절세", "tax-saving-signal");
    return "절세";
  }
  if (includesSignal(haystack, BROKERAGE_SIGNALS)) {
    devLogAccountClassification(input, "위탁", "brokerage-signal");
    return "위탁";
  }
  devLogAccountClassification(input, "미확인", "fallback", "no tax-saving or brokerage signal matched");
  return "미확인";
}

// =============================================================
// 계좌 그룹(②) 라벨 표준화.
//
// 기존(localStorage/XLSX) Portfolio 에서는 사용자가 상품명에 `②연금` / `②ISA`
// 태그를 붙여, 연금·IRP 계열 계좌가 모두 하나의 "연금" 카드로, ISA 계열이 하나의
// "ISA" 카드로 합산되었다. 그러나 Firestore producer 는 동일 계좌를 원래 계좌명
// (예: "한투개인형IRP", "개인형IRP")으로 내보내므로, 태그 데코레이션만으로는
// 계좌 그룹 키가 계좌명마다 갈라져 카드가 분리되고 "분류 미확인 계좌"가 생긴다.
//
// 이 함수는 Firestore → 기존 Portfolio Snapshot 변환 단계에서 계좌 그룹 라벨을
// 기존 ② 태그와 동일한 표준 라벨로 되돌린다(연금/ISA 계열만 합치고, 위탁/달러/원
// 등 이미 표준인 라벨은 그대로 둔다). 합계/총자산/차트 계산식은 바뀌지 않으며,
// 어떤 계좌가 어느 카드로 묶이는지(그룹핑)만 기존과 동일하게 맞춘다.
// =============================================================

// 연금(세제혜택) 계좌 신호. 기존 Portfolio 의 "연금" 카드로 합산되던 계좌들이다.
const PENSION_GROUP_SIGNALS = ["IRP", "퇴직연금", "연금저축", "개인연금", "연금"];
// ISA 계좌 신호. 기존 Portfolio 의 "ISA" 카드로 합산되던 계좌들이다.
const ISA_GROUP_SIGNALS = ["ISA"];

/**
 * 계좌 그룹(②) 라벨을 기존 Portfolio 와 동일한 표준 라벨로 정규화한다.
 * - ISA 계열  → "ISA"
 * - 연금/IRP 계열 → "연금"
 * - 그 외(위탁/달러/원 등)는 입력값을 그대로 반환한다.
 *
 * 이미 표준 라벨("연금"/"ISA")인 경우 동일 값을 반환하므로 idempotent 하다.
 */
export function canonicalizeAccountGroupLabel(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  const trimmed = raw.trim();
  if (!trimmed) return raw;
  const upper = trimmed.toUpperCase();
  if (ISA_GROUP_SIGNALS.some((signal) => upper.includes(signal.toUpperCase()))) return "ISA";
  if (PENSION_GROUP_SIGNALS.some((signal) => upper.includes(signal.toUpperCase()))) return "연금";
  return trimmed;
}

export const ACCOUNT_STATUS_GROUP_ORDER: AccountStatusGroup[] = ["위탁", "절세", "미확인"];

export const ACCOUNT_STATUS_GROUP_LABEL: Record<AccountStatusGroup, string> = {
  위탁: "위탁 계좌 현황",
  절세: "절세 계좌 현황",
  미확인: "분류 미확인 계좌",
};
