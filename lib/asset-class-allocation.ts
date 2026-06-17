import type { FinanceAsset, Holding } from "./portfolio-types";
import { isAllocationChartAmountVisible } from "./allocation-chart-filter";

// =============================================================
// PORTFOLIO-TREEMAP-TO-STREAMLIT-DONUT-1
// 보유종목/현금성 잔액을 "자산군"(TQQQ·QLD·QQQ·SPY·SCHD·MSFT·달러·원화·기타)
// 단위로 합산한다. 원본 Streamlit 자산 트래커(original/pages_app/2_asset_tracker.py)의
// get_asset_type 분류를 Next.js로 옮기되, 레버리지를 TQQQ/QLD로, 나스닥을 QQQ로
// 더 세분화해 "키움TQQQ1" 같은 원본 상품명 단위가 아니라 자산군 단위로 표시한다.
//
// ASSET-CLASS-DONUT-POLISH-2: 현금성 라벨을 "달러" / "원화" 두 가지로 통합한다.
//   - 예적금·원화 현금·예수금 등 KRW 현금성 자산은 모두 "원화"로 합산한다.
//   - USD/외화 현금성 자산만 "달러"로 유지하고, 구분 불가한 현금성은 보수적으로 "원화".
//   - "현금" / "예적금" 은 더 이상 별도 자산군 라벨로 노출하지 않는다.
// =============================================================

export type AssetClassName =
  | "TQQQ"
  | "QLD"
  | "QQQ"
  | "SPY"
  | "SCHD"
  | "MSFT"
  | "달러"
  | "원화"
  | "기타";

export interface AssetClassSlice {
  name: AssetClassName;
  valueKRW: number;
  principalKRW: number;
  // 0~100, 소수 1자리.
  weightPct: number;
  // 투자원금이 없는 현금성 자산군은 수익률이 없다(null).
  returnPct: number | null;
  color: string;
}

// 자산군별 색상 (ASSET-CLASS-DONUT-POLISH-2 색상 정책).
//   TQQQ 진빨강 / QLD 빨강 / QQQ 핑크·빨강 / SPY 주황 / SCHD 노랑 / MSFT 진노랑 /
//   달러 진한 연두(진초록) / 원화 연두 / 기타 하늘색.
// 하늘색은 오직 "기타"에만 쓴다(예적금/원화가 하늘색으로 잡히면 안 됨).
// 라이트/다크 모두 글씨 가독성이 유지되는 채도로 선택한다.
const ASSET_CLASS_COLOR: Record<AssetClassName, string> = {
  TQQQ: "#B71C1C",
  QLD: "#E53935",
  QQQ: "#EC407A",
  SPY: "#FB8C00",
  SCHD: "#FDD835",
  MSFT: "#F9A825",
  달러: "#2E7D32",
  원화: "#7CB342",
  기타: "#38BDF8",
};

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}


function includesAny(haystack: string, tokens: string[]): boolean {
  return tokens.some((token) => haystack.includes(token));
}

// 티커/상품명에서 만든 소문자 문자열을 자산군 1개로 분류한다.
// 순서가 중요하다: TQQQ 는 "qqq" 를 포함하므로 QQQ 보다 먼저 검사한다.
export function classifyAssetClass(text: string): AssetClassName {
  const t = text.toLowerCase();
  if (t.includes("tqqq")) return "TQQQ";
  if (t.includes("qld")) return "QLD";
  if (t.includes("qqqm") || t.includes("qqq") || t.includes("나스닥")) return "QQQ";
  if (includesAny(t, ["spy", "voo", "ivv", "splg", "s&p", "sp500", "snp"])) return "SPY";
  if (t.includes("schd")) return "SCHD";
  if (t.includes("msft") || t.includes("마이크로소프트")) return "MSFT";
  // USD/달러/외화/$ 신호가 있는 현금성 자산은 "달러".
  if (includesAny(t, ["달러", "dollar", "usd", "외화", "미국달러", "us$", "$"])) return "달러";
  // KRW/원화/예적금/현금성 원화 자산은 모두 "원화"로 합산한다.
  // (예적금·적금·예금·저축·채권·청약 + 현금·예수금·CMA·MMF·파킹 등 + 명시적 원화/KRW 신호.)
  if (
    includesAny(t, [
      "예적금", "적금", "예금", "저축", "채권", "청약",
      "현금", "예수금", "예치금", "cma", "mmf", "mmw", "파킹", "입출금", "대기자금", "통장", "rp",
      "원화", "krw",
    ])
  ) {
    return "원화";
  }
  return "기타";
}

function holdingClassText(holding: Holding): string {
  const ticker = (holding.ticker || "").split(".")[0];
  return [ticker, holding.productName, holding.cleanName, holding.tag, holding.category, holding.assetType]
    .filter(Boolean)
    .join(" ");
}

function financeAssetClassText(asset: FinanceAsset): string {
  return [asset.productName, asset.cleanName, asset.inferredTag, asset.category, asset.groupName]
    .filter(Boolean)
    .join(" ");
}

// 보유종목 + 비투자성 현금성 잔액을 자산군으로 합산한다.
// (자산 구성 도넛과 동일하게, 보유종목이 있으면 투자성 재무현황은 중복 집계를 피해 제외한다.)
export function buildAssetClassAllocation(
  holdings: Holding[],
  financeAssets: FinanceAsset[],
): AssetClassSlice[] {
  const totals = new Map<AssetClassName, { value: number; principal: number }>();
  const add = (name: AssetClassName, value: number, principal: number) => {
    const current = totals.get(name) ?? { value: 0, principal: 0 };
    current.value += value;
    current.principal += principal;
    totals.set(name, current);
  };

  for (const holding of holdings) {
    const value = isAllocationChartAmountVisible(holding.valueKRW) ? holding.valueKRW : null;
    if (value === null) continue;
    add(classifyAssetClass(holdingClassText(holding)), value, finiteNumber(holding.principalKRW) ?? 0);
  }

  const financeRows = financeAssets.filter((asset) => {
    if (asset.isDebt === true) return false;
    // 보유종목이 있으면 투자성 재무현황은 보유종목과 중복되므로 제외한다.
    if (holdings.length > 0 && asset.category === "투자성") return false;
    return true;
  });
  for (const asset of financeRows) {
    const value = isAllocationChartAmountVisible(asset.amountKRW) ? asset.amountKRW : null;
    if (value === null) continue;
    // 현금성 잔액은 투자원금/수익률 개념이 없어 원금 0 으로 둔다.
    add(classifyAssetClass(financeAssetClassText(asset)), value, 0);
  }

  const total = Array.from(totals.values()).reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) return [];

  return Array.from(totals.entries())
    .map(([name, item]) => {
      const profit = item.principal > 0 ? item.value - item.principal : null;
      return {
        name,
        valueKRW: Math.round(item.value),
        principalKRW: Math.round(item.principal),
        weightPct: Number(((item.value / total) * 100).toFixed(1)),
        returnPct: profit !== null && item.principal > 0 ? (profit / item.principal) * 100 : null,
        color: ASSET_CLASS_COLOR[name],
      };
    })
    .sort((a, b) => b.valueKRW - a.valueKRW);
}
