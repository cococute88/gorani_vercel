// =============================================================
// 투자 성과(/performance) 도넛용 "정규화 종목군(Asset Group)" 분류 helper.
//
// 기존 lib/asset-allocation-donut.ts 는 TQQQ·QLD 를 하나의 "나스닥 레버리지"
// 슈퍼그룹으로 합치지만, /performance 도넛은 사용자가 원하는 더 세분화된
// canonical 종목군 단위(TQQQ / QLD / QQQ / SPY / SCHD / MSFT / 달러 / 현금 /
// 예적금 / 기타)로 합산해 보여줘야 한다.
//
// "보유 상품명" (키움TQQQ1, 삼성위탁TQQQ 등) 이 아니라 정규화된 종목군 key 로
// 묶는 것이 목적이다. ticker / cleanName / productName / tag 를 종합 판정한다.
// 한국상장 ETF(예: ACE 미국나스닥100, TIGER 미국S&P500) 도 본질 종목군으로 편입.
// =============================================================

export type PerformanceGroupKey =
  | "TQQQ"
  | "QLD"
  | "QQQ"
  | "SPY"
  | "SCHD"
  | "MSFT"
  | "달러"
  | "현금"
  | "예적금"
  | "기타";

// canonical 노출 우선순위 (동일 값일 때 안정 정렬, 색상 매핑 기준).
export const PERFORMANCE_GROUP_ORDER: PerformanceGroupKey[] = [
  "TQQQ",
  "QLD",
  "QQQ",
  "SPY",
  "SCHD",
  "MSFT",
  "달러",
  "현금",
  "예적금",
  "기타",
];

// 색상 규칙 (작업 요구사항). 다크/라이트 모두 가독성 좋은 채도로 선택.
//   TQQQ 진빨강 / QLD 빨강 / QQQ 핑크 / SPY 주황 / MSFT 진노랑 / SCHD 노랑 /
//   기타 하늘색 / 달러 진초록 / 현금 연두 / 예적금 녹색
export const PERFORMANCE_GROUP_COLOR: Record<PerformanceGroupKey, string> = {
  TQQQ: "#B71C1C", // 진빨강
  QLD: "#E53935", // 빨강
  QQQ: "#EC407A", // 핑크
  SPY: "#FB8C00", // 주황
  MSFT: "#F9A825", // 진노랑(골드)
  SCHD: "#FDD835", // 노랑
  달러: "#2E7D32", // 진초록
  현금: "#7CB342", // 연두
  예적금: "#43A047", // 녹색
  기타: "#38BDF8", // 하늘색
};

export interface PerformanceGroupClassifyInput {
  ticker?: string | null;
  productName?: string | null;
  cleanName?: string | null;
  tag?: string | null;
  name?: string | null;
}

// 종목군 분류. 위→아래 우선순위로 판정한다.
//  - "token" 키워드: 영문 ticker 토큰과 정확히 일치할 때만 매칭(KODEX 의 'ko' 오분류 방지).
//  - "sub"   키워드: 한글/기호는 부분 문자열로 매칭.
export function classifyPerformanceGroup(
  input: PerformanceGroupClassifyInput,
): PerformanceGroupKey {
  const tickerBase = (input.ticker ?? "").trim().toLowerCase().split(".")[0];
  const text = [input.tag, input.productName, input.cleanName, input.name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const tokens = new Set<string>(
    [tickerBase, ...(text.match(/[a-z0-9&]+/g) ?? [])].filter(Boolean),
  );

  const hasToken = (kw: string) => tokens.has(kw);
  const hasSub = (kw: string) => text.includes(kw) || tickerBase.includes(kw);
  const match = (tk: string[], sub: string[]) => tk.some(hasToken) || sub.some(hasSub);

  // 현금성 계열을 종목 ticker 보다 먼저 본다(달러 → 예적금 → 현금 순).
  if (match(["usd", "dollar"], ["달러", "us$"])) return "달러";
  if (match([], ["예적금", "예금", "적금", "저축", "적립"])) return "예적금";
  if (
    match(
      ["rp", "cma", "mmf", "mmw", "sgov", "cash", "cash_like", "krw"],
      ["현금", "예수금", "예치금", "파킹", "입출금", "채권"],
    )
  ) {
    return "현금";
  }

  // 레버리지(TQQQ/QLD) 를 일반 나스닥(QQQ) 보다 먼저 본다.
  if (match(["tqqq"], ["tqqq"])) return "TQQQ";
  if (match(["qld"], ["qld"])) return "QLD";
  // QQQ / 한국상장 나스닥100 ETF.
  if (match(["qqq", "qqqm"], ["qqq", "나스닥", "nasdaq"])) return "QQQ";
  // SPY / VOO / 한국상장 S&P500 ETF.
  if (match(["spy", "spym", "voo", "ivv", "splg"], ["s&p", "sp500", "snp", "spym"])) {
    return "SPY";
  }
  // SCHD / 미국배당다우존스 계열.
  if (match(["schd"], ["schd", "배당", "다우존스"])) return "SCHD";
  // MSFT / 마이크로소프트.
  if (match(["msft"], ["마이크로소프트", "microsoft"])) return "MSFT";

  return "기타";
}

export interface PerformanceAssetGroupItem extends PerformanceGroupClassifyInput {
  valueKRW: number;
  principalKRW?: number | null;
}

export interface PerformanceAssetGroupRow {
  key: PerformanceGroupKey;
  label: PerformanceGroupKey; // 표시 라벨 == canonical key
  color: string;
  valueKRW: number;
  principalKRW: number | null;
  profitKRW: number | null;
  returnPct: number | null;
  weightPct: number;
  sourceHoldingCount: number;
}

export interface PerformanceAssetGroupResult {
  groups: PerformanceAssetGroupRow[];
  totalKRW: number;
}

function isValidValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

// 정규화 종목군 단위로 평가금액·투자원금을 합산하고 그룹 수익률을 계산한다.
//  - invalid/0/NaN/음수 평가금액은 제외한다.
//  - 그룹 수익률 = (합산 평가금액 - 합산 투자원금) / 합산 투자원금 * 100.
//    원금이 0이거나 없으면 returnPct/profitKRW 는 null.
//  - 평가금액 내림차순으로 정렬하고, 동률이면 canonical 순서로 안정 정렬한다.
export function buildPerformanceAssetGroups(
  items: readonly PerformanceAssetGroupItem[] | null | undefined,
): PerformanceAssetGroupResult {
  const byKey = new Map<
    PerformanceGroupKey,
    {
      key: PerformanceGroupKey;
      value: number;
      principal: number;
      hasPrincipal: boolean;
      sourceHoldingCount: number;
    }
  >();

  for (const item of items ?? []) {
    if (!item || !isValidValue(item.valueKRW)) continue;
    const key = classifyPerformanceGroup(item);
    const existing =
      byKey.get(key) ??
      { key, value: 0, principal: 0, hasPrincipal: false, sourceHoldingCount: 0 };
    existing.value += item.valueKRW;
    if (isValidValue(item.principalKRW)) {
      existing.principal += item.principalKRW;
      existing.hasPrincipal = true;
    }
    existing.sourceHoldingCount += 1;
    byKey.set(key, existing);
  }

  const entries = Array.from(byKey.values());
  const totalKRW = entries.reduce((sum, entry) => sum + entry.value, 0);
  if (entries.length === 0 || totalKRW <= 0) return { groups: [], totalKRW: 0 };

  const orderIndex = (key: PerformanceGroupKey) => PERFORMANCE_GROUP_ORDER.indexOf(key);

  const groups = entries
    .sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value;
      return orderIndex(a.key) - orderIndex(b.key);
    })
    .map((entry) => {
      const hasPrincipal = entry.hasPrincipal && entry.principal > 0;
      const profitKRW = hasPrincipal ? entry.value - entry.principal : null;
      const returnPct =
        profitKRW !== null && hasPrincipal ? (profitKRW / entry.principal) * 100 : null;
      return {
        key: entry.key,
        label: entry.key,
        color: PERFORMANCE_GROUP_COLOR[entry.key],
        valueKRW: Math.round(entry.value),
        principalKRW: hasPrincipal ? Math.round(entry.principal) : null,
        profitKRW: profitKRW !== null ? Math.round(profitKRW) : null,
        returnPct,
        weightPct: (entry.value / totalKRW) * 100,
        sourceHoldingCount: entry.sourceHoldingCount,
      } satisfies PerformanceAssetGroupRow;
    });

  return { groups, totalKRW: Math.round(totalKRW) };
}
