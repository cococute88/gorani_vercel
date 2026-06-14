import type { PortfolioSnapshot } from "./portfolio-types";

export type PerformanceSnapshotPoint = {
  date: string;
  label: string;
  evaluationKRW: number | null;
  principalKRW: number | null;
  dividendKRW: number | null;
};

export type PerformanceMetrics = {
  currentValueKRW: number | null;
  investedPrincipalKRW: number | null;
  cumulativeGainKRW: number | null;
  cumulativeReturnPct: number | null;
  simpleAnnualizedReturnPct: number | null;
  moneyWeightedCagrPct: number | null;
  timeWeightedCagrPct: number | null;
  snapshotCount: number;
  firstSnapshotDate: string | null;
  latestSnapshotDate: string | null;
  warnings: string[];
};

export type SnapshotPerformanceResult = {
  metrics: PerformanceMetrics;
  series: PerformanceSnapshotPoint[];
  source: "snapshot-history";
  canCalculateTrend: boolean;
  warnings: string[];
};

const NO_SNAPSHOTS_WARNING = "no_snapshots: 저장된 스냅샷이 없습니다.";
const DIVIDEND_UNAVAILABLE_WARNING =
  "dividend_unavailable: PortfolioSnapshot에는 배당금 히스토리 필드가 없습니다.";
const CASHFLOW_UNAVAILABLE_WARNING =
  "cashflow_unavailable: 정확한 CAGR 계산에 필요한 입출금/현금흐름 히스토리가 없습니다.";
const NEED_TWO_SNAPSHOTS_WARNING =
  "insufficient_snapshots: CAGR 계산에는 유효한 날짜의 스냅샷 2개 이상이 필요합니다.";

function validDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const time = Date.parse(`${trimmed}T00:00:00Z`);
  return Number.isFinite(time) ? trimmed : null;
}

function validMoney(value: unknown): number | null {
  if (typeof value !== "number") return null;
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

function hasOwnNumber(row: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(row, key) && typeof (row as Record<string, unknown>)[key] === "number";
}

function readDividend(row: PortfolioSnapshot): number | null {
  const maybeRow = row as unknown as Record<string, unknown>;
  const candidateKeys = ["dividendKRW", "dividendAmountKRW", "cumulativeDividendKRW"];
  for (const key of candidateKeys) {
    const value = validMoney(maybeRow[key]);
    if (value !== null) return value;
  }
  return null;
}

function formatLabel(date: string): string {
  const [, month, day] = date.split("-");
  return `${month}.${day}`;
}

function uniqueWarnings(warnings: string[]): string[] {
  return Array.from(new Set(warnings));
}

export function buildPerformanceFromSnapshots(
  snapshots: PortfolioSnapshot[],
): SnapshotPerformanceResult {
  const warnings: string[] = [DIVIDEND_UNAVAILABLE_WARNING];

  if (!Array.isArray(snapshots) || snapshots.length === 0) {
    warnings.push(NO_SNAPSHOTS_WARNING, NEED_TWO_SNAPSHOTS_WARNING, CASHFLOW_UNAVAILABLE_WARNING);
    const metrics: PerformanceMetrics = {
      currentValueKRW: null,
      investedPrincipalKRW: null,
      cumulativeGainKRW: null,
      cumulativeReturnPct: null,
      simpleAnnualizedReturnPct: null,
      moneyWeightedCagrPct: null,
      timeWeightedCagrPct: null,
      snapshotCount: 0,
      firstSnapshotDate: null,
      latestSnapshotDate: null,
      warnings: uniqueWarnings(warnings),
    };
    return {
      metrics,
      series: [],
      source: "snapshot-history",
      canCalculateTrend: false,
      warnings: metrics.warnings,
    };
  }

  const series = snapshots
    .map((snapshot, index) => {
      const date = validDate(snapshot.snapshotDate);
      if (!date) {
        warnings.push(`invalid_snapshot_date: ${index}번 스냅샷의 날짜가 유효하지 않습니다.`);
        return null;
      }

      const evaluationKRW = validMoney(snapshot.investmentValueKRW);
      const principalKRW = validMoney(snapshot.investmentPrincipalKRW);
      const dividendKRW = readDividend(snapshot);

      if (evaluationKRW === null) {
        warnings.push(`invalid_evaluation: ${date} 스냅샷의 평가금액이 유효하지 않습니다.`);
      }
      if (principalKRW === null) {
        warnings.push(`invalid_principal: ${date} 스냅샷의 투자원금이 유효하지 않습니다.`);
      }
      if (
        hasOwnNumber(snapshot, "totalAssetKRW") &&
        evaluationKRW !== null &&
        snapshot.totalAssetKRW !== evaluationKRW
      ) {
        warnings.push("evaluation_uses_investment_value: 현재 평가액은 투자 평가금액 합계 기준입니다.");
      }

      return {
        date,
        label: formatLabel(date),
        evaluationKRW,
        principalKRW,
        dividendKRW,
      } satisfies PerformanceSnapshotPoint;
    })
    .filter((point): point is PerformanceSnapshotPoint => point !== null)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  if (series.length === 0) {
    warnings.push(NO_SNAPSHOTS_WARNING, NEED_TWO_SNAPSHOTS_WARNING, CASHFLOW_UNAVAILABLE_WARNING);
  } else if (series.length < 2) {
    warnings.push(NEED_TWO_SNAPSHOTS_WARNING, CASHFLOW_UNAVAILABLE_WARNING);
  } else {
    warnings.push(CASHFLOW_UNAVAILABLE_WARNING);
  }

  const latest = series[series.length - 1] ?? null;
  const currentValueKRW = latest?.evaluationKRW ?? null;
  const investedPrincipalKRW = latest?.principalKRW ?? null;
  const cumulativeGainKRW =
    currentValueKRW !== null && investedPrincipalKRW !== null
      ? currentValueKRW - investedPrincipalKRW
      : null;
  const cumulativeReturnPct =
    cumulativeGainKRW !== null && investedPrincipalKRW !== null && investedPrincipalKRW > 0
      ? (cumulativeGainKRW / investedPrincipalKRW) * 100
      : null;

  const metrics: PerformanceMetrics = {
    currentValueKRW,
    investedPrincipalKRW,
    cumulativeGainKRW,
    cumulativeReturnPct,
    simpleAnnualizedReturnPct: null,
    moneyWeightedCagrPct: null,
    timeWeightedCagrPct: null,
    snapshotCount: series.length,
    firstSnapshotDate: series[0]?.date ?? null,
    latestSnapshotDate: latest?.date ?? null,
    warnings: uniqueWarnings(warnings),
  };

  return {
    metrics,
    series,
    source: "snapshot-history",
    canCalculateTrend: series.length >= 2,
    warnings: metrics.warnings,
  };
}

