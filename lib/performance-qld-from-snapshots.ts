import type { Holding, PortfolioSnapshot } from "./portfolio-types";
import { filterAggregateHoldings } from "./portfolio-summary-row";
import { applyKrxTickerMappingsToHoldings } from "./krx-ticker-name-map";
import {
  buildPerformanceAssetGroups,
  type PerformanceAssetGroupResult,
} from "./performance-asset-group";

export type PerformanceQldValuePoint = {
  date: string;
  label: string;
  valueKRW: number;
};

// PORTFOLIO-CALCULATOR-UX-FIX-2 #6: 종목 랭킹 계좌 필터 유형.
export type PerformanceAccountType = "위탁" | "연금" | "ISA";
export const PERFORMANCE_ACCOUNT_TYPES: PerformanceAccountType[] = ["위탁", "연금", "ISA"];

export type PerformanceQldRankingRow = {
  ticker: string;
  name: string;
  color: string;
  weightPct: number | null;
  valueKRW: number | null;
  principalKRW: number | null;
  profitKRW: number | null;
  returnPct: number | null;
  sourceRows: number;
  // 계좌 유형별 평가금액/원금 분해 — 위탁/연금/ISA 필터에서 재집계할 때 사용한다.
  valueByAccountType: Record<PerformanceAccountType, number>;
  principalByAccountType: Record<PerformanceAccountType, number>;
};

export type PerformanceQldSummary = {
  latestSnapshotDate: string | null;
  evaluationKRW: number | null;
  evaluationSource: "investmentValueKRW" | "totalAssetKRW" | null;
  principalKRW: number | null;
  profitKRW: number | null;
  returnPct: number | null;
  previousSnapshotDate: string | null;
  previousChangeKRW: number | null;
  previousChangePct: number | null;
  highKRW: number | null;
  highDate: string | null;
  lowKRW: number | null;
  lowDate: string | null;
  mddPct: number | null;
  mddAmountKRW: number | null;
  mddStartDate: string | null;
  mddEndDate: string | null;
  currentOverHighPct: number | null;
  currentOverLowPct: number | null;
};

export type PerformanceQldFxResult = {
  available: false;
  latestRate: null;
  series: [];
  warning: string;
};

export type PerformanceQldResult = {
  source: "snapshot-history";
  usesSampleData: false;
  sampleFallbackUsed: false;
  snapshotCount: number;
  latestSnapshot: PortfolioSnapshot | null;
  summary: PerformanceQldSummary;
  valueSeries: PerformanceQldValuePoint[];
  topHoldings: PerformanceQldRankingRow[];
  rankings: PerformanceQldRankingRow[];
  // 자산 구성 도넛: 정규화 종목군(TQQQ/QLD/QQQ/SPY/SCHD/MSFT/달러/현금/예적금/기타) 합산.
  assetGroups: PerformanceAssetGroupResult;
  fx: PerformanceQldFxResult;
  flags: {
    hasSnapshots: boolean;
    hasValidEvaluation: boolean;
    hasHoldings: boolean;
    hasValueRanking: boolean;
    hasProfitRanking: boolean;
    hasReturnRanking: boolean;
  };
  warnings: string[];
};

const FX_UNAVAILABLE_WARNING =
  "fx_unavailable: PortfolioSnapshot/holdings/financeAssets schema에 환율 히스토리 필드가 없어 환율 추이를 표시하지 않습니다.";
const NO_SNAPSHOTS_WARNING = "no_snapshots: 저장된 스냅샷이 없습니다.";
const NO_EVALUATION_WARNING =
  "evaluation_unavailable: 최신 스냅샷에 유효한 investmentValueKRW 또는 totalAssetKRW가 없습니다.";
const NO_HOLDINGS_WARNING = "holdings_unavailable: 최신 스냅샷에 보유종목이 없습니다.";
const NO_RANKING_VALUE_WARNING =
  "ranking_value_unavailable: 보유종목에 유효한 평가금액(valueKRW)이 없어 평가금액 랭킹을 만들 수 없습니다.";
const NO_RANKING_PROFIT_WARNING =
  "ranking_profit_unavailable: 보유종목에 유효한 평가금액과 원금이 없어 손익/수익률 랭킹을 만들 수 없습니다.";

const RANK_COLORS = [
  "#5b7cff",
  "#10c7bd",
  "#9b7cf6",
  "#fb923c",
  "#34d399",
  "#fb4668",
  "#38bdf8",
  "#f5b945",
];
const SUMMARY_HOLDINGS_LIMIT = 5;

function validDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  return Number.isFinite(Date.parse(`${trimmed}T00:00:00Z`)) ? trimmed : null;
}

function positiveMoney(value: unknown): number | null {
  if (typeof value !== "number") return null;
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

function evaluationFromSnapshot(
  snapshot: PortfolioSnapshot | null | undefined,
): { value: number | null; source: PerformanceQldSummary["evaluationSource"] } {
  if (!snapshot) return { value: null, source: null };
  const investmentValue = positiveMoney(snapshot.investmentValueKRW);
  if (investmentValue !== null) return { value: investmentValue, source: "investmentValueKRW" };
  const totalAsset = positiveMoney(snapshot.totalAssetKRW);
  if (totalAsset !== null) return { value: totalAsset, source: "totalAssetKRW" };
  return { value: null, source: null };
}

function labelDate(date: string): string {
  const [, month, day] = date.split("-");
  return `${month}.${day}`;
}

function uniqueWarnings(warnings: string[]): string[] {
  return Array.from(new Set(warnings));
}

// 보유종목 1건을 위탁/연금/ISA 계좌 유형으로 분류한다 (#6). 신호가 없으면 위탁.
const PENSION_ACCOUNT_SIGNALS = ["연금저축", "퇴직연금", "미래연금", "IRP", "연금", "PENSION"];
export function classifyPerformanceAccountType(holding: Holding): PerformanceAccountType {
  const haystack = [
    holding.accountGroup,
    holding.accountName,
    holding.broker,
    holding.statusGroup,
    holding.purposeGroup,
    holding.productName,
    holding.cleanName,
  ]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();
  if (haystack.includes("ISA")) return "ISA";
  if (PENSION_ACCOUNT_SIGNALS.some((signal) => haystack.includes(signal.toUpperCase()))) return "연금";
  return "위탁";
}

function emptyAccountTypeRecord(): Record<PerformanceAccountType, number> {
  return { 위탁: 0, 연금: 0, ISA: 0 };
}

function groupName(holding: Holding): string {
  return (holding.cleanName || holding.productName || holding.ticker || "이름 없는 종목").trim();
}

function groupTicker(holding: Holding): string {
  const ticker = (holding.ticker || "").trim().toUpperCase();
  if (ticker) return ticker;
  return groupName(holding);
}

function buildRankings(holdings: Holding[], warnings: string[]): PerformanceQldRankingRow[] {
  const groups = new Map<
    string,
    {
      ticker: string;
      name: string;
      valueKRW: number;
      principalKRW: number;
      hasValue: boolean;
      hasPrincipal: boolean;
      sourceRows: number;
      valueByAccountType: Record<PerformanceAccountType, number>;
      principalByAccountType: Record<PerformanceAccountType, number>;
    }
  >();

  for (const holding of holdings) {
    const key = groupTicker(holding);
    const existing =
      groups.get(key) ??
      {
        ticker: key,
        name: groupName(holding),
        valueKRW: 0,
        principalKRW: 0,
        hasValue: false,
        hasPrincipal: false,
        sourceRows: 0,
        valueByAccountType: emptyAccountTypeRecord(),
        principalByAccountType: emptyAccountTypeRecord(),
      };

    const accountType = classifyPerformanceAccountType(holding);
    const value = positiveMoney(holding.valueKRW);
    const principal = positiveMoney(holding.principalKRW);
    if (value !== null) {
      existing.valueKRW += value;
      existing.valueByAccountType[accountType] += value;
      existing.hasValue = true;
    }
    if (principal !== null) {
      existing.principalKRW += principal;
      existing.principalByAccountType[accountType] += principal;
      existing.hasPrincipal = true;
    }
    existing.sourceRows += 1;
    groups.set(key, existing);
  }

  const valueGroups = Array.from(groups.values()).filter((row) => row.hasValue);
  const totalValue = valueGroups.reduce((sum, row) => sum + row.valueKRW, 0);
  if (valueGroups.length === 0 || totalValue <= 0) {
    warnings.push(NO_RANKING_VALUE_WARNING);
    return [];
  }

  // 상세 종목 랭킹용: Top 제한 없이 전체 종목을 평가금액순으로 반환한다 (#6).
  const rows = valueGroups
    .map((row) => {
      const canCalculateProfit = row.hasPrincipal && row.principalKRW > 0;
      const profitKRW = canCalculateProfit ? row.valueKRW - row.principalKRW : null;
      const returnPct = profitKRW !== null ? (profitKRW / row.principalKRW) * 100 : null;
      return {
        ticker: row.ticker,
        name: row.name,
        color: RANK_COLORS[0],
        weightPct: totalValue > 0 ? (row.valueKRW / totalValue) * 100 : null,
        valueKRW: row.valueKRW,
        principalKRW: canCalculateProfit ? row.principalKRW : null,
        profitKRW,
        returnPct,
        sourceRows: row.sourceRows,
        valueByAccountType: row.valueByAccountType,
        principalByAccountType: row.principalByAccountType,
      } satisfies PerformanceQldRankingRow;
    })
    .sort((a, b) => (b.valueKRW ?? 0) - (a.valueKRW ?? 0))
    .map((row, index) => ({ ...row, color: RANK_COLORS[index % RANK_COLORS.length] }));

  if (!rows.some((row) => row.profitKRW !== null && row.returnPct !== null)) {
    warnings.push(NO_RANKING_PROFIT_WARNING);
  }

  return rows;
}

// 위탁/연금/ISA 필터 상태에 맞춰 랭킹을 재집계한다 (#6).
// 선택된 계좌 유형의 평가금액·원금만 합산하고, 합이 0인 종목은 제외한 뒤 평가금액순으로 다시 정렬한다.
export function filterQldRankings(
  rows: PerformanceQldRankingRow[],
  enabled: Iterable<PerformanceAccountType>,
): PerformanceQldRankingRow[] {
  const enabledSet = new Set(enabled);
  const recomputed = rows
    .map((row) => {
      let value = 0;
      let principal = 0;
      let hasPrincipal = false;
      for (const type of PERFORMANCE_ACCOUNT_TYPES) {
        if (!enabledSet.has(type)) continue;
        value += row.valueByAccountType[type] ?? 0;
        const typePrincipal = row.principalByAccountType[type] ?? 0;
        if (typePrincipal > 0) {
          principal += typePrincipal;
          hasPrincipal = true;
        }
      }
      return { row, value, principal, hasPrincipal };
    })
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value);

  const totalValue = recomputed.reduce((sum, entry) => sum + entry.value, 0);

  return recomputed.map((entry, index) => {
    const principalKRW = entry.hasPrincipal && entry.principal > 0 ? entry.principal : null;
    const profitKRW = principalKRW !== null ? entry.value - principalKRW : null;
    const returnPct = profitKRW !== null && principalKRW !== null && principalKRW > 0
      ? (profitKRW / principalKRW) * 100
      : null;
    return {
      ...entry.row,
      color: RANK_COLORS[index % RANK_COLORS.length],
      weightPct: totalValue > 0 ? (entry.value / totalValue) * 100 : null,
      valueKRW: entry.value,
      principalKRW,
      profitKRW,
      returnPct,
    } satisfies PerformanceQldRankingRow;
  });
}

function buildMdd(series: PerformanceQldValuePoint[]): Pick<
  PerformanceQldSummary,
  "mddPct" | "mddAmountKRW" | "mddStartDate" | "mddEndDate"
> {
  let peak: PerformanceQldValuePoint | null = null;
  let worst = {
    pct: 0,
    amount: 0,
    start: null as string | null,
    end: null as string | null,
  };

  for (const point of series) {
    if (!peak || point.valueKRW > peak.valueKRW) {
      peak = point;
    }
    if (!peak || peak.valueKRW <= 0) continue;

    const amount = point.valueKRW - peak.valueKRW;
    const pct = (amount / peak.valueKRW) * 100;
    if (pct < worst.pct) {
      worst = {
        pct,
        amount,
        start: peak.date,
        end: point.date,
      };
    }
  }

  return {
    mddPct: worst.pct < 0 ? worst.pct : null,
    mddAmountKRW: worst.pct < 0 ? worst.amount : null,
    mddStartDate: worst.start,
    mddEndDate: worst.end,
  };
}

export function buildPerformanceQldFromSnapshots(
  snapshots: PortfolioSnapshot[],
): PerformanceQldResult {
  const warnings: string[] = [FX_UNAVAILABLE_WARNING];
  const safeSnapshots = Array.isArray(snapshots) ? snapshots : [];
  const datedSnapshots = safeSnapshots
    .map((snapshot, index) => {
      const date = validDate(snapshot.snapshotDate);
      if (!date) {
        warnings.push(`invalid_snapshot_date: ${index}번 스냅샷의 날짜가 유효하지 않습니다.`);
        return null;
      }
      return { snapshot, date };
    })
    .filter((row): row is { snapshot: PortfolioSnapshot; date: string } => row !== null)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  if (safeSnapshots.length === 0 || datedSnapshots.length === 0) {
    warnings.push(NO_SNAPSHOTS_WARNING, NO_EVALUATION_WARNING, NO_HOLDINGS_WARNING);
  }

  const latest = datedSnapshots[datedSnapshots.length - 1] ?? null;
  const previous = datedSnapshots.length >= 2 ? datedSnapshots[datedSnapshots.length - 2] : null;
  const latestEvaluation = evaluationFromSnapshot(latest?.snapshot);
  const previousEvaluation = evaluationFromSnapshot(previous?.snapshot);
  const principalKRW = positiveMoney(latest?.snapshot.investmentPrincipalKRW);
  const profitKRW =
    latestEvaluation.value !== null && principalKRW !== null ? latestEvaluation.value - principalKRW : null;
  const returnPct = profitKRW !== null && principalKRW !== null ? (profitKRW / principalKRW) * 100 : null;
  const previousChangeKRW =
    latestEvaluation.value !== null && previousEvaluation.value !== null
      ? latestEvaluation.value - previousEvaluation.value
      : null;
  const previousChangePct =
    previousChangeKRW !== null && previousEvaluation.value !== null && previousEvaluation.value > 0
      ? (previousChangeKRW / previousEvaluation.value) * 100
      : null;

  if (latest && latestEvaluation.value === null) warnings.push(NO_EVALUATION_WARNING);

  const valueSeries: PerformanceQldValuePoint[] = datedSnapshots
    .map(({ snapshot, date }) => {
      const evaluation = evaluationFromSnapshot(snapshot);
      if (evaluation.value === null) {
        warnings.push(`invalid_evaluation: ${date} 스냅샷의 평가금액이 유효하지 않습니다.`);
        return null;
      }
      return {
        date,
        label: labelDate(date),
        valueKRW: evaluation.value,
      } satisfies PerformanceQldValuePoint;
    })
    .filter((point): point is PerformanceQldValuePoint => point !== null);

  const high = valueSeries.reduce<PerformanceQldValuePoint | null>(
    (best, point) => (!best || point.valueKRW > best.valueKRW ? point : best),
    null,
  );
  const low = valueSeries.reduce<PerformanceQldValuePoint | null>(
    (best, point) => (!best || point.valueKRW < best.valueKRW ? point : best),
    null,
  );
  const mdd = buildMdd(valueSeries);
  const currentOverHighPct =
    latestEvaluation.value !== null && high && high.valueKRW > 0
      ? (latestEvaluation.value / high.valueKRW) * 100
      : null;
  const currentOverLowPct =
    latestEvaluation.value !== null && low && low.valueKRW > 0
      ? (latestEvaluation.value / low.valueKRW) * 100
      : null;

  const holdings = applyKrxTickerMappingsToHoldings(filterAggregateHoldings(latest?.snapshot.holdings ?? [])).holdings;
  if (latest && holdings.length === 0) warnings.push(NO_HOLDINGS_WARNING);
  const rankings = buildRankings(holdings, warnings);
  // 왼쪽 투자 성과 카드의 자산 구성 preview 는 전체 평가금액순 Top 5 로 고정한다.
  const topHoldings = rankings.slice(0, SUMMARY_HOLDINGS_LIMIT);
  // 자산 구성 도넛: 원본 상품명이 아니라 정규화 종목군 단위로 합산한다.
  const assetGroups = buildPerformanceAssetGroups(
    holdings.map((h) => ({
      ticker: h.ticker,
      productName: h.productName,
      cleanName: h.cleanName,
      tag: h.tag,
      valueKRW: h.valueKRW,
      principalKRW: h.principalKRW,
    })),
  );
  const hasProfitRanking = rankings.some((row) => row.profitKRW !== null);
  const hasReturnRanking = rankings.some((row) => row.returnPct !== null);

  return {
    source: "snapshot-history",
    usesSampleData: false,
    sampleFallbackUsed: false,
    snapshotCount: datedSnapshots.length,
    latestSnapshot: latest?.snapshot ?? null,
    summary: {
      latestSnapshotDate: latest?.date ?? null,
      evaluationKRW: latestEvaluation.value,
      evaluationSource: latestEvaluation.source,
      principalKRW,
      profitKRW,
      returnPct,
      previousSnapshotDate: previous?.date ?? null,
      previousChangeKRW,
      previousChangePct,
      highKRW: high?.valueKRW ?? null,
      highDate: high?.date ?? null,
      lowKRW: low?.valueKRW ?? null,
      lowDate: low?.date ?? null,
      ...mdd,
      currentOverHighPct,
      currentOverLowPct,
    },
    valueSeries,
    topHoldings,
    rankings,
    assetGroups,
    fx: {
      available: false,
      latestRate: null,
      series: [],
      warning: FX_UNAVAILABLE_WARNING,
    },
    flags: {
      hasSnapshots: datedSnapshots.length > 0,
      hasValidEvaluation: latestEvaluation.value !== null,
      hasHoldings: holdings.length > 0,
      hasValueRanking: rankings.length > 0,
      hasProfitRanking,
      hasReturnRanking,
    },
    warnings: uniqueWarnings(warnings),
  };
}
