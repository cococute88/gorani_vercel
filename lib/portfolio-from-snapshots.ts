import type { FinanceAsset, Holding, PortfolioSnapshot } from "./portfolio-types";
import { filterAggregateHoldings } from "./portfolio-summary-row";
import {
  applyKrxTickerMappingsToHoldings,
  type KrxTickerNameMap,
} from "./krx-ticker-name-map";
import { classifyAccountStatusGroup } from "./account-status-group";
import { holdingDisplayLabel } from "./holding-display-label";

// ASSET-PORTFOLIO-UX-POLISH-1 #3: 트리맵에는 전체 평가금액 대비 2% 이상인 종목만 표시한다.
// (합계/랭킹/요약 수치는 원본 그대로 유지하고 트리맵 "표시"에서만 작은 종목을 제외한다.)
export const TREEMAP_MIN_WEIGHT_PCT = 2;

// PORTFOLIO-CALCULATOR-UX-FIX-2 #2: 화면에 노출할 계좌의 최소 평가금액.
// 이 금액 미만의 계좌 그룹은 사용자에게 의미가 없어 "표시용 계좌 항목"에서 제외한다.
// (총자산 KPI 등 합계 지표는 줄이지 않고, 계좌 카드/계좌 비중 표시에만 적용한다.)
export const MIN_VISIBLE_ACCOUNT_AMOUNT_KRW = 200_000;

const COLORS = [
  "#3b82f6",
  "#22c55e",
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
  "#64748b",
];

export type PortfolioWarningSeverity = "info" | "warning";

export interface PortfolioPageWarning {
  code: string;
  message: string;
  severity: PortfolioWarningSeverity;
}

export interface PortfolioAllocationSlice {
  name: string;
  value: number;
  color: string;
  amountKRW?: number;
}

export interface PortfolioSummaryCards {
  snapshotDate: string | null;
  sourceFileName: string | null;
  totalAssetKRW: number | null;
  investmentValueKRW: number | null;
  investmentPrincipalKRW: number | null;
  returnAmountKRW: number | null;
  returnPct: number | null;
  holdingCount: number;
  accountCount: number;
  financeAssetCount: number;
  stockCashTargets: Array<{ name: string; current: number; target: number | null }>;
}

export interface PortfolioAccountRow {
  name: string;
  type: string;
  tax: "과세" | "비과세" | "미확인";
  value: number;
  profit: number | null;
  rate: number | null;
  statusGroup: string;
  holdingCount: number;
  source: "financeAssets" | "holdings";
}

export interface PortfolioTreemapItem {
  name: string;
  ticker?: string;
  valueKRW: number;
  weightPct: number;
  returnPct: number | null;
  group: string;
}

export interface PortfolioHoldingRankingRow {
  rank: number;
  name: string;
  ticker?: string;
  valueKRW: number;
  principalKRW: number | null;
  profitKRW: number | null;
  returnPct: number | null;
  weightPct: number;
  sourceHoldingCount: number;
}

export interface PortfolioPageDataFlags {
  hasSnapshot: boolean;
  hasHoldings: boolean;
  hasFinanceAssets: boolean;
  hasTreemap: boolean;
  hasAccountAllocation: boolean;
  hasAssetAllocation: boolean;
  hasPurposeAllocation: boolean;
  hasTickerMapApplied: boolean;
  usesSampleData: false;
  sampleFallbackUsed: false;
}

export interface PortfolioPageModel {
  snapshot: PortfolioSnapshot | null;
  mappedHoldings: Holding[];
  summary: PortfolioSummaryCards;
  accountAllocation: PortfolioAllocationSlice[];
  stockAllocation: PortfolioAllocationSlice[];
  assetAllocation: PortfolioAllocationSlice[];
  purposeAllocation: PortfolioAllocationSlice[];
  accountCards: PortfolioAccountRow[];
  treemapItems: PortfolioTreemapItem[];
  holdingsRankingRows: PortfolioHoldingRankingRow[];
  warnings: PortfolioPageWarning[];
  flags: PortfolioPageDataFlags;
  accountAllocationSource: "financeAssets" | "holdings" | "none";
}

export interface BuildPortfolioPageOptions {
  tickerNameMap?: KrxTickerNameMap;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function positiveNumber(value: unknown): number | null {
  const n = finiteNumber(value);
  return n !== null && n > 0 ? n : null;
}

function percent(value: number, total: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return 0;
  return Number(((value / total) * 100).toFixed(1));
}

function colorAt(index: number): string {
  return COLORS[index % COLORS.length];
}

function addWarning(
  warnings: PortfolioPageWarning[],
  code: string,
  message: string,
  severity: PortfolioWarningSeverity = "warning",
): void {
  if (warnings.some((warning) => warning.code === code)) return;
  warnings.push({ code, message, severity });
}

function groupSlices<T>(
  rows: T[],
  valueOf: (row: T) => number | null,
  nameOf: (row: T) => string | undefined,
  limit?: number,
): PortfolioAllocationSlice[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const value = valueOf(row);
    if (value === null || !Number.isFinite(value) || value <= 0) continue;
    const name = nameOf(row)?.trim() || "미분류";
    totals.set(name, (totals.get(name) ?? 0) + value);
  }

  const total = Array.from(totals.values()).reduce((sum, value) => sum + value, 0);
  let sorted = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);

  if (limit && sorted.length > limit) {
    const visible = sorted.slice(0, limit - 1);
    const others = sorted.slice(limit - 1).reduce((sum, [, value]) => sum + value, 0);
    sorted = [...visible, ["기타", others]];
  }

  return sorted.map(([name, amountKRW], index) => ({
    name,
    value: percent(amountKRW, total),
    color: colorAt(index),
    amountKRW: Math.round(amountKRW),
  }));
}

function latestOfSnapshots(snapshots: PortfolioSnapshot[]): PortfolioSnapshot | null {
  if (snapshots.length === 0) return null;
  return snapshots.reduce((latest, item) =>
    item.snapshotDate >= latest.snapshotDate ? item : latest,
  );
}

function holdingDisplayName(holding: Holding): string {
  return holding.cleanName?.trim() || holding.productName?.trim() || holding.ticker || "미분류";
}

function holdingAccountName(holding: Holding): string | undefined {
  return holding.accountGroup || holding.accountName || holding.broker || holding.assetType;
}

function holdingPurposeName(holding: Holding): string | undefined {
  const value = holding.purposeGroup || holding.parsedTags?.purposeGroup || holding.tag;
  if (!value || value === "미분류") return undefined;
  return value;
}

// PORTFOLIO-DIVIDEND-UX-FIX-3 #3: 자산 구성을 성장/배당/현금(원)/현금(달러) 4개로 분류한다.
// (이전 PORTFOLIO-CALCULATOR-UX-FIX-2 의 성장/배당/현금 3분류에서 현금을 통화별로 쪼갠다.)
export type AssetPurposeGroup = "성장" | "배당" | "현금(원)" | "현금(달러)";

// 현금성으로 볼 수 있는 신호 (예수금/CMA/파킹/MMF/예적금 등).
const CASH_LIKE_SIGNALS = [
  "현금",
  "예수금",
  "예치금",
  "CMA",
  "MMF",
  "MMW",
  "파킹",
  "예적금",
  "적금",
  "예금",
  "통장",
  "대기자금",
  "RP",
];

// USD/외화 현금 신호. 통화 정보가 없을 때 상품명·계좌명에서 달러 현금을 식별한다.
const USD_CASH_SIGNALS = ["달러", "USD", "외화", "미국달러", "DOLLAR", "US$"];

// 배당 목적 신호 (③배당 태그 또는 대표 배당 ETF).
const DIVIDEND_SIGNALS = ["배당", "인컴", "커버드콜", "월배당"];
const DIVIDEND_TICKERS = new Set([
  "SCHD",
  "JEPI",
  "JEPQ",
  "SPYM",
  "SPYD",
  "DIVO",
  "VYM",
  "DGRO",
  "O",
  "ARCC",
]);

function includesAny(haystack: string, signals: string[]): boolean {
  const upper = haystack.toUpperCase();
  return signals.some((signal) => upper.includes(signal.toUpperCase()));
}

// 통화 코드가 USD/외화인지 판단한다.
function isUsdCurrency(currency: string | undefined): boolean {
  if (!currency) return false;
  const c = currency.trim().toUpperCase();
  return c === "USD" || c === "US$" || c === "$" || c.includes("달러") || c.includes("USD");
}

// 현금성 자산을 통화별(현금(원)/현금(달러))로 분류한다.
// 우선순위: 명시 통화 → 상품명/계좌명 신호 → 보수적으로 현금(원).
// (통화를 알 수 없는 현금성은 기타를 만들지 않고 현금(원)으로 둔다.)
function classifyCashCurrencyGroup(
  haystack: string,
  currency?: string,
): "현금(원)" | "현금(달러)" {
  if (isUsdCurrency(currency)) return "현금(달러)";
  if (currency && currency.trim().toUpperCase() === "KRW") return "현금(원)";
  if (includesAny(haystack, USD_CASH_SIGNALS)) return "현금(달러)";
  return "현금(원)";
}

// 보유종목 1건을 성장/배당/현금(원)/현금(달러) 중 하나로 분류한다 (기타 그룹을 만들지 않는다).
function classifyHoldingPurposeGroup(holding: Holding): AssetPurposeGroup {
  const purpose = holdingPurposeName(holding) ?? "";
  const ticker = (holding.ticker || "").trim().toUpperCase().split(".")[0];
  const cashHaystack = [holding.assetType, holding.category, holding.productName, holding.cleanName, purpose]
    .filter(Boolean)
    .join(" ");

  if (holding.category === "현금" || includesAny(cashHaystack, CASH_LIKE_SIGNALS)) {
    return classifyCashCurrencyGroup(cashHaystack, holding.currency);
  }
  if (includesAny(purpose, DIVIDEND_SIGNALS) || DIVIDEND_TICKERS.has(ticker)) return "배당";
  // 성장 신호가 명시돼 있거나, 위 어디에도 해당하지 않는 투자 종목의 기본값.
  return "성장";
}

// 재무현황(현금성 잔액) 1건을 성장/배당/현금(원)/현금(달러) 중 하나로 분류한다.
function classifyFinanceAssetPurposeGroup(asset: FinanceAsset): AssetPurposeGroup {
  const haystack = [asset.category, asset.statusGroup, asset.groupName, asset.productName, asset.cleanName]
    .filter(Boolean)
    .join(" ");
  if (asset.category === "투자성") {
    if (includesAny(haystack, DIVIDEND_SIGNALS)) return "배당";
    return "성장";
  }
  // 현금/예적금/기타 금융자산은 현금성으로 보고 통화별로 분류한다 (FinanceAsset 은 통화 필드가 없어 이름으로만 판단).
  return classifyCashCurrencyGroup(haystack);
}

// 보유종목을 위탁/절세 트리맵 그룹으로 분류한다 (#4). 신호가 없으면 위탁으로 둔다.
function classifyHoldingTreemapGroup(holding: Holding): "위탁" | "절세" {
  const name = [holding.accountGroup, holding.accountName, holding.broker, holding.productName, holding.cleanName]
    .filter(Boolean)
    .join(" ");
  const group = classifyAccountStatusGroup({
    name,
    type: holding.assetType,
    statusGroup: holding.statusGroup,
  });
  return group === "절세" ? "절세" : "위탁";
}

function financeAccountName(asset: FinanceAsset): string | undefined {
  const extra = asset as FinanceAsset & {
    accountName?: string;
    broker?: string;
    institutionName?: string;
  };
  return (
    asset.accountGroup ||
    extra.accountName ||
    extra.broker ||
    extra.institutionName ||
    asset.groupName ||
    asset.cleanName ||
    asset.productName
  );
}

function taxTypeFromName(name: string, type: string): PortfolioAccountRow["tax"] {
  const text = `${name} ${type}`.toUpperCase();
  if (/ISA|IRP|연금|절세|비과세/.test(text)) return "비과세";
  if (/위탁|일반|해외주식|국내주식|과세/.test(text)) return "과세";
  return "미확인";
}

function isNonDebtFinanceAsset(asset: FinanceAsset): boolean {
  return asset.isDebt !== true;
}

function buildAccountRowsFromFinanceAssets(financeAssets: FinanceAsset[]): PortfolioAccountRow[] {
  const totals = new Map<string, { value: number; type: string; count: number }>();
  for (const asset of financeAssets) {
    if (!isNonDebtFinanceAsset(asset)) continue;
    const amount = positiveNumber(asset.amountKRW);
    if (amount === null) continue;
    const name = financeAccountName(asset)?.trim() || "미분류";
    const current = totals.get(name) ?? {
      value: 0,
      type: asset.statusGroup || asset.category || asset.groupName || "기타",
      count: 0,
    };
    current.value += amount;
    current.count += 1;
    totals.set(name, current);
  }

  return Array.from(totals.entries())
    .filter(([, item]) => item.value >= MIN_VISIBLE_ACCOUNT_AMOUNT_KRW)
    .sort((a, b) => b[1].value - a[1].value)
    .map(([name, item]) => ({
      name,
      type: item.type,
      tax: taxTypeFromName(name, item.type),
      value: Math.round(item.value),
      profit: null,
      rate: null,
      statusGroup: item.type,
      holdingCount: item.count,
      source: "financeAssets" as const,
    }));
}

function buildAccountRowsFromHoldings(holdings: Holding[]): PortfolioAccountRow[] {
  const totals = new Map<string, { value: number; principal: number; count: number; type: string }>();
  for (const holding of holdings) {
    const value = positiveNumber(holding.valueKRW);
    if (value === null) continue;
    const name = holdingAccountName(holding)?.trim() || "미분류";
    const current = totals.get(name) ?? {
      value: 0,
      principal: 0,
      count: 0,
      type: holding.statusGroup || holding.assetType || "기타",
    };
    current.value += value;
    current.principal += finiteNumber(holding.principalKRW) ?? 0;
    current.count += 1;
    totals.set(name, current);
  }

  return Array.from(totals.entries())
    .filter(([, item]) => item.value >= MIN_VISIBLE_ACCOUNT_AMOUNT_KRW)
    .sort((a, b) => b[1].value - a[1].value)
    .map(([name, item]) => {
      const profit = item.principal > 0 ? item.value - item.principal : null;
      return {
        name,
        type: item.type,
        tax: taxTypeFromName(name, item.type),
        value: Math.round(item.value),
        profit,
        rate: profit !== null && item.principal > 0 ? (profit / item.principal) * 100 : null,
        statusGroup: item.type,
        holdingCount: item.count,
        source: "holdings" as const,
      };
    });
}

function buildTreemapAndRanking(
  holdings: Holding[],
  warnings: PortfolioPageWarning[],
): {
  treemapItems: PortfolioTreemapItem[];
  holdingsRankingRows: PortfolioHoldingRankingRow[];
} {
  const totals = new Map<
    string,
    {
      name: string;
      ticker?: string;
      value: number;
      principal: number;
      group: string;
      count: number;
    }
  >();
  let excluded = 0;

  for (const holding of holdings) {
    const value = positiveNumber(holding.valueKRW);
    if (value === null) {
      excluded += 1;
      continue;
    }

    const name = holdingDisplayName(holding);
    const ticker = holding.ticker?.trim() || undefined;
    const key = ticker || name;
    const current = totals.get(key) ?? {
      name,
      ticker,
      value: 0,
      principal: 0,
      group: classifyHoldingTreemapGroup(holding),
      count: 0,
    };
    current.value += value;
    current.principal += finiteNumber(holding.principalKRW) ?? 0;
    current.count += 1;
    totals.set(key, current);
  }

  if (excluded > 0) {
    addWarning(
      warnings,
      "treemap_excluded_invalid_value",
      `평가금액이 확인되지 않은 종목 ${excluded}개는 트리맵에서 제외했습니다.`,
    );
  }

  const totalValue = Array.from(totals.values()).reduce((sum, item) => sum + item.value, 0);
  const sorted = Array.from(totals.values()).sort((a, b) => b.value - a.value);

  const treemapItems = sorted
    .map((item) => {
      const profit = item.principal > 0 ? item.value - item.principal : null;
      return {
        name: item.name,
        ticker: item.ticker,
        valueKRW: Math.round(item.value),
        weightPct: percent(item.value, totalValue),
        returnPct: profit !== null ? (profit / item.principal) * 100 : null,
        group: item.group,
      };
    })
    // 2% 미만은 트리맵 표시에서만 제외한다 (#3). 랭킹/요약은 영향받지 않는다.
    .filter((item) => item.weightPct >= TREEMAP_MIN_WEIGHT_PCT);

  const holdingsRankingRows = sorted.map((item, index) => {
    const principal = item.principal > 0 ? item.principal : null;
    const profit = principal !== null ? item.value - principal : null;
    return {
      rank: index + 1,
      name: item.name,
      ticker: item.ticker,
      valueKRW: Math.round(item.value),
      principalKRW: principal,
      profitKRW: profit,
      returnPct: profit !== null && principal !== null ? (profit / principal) * 100 : null,
      weightPct: percent(item.value, totalValue),
      sourceHoldingCount: item.count,
    };
  });

  return { treemapItems, holdingsRankingRows };
}

// 자산 구성 도넛/리스트를 성장/배당/현금(원)/현금(달러) 4개 그룹으로 집계한다 (#3).
// 보유종목은 목적·티커 기준으로, 현금성 잔액은 통화별로 분류한다.
const ASSET_PURPOSE_COLOR: Record<AssetPurposeGroup, string> = {
  성장: "#22c55e",
  배당: "#3b82f6",
  "현금(원)": "#f59e0b",
  "현금(달러)": "#14b8a6",
};
const ASSET_PURPOSE_ORDER: AssetPurposeGroup[] = ["성장", "배당", "현금(원)", "현금(달러)"];
const CASH_PURPOSE_GROUPS: AssetPurposeGroup[] = ["현금(원)", "현금(달러)"];
const INVESTMENT_PURPOSE_GROUPS: AssetPurposeGroup[] = ["성장", "배당"];

// PORTFOLIO-DIVIDEND-UX-FIX-3 #2: 자산 구성과 투자/현금 비중이 동일한 분류 기준에서
// 파생되도록, 두 화면이 공유하는 그룹별 합계를 한 곳에서 계산한다.
// 표시용 항목(보유종목 + 비투자성 현금성 잔액)만 집계해 도넛/비중 합계가 어긋나지 않게 한다.
function computeAssetPurposeTotals(
  holdings: Holding[],
  financeAssets: FinanceAsset[],
): Map<AssetPurposeGroup, number> {
  const financeRows = financeAssets.filter((asset) => {
    if (!isNonDebtFinanceAsset(asset)) return false;
    if (holdings.length > 0 && asset.category === "투자성") return false;
    return true;
  });

  const totals = new Map<AssetPurposeGroup, number>();
  const add = (group: AssetPurposeGroup, amount: number | null) => {
    if (amount === null) return;
    totals.set(group, (totals.get(group) ?? 0) + amount);
  };

  for (const holding of holdings) {
    add(classifyHoldingPurposeGroup(holding), positiveNumber(holding.valueKRW));
  }
  for (const asset of financeRows) {
    add(classifyFinanceAssetPurposeGroup(asset), positiveNumber(asset.amountKRW));
  }
  return totals;
}

function sumPurposeGroups(totals: Map<AssetPurposeGroup, number>, groups: AssetPurposeGroup[]): number {
  return groups.reduce((sum, group) => sum + (totals.get(group) ?? 0), 0);
}

function buildAssetAllocation(holdings: Holding[], financeAssets: FinanceAsset[]): PortfolioAllocationSlice[] {
  const totals = computeAssetPurposeTotals(holdings, financeAssets);
  const total = sumPurposeGroups(totals, ASSET_PURPOSE_ORDER);
  if (total <= 0) return [];

  return ASSET_PURPOSE_ORDER.filter((group) => (totals.get(group) ?? 0) > 0).map((group) => {
    const amountKRW = Math.round(totals.get(group) ?? 0);
    return {
      name: group,
      value: percent(amountKRW, total),
      color: ASSET_PURPOSE_COLOR[group],
      amountKRW,
    };
  });
}

// 투자/현금 비중을 자산 구성과 동일한 분류에서 파생한다 (#2).
// 투자 = 성장 + 배당, 현금 = 현금(원) + 현금(달러).
function buildStockCashTargets(
  holdings: Holding[],
  financeAssets: FinanceAsset[],
): PortfolioSummaryCards["stockCashTargets"] {
  const totals = computeAssetPurposeTotals(holdings, financeAssets);
  const investValue = sumPurposeGroups(totals, INVESTMENT_PURPOSE_GROUPS);
  const cashValue = sumPurposeGroups(totals, CASH_PURPOSE_GROUPS);
  const total = investValue + cashValue;
  if (total <= 0) return [];
  return [
    { name: "투자", current: percent(investValue, total), target: null },
    { name: "현금", current: percent(cashValue, total), target: null },
  ].filter((row) => row.current > 0);
}

export function buildPortfolioPageFromSnapshot(
  snapshot: PortfolioSnapshot | null,
  options: BuildPortfolioPageOptions = {},
): PortfolioPageModel {
  const warnings: PortfolioPageWarning[] = [];

  if (!snapshot) {
    addWarning(
      warnings,
      "no_snapshot",
      "저장된 포트폴리오 스냅샷이 없어 실데이터 섹션을 표시할 수 없습니다.",
      "info",
    );
    return {
      snapshot: null,
      mappedHoldings: [],
      summary: {
        snapshotDate: null,
        sourceFileName: null,
        totalAssetKRW: null,
        investmentValueKRW: null,
        investmentPrincipalKRW: null,
        returnAmountKRW: null,
        returnPct: null,
        holdingCount: 0,
        accountCount: 0,
        financeAssetCount: 0,
        stockCashTargets: [],
      },
      accountAllocation: [],
      stockAllocation: [],
      assetAllocation: [],
      purposeAllocation: [],
      accountCards: [],
      treemapItems: [],
      holdingsRankingRows: [],
      warnings,
      flags: {
        hasSnapshot: false,
        hasHoldings: false,
        hasFinanceAssets: false,
        hasTreemap: false,
        hasAccountAllocation: false,
        hasAssetAllocation: false,
        hasPurposeAllocation: false,
        hasTickerMapApplied: false,
        usesSampleData: false,
        sampleFallbackUsed: false,
      },
      accountAllocationSource: "none",
    };
  }

  const mapped = applyKrxTickerMappingsToHoldings(
    filterAggregateHoldings([...(snapshot.holdings ?? [])]),
    options.tickerNameMap,
  );
  const holdings = mapped.holdings;
  const financeAssets = [...(snapshot.financeAssets ?? [])];

  if (holdings.length === 0) {
    addWarning(warnings, "holdings_empty", "최신 스냅샷에 보유종목이 없어 종목 비중과 트리맵을 표시하지 않습니다.");
  }
  if (financeAssets.length === 0) {
    addWarning(warnings, "finance_assets_empty", "스냅샷에 계좌별 잔액 정보가 없어 보유종목 기준으로 계좌 비중을 계산했습니다.", "info");
  }
  if (mapped.appliedCount > 0) {
    addWarning(
      warnings,
      "ticker_name_map_applied",
      `직접 입력한 KRX 종목코드 ${mapped.appliedCount}개를 종목 표시에 반영했습니다.`,
      "info",
    );
  }

  const investmentValueFromHoldings = holdings.reduce(
    (sum, holding) => sum + (positiveNumber(holding.valueKRW) ?? 0),
    0,
  );
  const principalFromHoldings = holdings.reduce(
    (sum, holding) => sum + (finiteNumber(holding.principalKRW) ?? 0),
    0,
  );
  const snapshotInvestmentValue = positiveNumber(snapshot.investmentValueKRW);
  const snapshotTotalAsset = positiveNumber(snapshot.totalAssetKRW);
  const investmentValueKRW =
    snapshotInvestmentValue ?? (investmentValueFromHoldings > 0 ? investmentValueFromHoldings : snapshotTotalAsset);
  const investmentPrincipalKRW =
    positiveNumber(snapshot.investmentPrincipalKRW) ?? (principalFromHoldings > 0 ? principalFromHoldings : null);
  const returnAmountKRW =
    investmentValueKRW !== null && investmentPrincipalKRW !== null
      ? investmentValueKRW - investmentPrincipalKRW
      : finiteNumber(snapshot.returnAmountKRW);
  const returnPct =
    returnAmountKRW !== null && investmentPrincipalKRW !== null && investmentPrincipalKRW > 0
      ? (returnAmountKRW / investmentPrincipalKRW) * 100
      : investmentPrincipalKRW !== null && investmentPrincipalKRW > 0
        ? finiteNumber(snapshot.returnPct)
        : null;

  const { treemapItems, holdingsRankingRows } = buildTreemapAndRanking(holdings, warnings);
  if (holdings.length > 0 && treemapItems.length === 0) {
    addWarning(
      warnings,
      "treemap_value_unavailable",
      "평가금액 정보가 없어 트리맵을 표시하지 않습니다.",
    );
  }

  const financeAccountRows = buildAccountRowsFromFinanceAssets(financeAssets);
  const accountRows =
    financeAccountRows.length > 0 ? financeAccountRows : buildAccountRowsFromHoldings(holdings);
  const accountAllocationSource =
    financeAccountRows.length > 0 ? "financeAssets" : accountRows.length > 0 ? "holdings" : "none";

  if (accountRows.length === 0) {
    addWarning(
      warnings,
      "account_allocation_unavailable",
      "계좌별 평가금액 정보가 없어 계좌 비중을 표시하지 않습니다.",
    );
  } else if (accountAllocationSource === "holdings") {
    addWarning(
      warnings,
      "account_allocation_holdings_fallback",
      "계좌별 잔액 정보가 없어 보유종목의 계좌·금융사 기준으로 계좌 비중을 계산했습니다.",
      "info",
    );
  }

  const accountAllocation = groupSlices(accountRows, (row) => positiveNumber(row.value), (row) => row.name);
  // 종목별 비중 상위: KRX 숫자 티커는 한글 상품명으로 라벨링한다 (#4, 트리맵과 동일 helper).
  const stockAllocation = groupSlices(
    holdingsRankingRows,
    (row) => positiveNumber(row.valueKRW),
    (row) => holdingDisplayLabel({ name: row.name, ticker: row.ticker }),
    15,
  );
  const assetAllocation = buildAssetAllocation(holdings, financeAssets);
  const purposeAllocation = groupSlices(holdings, (holding) => positiveNumber(holding.valueKRW), holdingPurposeName);

  if (assetAllocation.length === 0) {
    addWarning(
      warnings,
      "asset_allocation_unavailable",
      "자산 종류 정보가 없어 자산 구성을 표시하지 않습니다.",
    );
  }
  if (purposeAllocation.length === 0 && holdings.length > 0) {
    addWarning(
      warnings,
      "purpose_tags_unavailable",
      "목적·태그 정보가 없어 태그 구성은 표시하지 않습니다.",
      "info",
    );
  }

  return {
    snapshot,
    mappedHoldings: holdings,
    summary: {
      snapshotDate: snapshot.snapshotDate,
      sourceFileName: snapshot.sourceFileName,
      totalAssetKRW: snapshotTotalAsset,
      investmentValueKRW,
      investmentPrincipalKRW,
      returnAmountKRW,
      returnPct,
      holdingCount: holdings.length,
      accountCount: accountRows.length,
      financeAssetCount: financeAssets.filter(isNonDebtFinanceAsset).length,
      stockCashTargets: buildStockCashTargets(holdings, financeAssets),
    },
    accountAllocation,
    stockAllocation,
    assetAllocation,
    purposeAllocation,
    accountCards: accountRows,
    treemapItems,
    holdingsRankingRows,
    warnings,
    flags: {
      hasSnapshot: true,
      hasHoldings: holdings.length > 0,
      hasFinanceAssets: financeAssets.length > 0,
      hasTreemap: treemapItems.length > 0,
      hasAccountAllocation: accountAllocation.length > 0,
      hasAssetAllocation: assetAllocation.length > 0,
      hasPurposeAllocation: purposeAllocation.length > 0,
      hasTickerMapApplied: mapped.appliedCount > 0,
      usesSampleData: false,
      sampleFallbackUsed: false,
    },
    accountAllocationSource,
  };
}

export function buildPortfolioPageFromSnapshots(
  snapshots: PortfolioSnapshot[],
  options: BuildPortfolioPageOptions = {},
): PortfolioPageModel {
  return buildPortfolioPageFromSnapshot(latestOfSnapshots([...snapshots]), options);
}
