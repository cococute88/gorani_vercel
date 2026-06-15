// =============================================================
// 자산군(Asset Group) 도넛 차트 helper.
//
// 기존 Streamlit 원본 로직을 TypeScript 로 복원한 것이다.
//   - original/logic/tracker.py
//       get_asset_type / get_super_group / get_color_for_tag /
//       assign_colors / sort_tags_by_super_group
//   - original/pages_app/2_asset_tracker.py (같은 로직의 인라인 버전 + 도넛 렌더)
//
// /portfolio, /portfolio-manager, 스냅샷 히스토리 상세 세 화면에서
// 같은 helper/component 를 공유해 동일한 분류·정렬·색상을 보장한다.
//
// 원본과의 차이(의도된 deviation):
//   - SPYM 을 spy(S&P/SNP 계열)로 분류한다. 원본 exact-match 에서는
//     bare "SPYM" 이 other 로 떨어지지만, 이번 작업 요구사항(한국상장
//     S&P500 wrapper 를 S&P 계열로 묶기)에 맞춰 spy 키워드에 추가했다.
//   - 현금성 키워드에 예수금/예치금/SGOV/MMW/CASH 계열을 추가했다(원본 키워드 확장).
//   - ETF look-through(구성종목 분해)는 이번 작업 범위가 아니다.
// =============================================================

import type { Slice } from "./mockData";
import type { FinanceAsset, Holding } from "./portfolio-types";

export type AssetTypeKey =
  | "dollar"
  | "cash"
  | "leverage"
  | "nasdaq"
  | "spy"
  | "dividend"
  | "other";

export type AssetSuperGroupKey = "lev_nas" | "spy_div" | "cash_dol" | "other_grp";

// ------------------------------------------------------------
// 색상 (original/logic/tracker.py 의 토스 톤다운 팔레트)
// 라이트/다크 모두에서 가독성이 좋은 채도로, 자산군별 고정 색을 쓴다.
// ------------------------------------------------------------
const COLOR_CASH = "#7CB342"; // 현금성 - 연두
const COLOR_DOLLAR = "#2E7D32"; // 달러 - 진초록
const COLOR_LEVERAGE = "#8D2A1F"; // 레버리지 - 적갈
const COLOR_NASDAQ = "#E53935"; // 나스닥 - 빨강
const COLOR_SPY = "#FB8C00"; // SPY - 주황
const COLOR_DIVIDEND = "#FDD835"; // 배당 - 노랑
const COLOR_OTHER = [
  "#3182F6",
  "#7E57C2",
  "#26A69A",
  "#EC407A",
  "#5C6BC0",
  "#42A5F5",
  "#5E35B1",
  "#00897B",
];

const FIXED_TYPE_COLOR: Record<Exclude<AssetTypeKey, "other">, string> = {
  dollar: COLOR_DOLLAR,
  cash: COLOR_CASH,
  leverage: COLOR_LEVERAGE,
  nasdaq: COLOR_NASDAQ,
  spy: COLOR_SPY,
  dividend: COLOR_DIVIDEND,
};

// 자산군 표시 라벨 (도넛 옆/안 자산군명).
export const ASSET_TYPE_LABEL: Record<AssetTypeKey, string> = {
  leverage: "나스닥 레버리지",
  nasdaq: "나스닥",
  spy: "S&P500",
  dividend: "배당",
  dollar: "달러",
  cash: "현금",
  other: "기타",
};

// 슈퍼그룹별 표시 라벨 (참고용).
export const SUPER_GROUP_LABEL: Record<AssetSuperGroupKey, string> = {
  lev_nas: "나스닥성",
  spy_div: "S&P·배당",
  cash_dol: "현금·달러",
  other_grp: "기타",
};

// ------------------------------------------------------------
// 분류 키워드.
//   - "token" 키워드: 영문 ticker 는 원본처럼 정확히 일치(equality)할 때만 매칭.
//     (예: "ko" 는 토큰 "ko" 와만 매칭되고 "KODEX" 의 "ko" 는 매칭되지 않는다.)
//   - "sub"   키워드: 한글/기호 키워드는 부분 문자열(substring)로 매칭.
// 원본 get_asset_type 의 위→아래 우선순위를 그대로 유지한다.
// ------------------------------------------------------------
const DOLLAR_TOKENS = ["usd", "dollar"];
const DOLLAR_SUBS = ["달러", "us$"];

const CASH_TOKENS = ["rp", "cma", "mmf", "mmw", "sgov", "cash", "cash_like"];
const CASH_SUBS = [
  "현금",
  "예금",
  "적금",
  "예적금",
  "채권",
  "저축",
  "파킹",
  "입출금",
  "예수금",
  "예치금",
];

const LEVERAGE_TOKENS = ["tqqq", "qld", "upro", "soxl", "tecl", "fngu", "bulz", "sso"];
const LEVERAGE_SUBS = ["tqqq", "qld", "레버리지", "3x", "2x"];

const NASDAQ_TOKENS = ["qqq", "qqqm"];
const NASDAQ_SUBS = ["나스닥", "nasdaq", "qqq"];

// SPYM 은 요구사항에 맞춰 추가(원본에는 없음).
const SPY_TOKENS = ["spy", "spym", "voo", "ivv", "splg"];
const SPY_SUBS = ["s&p", "sp500", "snp", "spym"];

const DIVIDEND_TOKENS = [
  "msft",
  "schd",
  "vym",
  "dgro",
  "aapl",
  "ko",
  "jnj",
  "pg",
  "vti",
  "vtv",
  "vug",
  "dia",
];
const DIVIDEND_SUBS = ["schd", "배당", "dividend"];

export interface AssetClassifyInput {
  ticker?: string | null;
  productName?: string | null;
  cleanName?: string | null;
  tag?: string | null;
  name?: string | null;
}

// 자산군(타입) 분류. 원본 get_asset_type 과 동일한 우선순위로 판정한다.
export function getAssetType(input: AssetClassifyInput): AssetTypeKey {
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

  if (match(DOLLAR_TOKENS, DOLLAR_SUBS)) return "dollar";
  if (match(CASH_TOKENS, CASH_SUBS)) return "cash";
  if (match(LEVERAGE_TOKENS, LEVERAGE_SUBS)) return "leverage";
  if (match(NASDAQ_TOKENS, NASDAQ_SUBS)) return "nasdaq";
  if (match(SPY_TOKENS, SPY_SUBS)) return "spy";
  if (match(DIVIDEND_TOKENS, DIVIDEND_SUBS)) return "dividend";
  return "other";
}

// 슈퍼그룹 분류 (유사 자산군 인접 배치를 위한 상위 묶음). 원본과 동일.
export function getSuperGroup(type: AssetTypeKey): AssetSuperGroupKey {
  if (type === "spy" || type === "dividend") return "spy_div";
  if (type === "cash" || type === "dollar") return "cash_dol";
  if (type === "leverage" || type === "nasdaq") return "lev_nas";
  return "other_grp";
}

export interface AssetAllocationItem extends AssetClassifyInput {
  valueKRW: number;
}

export interface AssetAllocationSlice extends Slice {
  key: AssetTypeKey;
  label: string;
  amountKRW: number;
  valueKRW: number;
  percent: number;
  assetType: AssetTypeKey;
  assetTypeLabel: string;
  superGroup: AssetSuperGroupKey;
  sourceHoldingCount: number;
}

export interface AssetAllocationResult {
  slices: AssetAllocationSlice[];
  totalKRW: number;
}

function isValidValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

// 자산군 도넛 슬라이스를 만든다.
//   1) 원문 보유종목명이 아니라 최종 자산군 타입별로 유효 금액을 집계한다(invalid/0/NaN 방어).
//   2) 원본 sort_tags_by_super_group 와 동일하게
//      (슈퍼그룹 합계, 타입 합계, 카테고리 금액) 내림차순으로 정렬해
//      유사 자산군이 이웃하도록 배치한다.
//   3) 자산군별 고정 색을 부여하고, other 는 팔레트를 순환한다.
export function buildAssetAllocationDonut(
  items: readonly AssetAllocationItem[] | null | undefined,
): AssetAllocationResult {
  const byType = new Map<
    AssetTypeKey,
    { type: AssetTypeKey; value: number; sourceHoldingCount: number }
  >();

  for (const item of items ?? []) {
    if (!item || !isValidValue(item.valueKRW)) continue;
    const type = getAssetType(item);
    const existing = byType.get(type);
    if (existing) {
      existing.value += item.valueKRW;
      existing.sourceHoldingCount += 1;
    } else {
      byType.set(type, { type, value: item.valueKRW, sourceHoldingCount: 1 });
    }
  }
  const entries = Array.from(byType.values());
  const totalKRW = entries.reduce((sum, entry) => sum + entry.value, 0);
  if (entries.length === 0 || totalKRW <= 0) return { slices: [], totalKRW: 0 };

  const sgTotals = new Map<AssetSuperGroupKey, number>();
  const typeTotals = new Map<AssetTypeKey, number>();
  for (const entry of entries) {
    const sg = getSuperGroup(entry.type);
    sgTotals.set(sg, (sgTotals.get(sg) ?? 0) + entry.value);
    typeTotals.set(entry.type, (typeTotals.get(entry.type) ?? 0) + entry.value);
  }

  entries.sort((a, b) => {
    const sgA = sgTotals.get(getSuperGroup(a.type)) ?? 0;
    const sgB = sgTotals.get(getSuperGroup(b.type)) ?? 0;
    if (sgB !== sgA) return sgB - sgA;
    const tA = typeTotals.get(a.type) ?? 0;
    const tB = typeTotals.get(b.type) ?? 0;
    if (tB !== tA) return tB - tA;
    if (b.value !== a.value) return b.value - a.value;
    return ASSET_TYPE_LABEL[a.type].localeCompare(ASSET_TYPE_LABEL[b.type]);
  });

  let otherIdx = 0;
  const slices: AssetAllocationSlice[] = entries.map((entry) => {
    const color =
      entry.type === "other"
        ? COLOR_OTHER[otherIdx++ % COLOR_OTHER.length]
        : FIXED_TYPE_COLOR[entry.type];
    return {
      key: entry.type,
      label: ASSET_TYPE_LABEL[entry.type],
      name: ASSET_TYPE_LABEL[entry.type],
      value: Number(((entry.value / totalKRW) * 100).toFixed(1)),
      percent: Number(((entry.value / totalKRW) * 100).toFixed(1)),
      color,
      amountKRW: Math.round(entry.value),
      valueKRW: Math.round(entry.value),
      assetType: entry.type,
      assetTypeLabel: ASSET_TYPE_LABEL[entry.type],
      superGroup: getSuperGroup(entry.type),
      sourceHoldingCount: entry.sourceHoldingCount,
    };
  });

  return { slices, totalKRW };
}

// 보유종목 → 분류 입력 변환.
export function assetAllocationItemsFromHoldings(
  holdings: readonly Holding[] | null | undefined,
): AssetAllocationItem[] {
  return (holdings ?? []).map((h) => ({
    ticker: h.ticker,
    productName: h.productName,
    cleanName: h.cleanName,
    tag: h.tag,
    valueKRW: h.valueKRW,
  }));
}

// 재무현황(현금성 잔액) → 분류 입력 변환. 부채는 제외한다.
export function assetAllocationItemsFromFinanceAssets(
  financeAssets: readonly FinanceAsset[] | null | undefined,
): AssetAllocationItem[] {
  return (financeAssets ?? [])
    .filter((asset) => asset.isDebt !== true)
    .map((asset) => ({
      productName: asset.productName,
      cleanName: asset.cleanName,
      tag: asset.inferredTag,
      valueKRW: asset.amountKRW,
    }));
}

// 스냅샷/파싱결과 형태(holdings + financeAssets)에서 자산군 도넛을 만든다.
// 보유종목이 있을 때 투자성 재무자산은 보유종목과 중복되므로 제외해 이중집계를 막는다.
// (lib/portfolio-from-snapshots.ts 의 computeAssetPurposeTotals 와 동일한 기준.)
export function buildAssetAllocationFromSnapshotLike(
  input: {
    holdings?: readonly Holding[] | null;
    financeAssets?: readonly FinanceAsset[] | null;
  },
  options: { includeFinanceAssets?: boolean } = {},
): AssetAllocationResult {
  const includeFinance = options.includeFinanceAssets ?? true;
  const holdings = input.holdings ?? [];
  const financeAssets = includeFinance
    ? (input.financeAssets ?? []).filter((asset) => {
        if (asset.isDebt === true) return false;
        if (holdings.length > 0 && asset.category === "투자성") return false;
        return true;
      })
    : [];

  return buildAssetAllocationDonut([
    ...assetAllocationItemsFromHoldings(holdings),
    ...assetAllocationItemsFromFinanceAssets(financeAssets),
  ]);
}
