import type { FinanceAsset, Holding, PortfolioSnapshot } from "./portfolio-types";
import { filterAggregateHoldings } from "./portfolio-summary-row";
import {
  applyKrxTickerMappingsToHoldings,
  type KrxTickerNameMap,
} from "./krx-ticker-name-map";

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

function holdingAssetName(holding: Holding): string | undefined {
  return holding.assetType || holding.statusGroup || "투자성";
}

function financeAssetName(asset: FinanceAsset): string | undefined {
  return asset.category || asset.statusGroup || asset.groupName || "기타";
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
      group: holdingPurposeName(holding) || "미분류",
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
      `평가금액이 없거나 유효하지 않은 보유종목 ${excluded}개는 트리맵에서 제외했습니다.`,
    );
  }

  const totalValue = Array.from(totals.values()).reduce((sum, item) => sum + item.value, 0);
  const sorted = Array.from(totals.values()).sort((a, b) => b.value - a.value);

  const treemapItems = sorted.map((item) => {
    const profit = item.principal > 0 ? item.value - item.principal : null;
    return {
      name: item.name,
      ticker: item.ticker,
      valueKRW: Math.round(item.value),
      weightPct: percent(item.value, totalValue),
      returnPct: profit !== null ? (profit / item.principal) * 100 : null,
      group: item.group,
    };
  });

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

function buildAssetAllocation(holdings: Holding[], financeAssets: FinanceAsset[]): PortfolioAllocationSlice[] {
  const financeRows = financeAssets.filter((asset) => {
    if (!isNonDebtFinanceAsset(asset)) return false;
    if (holdings.length > 0 && asset.category === "투자성") return false;
    return true;
  });
  const financeSlices = groupSlices(financeRows, (asset) => positiveNumber(asset.amountKRW), financeAssetName);
  const holdingSlices = groupSlices(holdings, (holding) => positiveNumber(holding.valueKRW), holdingAssetName);
  const combined = [
    ...financeSlices.map((slice) => ({ name: slice.name, amountKRW: slice.amountKRW ?? 0 })),
    ...holdingSlices.map((slice) => ({ name: slice.name, amountKRW: slice.amountKRW ?? 0 })),
  ];
  return groupSlices(combined, (row) => positiveNumber(row.amountKRW), (row) => row.name);
}

function buildStockCashTargets(
  holdings: Holding[],
  financeAssets: FinanceAsset[],
): PortfolioSummaryCards["stockCashTargets"] {
  const stockValue = holdings.reduce((sum, holding) => sum + (positiveNumber(holding.valueKRW) ?? 0), 0);
  const cashValue = financeAssets
    .filter((asset) => isNonDebtFinanceAsset(asset) && asset.category === "현금")
    .reduce((sum, asset) => sum + (positiveNumber(asset.amountKRW) ?? 0), 0);
  const total = stockValue + cashValue;
  if (total <= 0) return [];
  return [
    { name: "투자", current: percent(stockValue, total), target: null },
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
    addWarning(warnings, "finance_assets_empty", "최신 스냅샷에 financeAssets가 없어 계좌 그래프는 holdings 기반으로 계산합니다.", "info");
  }
  if (mapped.appliedCount > 0) {
    addWarning(
      warnings,
      "ticker_name_map_applied",
      `저장된 KRX 상품명 매핑 ${mapped.appliedCount}개를 표시 단계에 적용했습니다.`,
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
      "평가금액 필드가 없어 트리맵을 표시하지 않습니다.",
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
      "financeAssets.amountKRW 또는 holdings.valueKRW 계좌 필드가 부족해 계좌별 그래프를 표시하지 않습니다.",
    );
  } else if (accountAllocationSource === "holdings") {
    addWarning(
      warnings,
      "account_allocation_holdings_fallback",
      "financeAssets에서 계좌 평가금액을 만들 수 없어 holdings의 계좌/금융사 필드로 계좌별 그래프를 계산했습니다.",
      "info",
    );
  }

  const accountAllocation = groupSlices(accountRows, (row) => positiveNumber(row.value), (row) => row.name);
  const stockAllocation = groupSlices(holdingsRankingRows, (row) => positiveNumber(row.valueKRW), (row) => row.ticker || row.name, 15);
  const assetAllocation = buildAssetAllocation(holdings, financeAssets);
  const purposeAllocation = groupSlices(holdings, (holding) => positiveNumber(holding.valueKRW), holdingPurposeName);

  if (assetAllocation.length === 0) {
    addWarning(
      warnings,
      "asset_allocation_unavailable",
      "holdings.assetType 또는 financeAssets.category 금액이 부족해 자산 구성을 표시하지 않습니다.",
    );
  }
  if (purposeAllocation.length === 0 && holdings.length > 0) {
    addWarning(
      warnings,
      "purpose_tags_unavailable",
      "목적/태그 필드가 없어 태그 구성은 표시하지 않습니다.",
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
