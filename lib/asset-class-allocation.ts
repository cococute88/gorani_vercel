import type { FinanceAsset, Holding } from "./portfolio-types";

// =============================================================
// PORTFOLIO-TREEMAP-TO-STREAMLIT-DONUT-1
// 보유종목/현금성 잔액을 "자산군"(TQQQ·QLD·QQQ·SPY·SCHD·MSFT·달러·현금·예적금·기타)
// 단위로 합산한다. 원본 Streamlit 자산 트래커(original/pages_app/2_asset_tracker.py)의
// get_asset_type 분류를 Next.js로 옮기되, 레버리지를 TQQQ/QLD로, 나스닥을 QQQ로
// 더 세분화해 "키움TQQQ1" 같은 원본 상품명 단위가 아니라 자산군 단위로 표시한다.
// =============================================================

export type AssetClassName =
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

// 자산군별 색상. 원본 Streamlit 팔레트(레버리지=짙은 빨강, 나스닥=빨강, SPY=주황,
// 배당=노랑, 달러=짙은 녹색, 현금=형광 녹색)를 따르되 세분화한 항목은 인접 색을 쓴다.
const ASSET_CLASS_COLOR: Record<AssetClassName, string> = {
  TQQQ: "#890600",
  QLD: "#ef4444",
  QQQ: "#fc3a2f",
  SPY: "#ff6600",
  SCHD: "#facc15",
  MSFT: "#818cf8",
  달러: "#2e7d32",
  현금: "#76ff03",
  예적금: "#06b6d4",
  기타: "#9c27b0",
};

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function positiveNumber(value: unknown): number | null {
  const n = finiteNumber(value);
  return n !== null && n > 0 ? n : null;
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
  if (includesAny(t, ["달러", "dollar", "usd", "외화", "미국달러", "us$"])) return "달러";
  if (includesAny(t, ["예적금", "적금", "예금", "저축", "채권", "청약"])) return "예적금";
  if (includesAny(t, ["현금", "예수금", "예치금", "cma", "mmf", "mmw", "파킹", "입출금", "대기자금", "통장", "rp"]))
    return "현금";
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
    const value = positiveNumber(holding.valueKRW);
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
    const value = positiveNumber(asset.amountKRW);
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
