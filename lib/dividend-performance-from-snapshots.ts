import type { PortfolioSnapshot } from "./portfolio-types";

export type DividendPerformancePoint = {
  date: string;
  deposit: number;
  portfolio: number;
  kospi: number | null;
  sp500: number | null;
  monthlyProfit: number | null;
  totalAssets: number;
  netInvestment: number;
  year: number;
};

export type DividendPerformanceKpis = {
  cumulativeDepositKRW: number;
  portfolioValueKRW: number;
  portfolioReturnPct: number | null;
  kospiValueKRW: number | null;
  kospiReturnPct: number | null;
  sp500ValueKRW: number | null;
  sp500ReturnPct: number | null;
};

export type DividendPerformanceResult = {
  available: boolean;
  dataSource: "snapshot-history" | "unavailable";
  sampleFallbackUsed: false;
  points: DividendPerformancePoint[];
  kpis: DividendPerformanceKpis | null;
  availableYears: number[];
  yearlyProfitKRW: Record<number, number>;
  warnings: string[];
  unavailableReason?: string;
};

function finite(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function monthKey(date: string): string {
  return date.slice(0, 7);
}

function pct(value: number | null, base: number): number | null {
  if (value == null || base <= 0 || value <= 0) return null;
  return (value / base - 1) * 100;
}

export function buildDividendPerformanceFromSnapshots(snapshots: PortfolioSnapshot[]): DividendPerformanceResult {
  const ordered = [...snapshots]
    .filter((snapshot) => snapshot.snapshotDate && Number.isFinite(snapshot.investmentValueKRW) && Number.isFinite(snapshot.investmentPrincipalKRW))
    .sort((a, b) => (a.snapshotDate < b.snapshotDate ? -1 : a.snapshotDate > b.snapshotDate ? 1 : 0));

  if (ordered.length < 2) {
    return {
      available: false,
      dataSource: "unavailable",
      sampleFallbackUsed: false,
      points: [],
      kpis: null,
      availableYears: [],
      yearlyProfitKRW: {},
      warnings: ["거래/스냅샷 기록이 부족합니다. 최소 2개 이상의 스냅샷이 필요합니다."],
      unavailableReason: "성과분석 데이터 부족",
    };
  }

  const byMonth = new Map<string, PortfolioSnapshot>();
  for (const snapshot of ordered) byMonth.set(monthKey(snapshot.snapshotDate), snapshot);
  const monthEnds = Array.from(byMonth.values()).sort((a, b) => (a.snapshotDate < b.snapshotDate ? -1 : 1));

  let previousPrincipal = 0;
  let previousValue = 0;
  const points = monthEnds.map((snapshot) => {
    const deposit = finite(snapshot.investmentPrincipalKRW);
    const portfolio = finite(snapshot.investmentValueKRW);
    const netInvestment = deposit - previousPrincipal;
    const monthlyProfit = portfolio - previousValue - netInvestment;
    previousPrincipal = deposit;
    previousValue = portfolio;
    return {
      date: monthKey(snapshot.snapshotDate),
      deposit,
      portfolio,
      kospi: null,
      sp500: null,
      monthlyProfit,
      totalAssets: finite(snapshot.totalAssetKRW) || portfolio,
      netInvestment,
      year: Number(snapshot.snapshotDate.slice(0, 4)),
    };
  });

  const latest = points.at(-1)!;
  const yearlyProfitKRW: Record<number, number> = {};
  for (const point of points) yearlyProfitKRW[point.year] = (yearlyProfitKRW[point.year] ?? 0) + (point.monthlyProfit ?? 0);

  return {
    available: true,
    dataSource: "snapshot-history",
    sampleFallbackUsed: false,
    points,
    kpis: {
      cumulativeDepositKRW: latest.deposit,
      portfolioValueKRW: latest.portfolio,
      portfolioReturnPct: pct(latest.portfolio, latest.deposit),
      kospiValueKRW: null,
      kospiReturnPct: null,
      sp500ValueKRW: null,
      sp500ReturnPct: null,
    },
    availableYears: Object.keys(yearlyProfitKRW).map(Number).sort((a, b) => a - b),
    yearlyProfitKRW,
    warnings: [
      "거래내역과 벤치마크 가격 이력이 없어 KOSPI/S&P 500 비교선은 표시하지 않습니다.",
      "월별 손익은 스냅샷 투자원금 증감액을 순투자금으로 간주해 계산합니다.",
    ],
  };
}
