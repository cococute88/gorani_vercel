// =============================================================
// 계좌별 종목 비중 집계 로직.
// 포트폴리오 관리 페이지의 "계좌별 종목 비중 조회" 카드에서 사용한다.
//
// 규칙 (작업 명세):
//   1. 동일 티커는 합산한다.
//   2. 비중은 합산 금액(평가금액) 기준으로 계산한다.
//   3. 평가금액 100만원 미만 종목은 제외한다.
//   4. 제외 후 남은 종목 기준으로 비중을 재계산한다.
//
// 종목명 표시:
//   - 미국(영문) 티커는 티커 그대로 표시한다 (TQQQ, SCHD, VOO ...).
//   - 한국 ETF / 숫자형 티커(133690, 360750 ...)는 가능하면 정식명칭으로 변환한다.
//   - 티커가 없으면 원본 종목명을 사용한다.
//   - 명칭 매핑에 실패하면 원본 데이터를 그대로 사용한다.
// =============================================================
import type { Holding } from "./portfolio-types";
import { KOREAN_ETF_MAPPINGS, findKoreanEtfMapping } from "./korean-etf-registry";

export type AccountTabKey = "전체" | "국내" | "해외" | "IRP" | "ISA" | "연금" | "비상장";

export const ACCOUNT_TABS: AccountTabKey[] = [
  "전체",
  "국내",
  "해외",
  "IRP",
  "ISA",
  "연금",
  "비상장",
];

// 평가금액 100만원 미만 종목은 비중 계산에서 제외한다.
export const MIN_HOLDING_VALUE_KRW = 1_000_000;

export interface AccountHoldingWeightSlice {
  key: string; // 그룹 키 (티커 또는 종목명)
  name: string; // 표시명
  ticker?: string;
  valueKRW: number; // 합산 평가금액
  weightPct: number; // 0~100 (제외 후 재계산된 비중)
  color: string;
}

// 누적 가로 바 / 범례 공용 색상 팔레트 (서로 충분히 구분되는 색).
const WEIGHT_BAR_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
  "#ef4444",
  "#f97316",
  "#06b6d4",
  "#84cc16",
  "#6366f1",
  "#d946ef",
  "#0ea5e9",
  "#eab308",
  "#fb7185",
  "#34d399",
];

// KRX 숫자형 티커(6자리, 옵션 .KS/.KQ) → 정식명칭.
// 레지스트리(korean-etf-registry)에 등록된 코드 + 자주 쓰이는 ETF를 보강한다.
const KRX_CODE_TO_NAME_SUPPLEMENT: Record<string, string> = {
  "133690": "TIGER 미국나스닥100",
  "360750": "TIGER 미국S&P500",
  "381180": "TIGER 미국필라델피아반도체나스닥",
  "458730": "TIGER 미국배당다우존스",
  "379800": "KODEX 미국S&P500",
  "379810": "KODEX 미국나스닥100",
  "411060": "ACE 미국빅테크TOP7 Plus",
  "305720": "KODEX 2차전지산업",
  "091160": "KODEX 반도체",
  "069500": "KODEX 200",
  "102110": "TIGER 200",
  "232080": "TIGER 코스닥150",
};

// 레지스트리의 krxCode → displayName 을 supplement 와 병합한 조회 테이블.
const KRX_CODE_TO_NAME: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const mapping of KOREAN_ETF_MAPPINGS) {
    if (mapping.krxCode) map[mapping.krxCode] = mapping.displayName;
  }
  // supplement 가 우선한다(명세 예시 값 보장).
  return { ...map, ...KRX_CODE_TO_NAME_SUPPLEMENT };
})();

function normalizeTicker(ticker?: string | null): string {
  return (ticker ?? "").trim().toUpperCase();
}

function krxCodeOf(ticker: string): string | null {
  const match = ticker.match(/^(\d{6})(?:\.(KS|KQ))?$/);
  return match ? match[1] : null;
}

function isKrxNumericTicker(ticker: string): boolean {
  return krxCodeOf(ticker) !== null;
}

function originalNameOf(holding: Holding): string {
  return (holding.cleanName ?? holding.productName ?? "").trim();
}

// 종목 표시명 해석.
export function resolveHoldingDisplayName(holding: Holding): string {
  const ticker = normalizeTicker(holding.ticker);
  const original = originalNameOf(holding);

  // 티커 없음 → 원본 종목명.
  if (!ticker) return original || "(이름 없음)";

  const code = krxCodeOf(ticker);
  if (code) {
    // 1) 코드 직접 매핑
    const byCode = KRX_CODE_TO_NAME[code];
    if (byCode) return byCode;
    // 2) 상품명 기반 레지스트리 매핑
    const byName = findKoreanEtfMapping(original);
    if (byName) return byName.displayName;
    // 3) 매핑 실패 → 원본 데이터
    return original || ticker;
  }

  // 미국(영문) 티커 → 티커 그대로 표시.
  return ticker;
}

function signalText(holding: Holding): string {
  return [
    holding.broker,
    holding.accountName,
    holding.accountGroup,
    holding.statusGroup,
    holding.purposeGroup,
    holding.symbolGroup,
    holding.assetType,
    holding.productName,
    holding.cleanName,
    holding.tag,
  ]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();
}

// 보유 종목이 특정 계좌 탭에 해당하는지 판정한다.
// 탭은 독립적인 필터이며 한 종목이 여러 탭(예: 해외 + 연금)에 동시에 속할 수 있다.
export function matchesAccountTab(holding: Holding, tab: AccountTabKey): boolean {
  if (tab === "전체") return true;

  const text = signalText(holding);
  const ticker = normalizeTicker(holding.ticker);

  switch (tab) {
    case "IRP":
      return text.includes("IRP");
    case "ISA":
      return text.includes("ISA");
    case "연금":
      return text.includes("연금");
    case "비상장":
      return text.includes("비상장");
    case "국내":
      if (text.includes("국내")) return true;
      return isKrxNumericTicker(ticker);
    case "해외":
      if (text.includes("해외")) return true;
      // 영문 티커이면서 KRX 숫자형이 아니면 해외로 본다.
      return Boolean(ticker) && !isKrxNumericTicker(ticker) && /^[A-Z][A-Z._-]*$/.test(ticker);
    default:
      return false;
  }
}

// 선택된 계좌 탭 기준으로 종목 비중 슬라이스를 집계한다.
export function aggregateHoldingWeights(
  holdings: Holding[],
  tab: AccountTabKey,
): AccountHoldingWeightSlice[] {
  const groups = new Map<string, { name: string; ticker?: string; valueKRW: number }>();

  for (const holding of holdings) {
    if (!matchesAccountTab(holding, tab)) continue;
    const value =
      typeof holding.valueKRW === "number" && Number.isFinite(holding.valueKRW)
        ? holding.valueKRW
        : 0;
    if (value <= 0) continue;

    const ticker = normalizeTicker(holding.ticker);
    // 동일 티커 합산. 티커가 없으면 종목명으로 그룹핑한다.
    const key = ticker || `name:${originalNameOf(holding).toUpperCase()}`;
    const current = groups.get(key) ?? {
      name: resolveHoldingDisplayName(holding),
      ticker: ticker || undefined,
      valueKRW: 0,
    };
    current.valueKRW += value;
    groups.set(key, current);
  }

  // 100만원 미만 종목 제외.
  const kept = Array.from(groups.entries()).filter(
    ([, value]) => value.valueKRW >= MIN_HOLDING_VALUE_KRW,
  );

  // 제외 후 남은 종목 기준으로 비중 재계산.
  const total = kept.reduce((sum, [, value]) => sum + value.valueKRW, 0);
  if (total <= 0) return [];

  return kept
    .sort((a, b) => b[1].valueKRW - a[1].valueKRW)
    .map(([key, value], index) => ({
      key,
      name: value.name,
      ticker: value.ticker,
      valueKRW: value.valueKRW,
      weightPct: (value.valueKRW / total) * 100,
      color: WEIGHT_BAR_COLORS[index % WEIGHT_BAR_COLORS.length],
    }));
}
