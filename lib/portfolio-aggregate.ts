import type { Slice } from "./mockData";
import { ACCOUNT_CARDS, PORTFOLIO_SUMMARY_DARK } from "./mockData";
import type { FinanceAsset, Holding, PortfolioSnapshot } from "./portfolio-types";

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

export type LivePortfolioSummary = typeof PORTFOLIO_SUMMARY_DARK;

export type LiveAccountCard = (typeof ACCOUNT_CARDS)[number] & {
  statusGroup: string;
  holdingCount: number;
};

export interface PortfolioViewModel {
  hasLiveData: boolean;
  snapshot: PortfolioSnapshot | null;
  summary: LivePortfolioSummary;
  accountAllocation: Slice[];
  stockAllocation: Slice[];
  purposeAllocation: Slice[];
  accountCards: LiveAccountCard[];
}

function percent(value: number, total: number): number {
  if (total <= 0) return 0;
  return Number(((value / total) * 100).toFixed(1));
}

function colorAt(index: number): string {
  return COLORS[index % COLORS.length];
}

function groupSlices<T>(
  rows: T[],
  valueOf: (row: T) => number,
  nameOf: (row: T) => string | undefined,
  limit?: number,
): Slice[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const value = valueOf(row);
    if (!Number.isFinite(value) || value <= 0) continue;
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

  return sorted.map(([name, value], index) => ({
    name,
    value: percent(value, total),
    color: colorAt(index),
  }));
}

function accountName(holding: Holding): string {
  return holding.accountGroup || holding.broker || "기타";
}

function symbolName(holding: Holding): string {
  return holding.symbolGroup || holding.ticker || holding.cleanName || holding.productName || "미분류";
}

function purposeName(holding: Holding): string {
  return holding.purposeGroup || holding.tag || "미분류";
}

function statusName(row: Holding | FinanceAsset): string {
  return row.statusGroup || ("assetType" in row ? row.assetType : row.category) || "기타";
}

export function buildPortfolioViewModel(snapshot: PortfolioSnapshot | null): PortfolioViewModel {
  if (!snapshot) {
    return {
      hasLiveData: false,
      snapshot: null,
      summary: PORTFOLIO_SUMMARY_DARK,
      accountAllocation: [],
      stockAllocation: [],
      purposeAllocation: [],
      accountCards: ACCOUNT_CARDS.map((card) => ({
        ...card,
        statusGroup: card.type,
        holdingCount: 0,
      })),
    };
  }

  const holdings = snapshot.holdings ?? [];
  const investmentValue = snapshot.investmentValueKRW || holdings.reduce((sum, h) => sum + h.valueKRW, 0);
  const principal = snapshot.investmentPrincipalKRW || holdings.reduce((sum, h) => sum + h.principalKRW, 0);
  const profit = snapshot.returnAmountKRW || investmentValue - principal;
  const rate = principal > 0 ? (profit / principal) * 100 : snapshot.returnPct;
  const accountSet = new Set(holdings.map(accountName));

  const accountTotals = new Map<string, { value: number; principal: number; count: number; statusGroup: string }>();
  for (const holding of holdings) {
    const name = accountName(holding);
    const current = accountTotals.get(name) ?? { value: 0, principal: 0, count: 0, statusGroup: statusName(holding) };
    current.value += holding.valueKRW;
    current.principal += holding.principalKRW;
    current.count += 1;
    if (!current.statusGroup || current.statusGroup === "기타") current.statusGroup = statusName(holding);
    accountTotals.set(name, current);
  }

  const accountCards: LiveAccountCard[] = Array.from(accountTotals.entries())
    .sort((a, b) => b[1].value - a[1].value)
    .map(([name, item]) => {
      const accountProfit = item.value - item.principal;
      return {
        name,
        type: item.statusGroup,
        tax: /isa|연금|퇴직/i.test(name) ? "비과세" : "과세",
        value: item.value,
        profit: accountProfit,
        rate: item.principal > 0 ? (accountProfit / item.principal) * 100 : 0,
        statusGroup: item.statusGroup,
        holdingCount: item.count,
      };
    });

  return {
    hasLiveData: true,
    snapshot,
    summary: {
      ...PORTFOLIO_SUMMARY_DARK,
      totalValue: investmentValue || snapshot.totalAssetKRW,
      totalProfit: profit,
      totalProfitRate: rate,
      todayProfit: 0,
      todayProfitRate: 0,
      cumPrincipal: principal,
      cumPerformance: Math.max(investmentValue - principal, 0),
      cumReturnRate: rate,
      accounts: accountSet.size,
      holdings: holdings.length,
      stockCashTargets: groupSlices(
        [
          { name: "주식", value: holdings.reduce((sum, h) => sum + h.valueKRW, 0) },
          { name: "현금", value: snapshot.financeAssets.filter((a) => a.category === "현금").reduce((sum, a) => sum + a.amountKRW, 0) },
        ],
        (row) => row.value,
        (row) => row.name,
      ).map((row) => ({ name: row.name, current: row.value, target: row.name === "현금" ? 40 : 60 })),
      tagTargets: groupSlices(holdings, (h) => h.valueKRW, purposeName).slice(0, 3).map((row) => ({
        name: row.name,
        current: row.value,
        target: row.name === "현금" ? 20 : 40,
      })),
    },
    accountAllocation: groupSlices(holdings, (h) => h.valueKRW, accountName),
    stockAllocation: groupSlices(holdings, (h) => h.valueKRW, symbolName, 15),
    purposeAllocation: groupSlices(holdings, (h) => h.valueKRW, purposeName),
    accountCards,
  };
}
