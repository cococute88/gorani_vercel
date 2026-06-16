// =============================================================
// DIVIDEND-LEDGER-PERFORMANCE-STREAMLIT-UI-PORT-1
// 원본 Streamlit 배당금가계부 성과분석(original/logic/dividend_performance.py)을
// Vercel 환경에 이식한다.
//
// 원본은 "거래내역(transactions)"을 기준으로 월별 보유수량을 재구성해
// 평가액/누적입금/벤치마크를 계산한다. Vercel에는 거래내역 store가 없고
// 포트폴리오 스냅샷(엑셀 업로드) 히스토리만 존재하므로, 동일한 "의미"를
// 스냅샷 기반으로 재현한다 (data source = "스냅샷 기반").
//
// 계산 정의(원본과 동일한 의미):
//   - 누적 입금        = 해당 계좌군의 투자원금 합계(스냅샷 시점 누적값)
//   - 내 포트폴리오    = 해당 계좌군의 평가금액 합계
//   - 월별 순투자금    = 이번 스냅샷 원금 - 직전 스냅샷 원금
//   - 월별 손익        = 이번 평가액 - 직전 평가액 - 이번 순투자금
//   - 벤치마크 투자 시 = 동일한 순투자금 흐름을 벤치마크에 투자했다고 가정
//                        (원본 _benchmark_values 흐름과 동일)
//
// fake/sample 금지: 벤치마크 가격/환율이 없으면 해당 라인을 unavailable 처리한다.
// =============================================================

import type { Holding, PortfolioSnapshot } from "./portfolio-types";
import { classifyPerformanceAccountType } from "./performance-qld-from-snapshots";

export type AccountPerfGroup = "위탁" | "절세";
export const ACCOUNT_PERF_GROUPS: AccountPerfGroup[] = ["위탁", "절세"];

export type AccountPerfPoint = {
  date: string; // YYYY-MM-DD (스냅샷 날짜)
  label: string; // YY/MM
  year: number;
  depositKRW: number; // 누적 입금(투자원금 합계)
  portfolioKRW: number; // 평가금액 합계
  netInvestmentKRW: number; // 이번 달 순투자금
  monthlyProfitKRW: number; // 월별 손익
  totalAssetsKRW: number; // 총자산(평가금액)
};

export type AccountPerfLatest = {
  depositKRW: number;
  portfolioKRW: number;
  portfolioReturnPct: number | null;
};

export type AccountPerfBase = {
  group: AccountPerfGroup;
  available: boolean;
  dataSource: "snapshot-history" | "unavailable";
  sampleFallbackUsed: false;
  points: AccountPerfPoint[];
  availableYears: number[];
  yearlyProfitKRW: Record<number, number>;
  latest: AccountPerfLatest | null;
  unavailableReason?: string;
  warnings: string[];
};

function finite(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function validDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  return Number.isFinite(Date.parse(`${trimmed}T00:00:00Z`)) ? trimmed : null;
}

function monthKey(date: string): string {
  return date.slice(0, 7);
}

function labelOf(date: string): string {
  const [year, month] = date.split("-");
  return `${year.slice(-2)}/${Number(month)}`;
}

// 보유 1건을 위탁/절세로 분류한다. 절세(연금/ISA/IRP/연금저축/퇴직연금/절세)는
// classifyPerformanceAccountType(위탁/연금/ISA)을 재사용하고, 위탁이 아니면 절세로 본다.
export function accountGroupOfHolding(holding: Holding): AccountPerfGroup {
  return classifyPerformanceAccountType(holding) === "위탁" ? "위탁" : "절세";
}

// 스냅샷 히스토리에서 한 계좌군의 성과 시계열을 구성한다(스냅샷 기반).
export function buildAccountGroupPerformance(
  snapshots: PortfolioSnapshot[] | null | undefined,
  group: AccountPerfGroup,
): AccountPerfBase {
  const safe = Array.isArray(snapshots) ? snapshots : [];
  const dated = safe
    .map((snapshot) => ({ snapshot, date: validDate(snapshot.snapshotDate) }))
    .filter((row): row is { snapshot: PortfolioSnapshot; date: string } => row.date !== null)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  // 같은 달의 스냅샷이 여러 개면 마지막(월말에 가까운) 것만 사용한다.
  const byMonth = new Map<string, { snapshot: PortfolioSnapshot; date: string }>();
  for (const row of dated) byMonth.set(monthKey(row.date), row);
  const monthly = Array.from(byMonth.values()).sort((a, b) => (a.date < b.date ? -1 : 1));

  const unavailable = (reason: string): AccountPerfBase => ({
    group,
    available: false,
    dataSource: "unavailable",
    sampleFallbackUsed: false,
    points: [],
    availableYears: [],
    yearlyProfitKRW: {},
    latest: null,
    unavailableReason: reason,
    warnings: [reason],
  });

  if (monthly.length < 2) {
    return unavailable("성과분석 데이터 부족: 최소 2개 이상의 스냅샷이 필요합니다.");
  }

  let prevPrincipal = 0;
  let prevValue = 0;
  let hasHoldings = false;
  const points: AccountPerfPoint[] = monthly.map(({ snapshot, date }) => {
    let value = 0;
    let principal = 0;
    for (const holding of snapshot.holdings ?? []) {
      if (accountGroupOfHolding(holding) !== group) continue;
      const v = finite(holding.valueKRW);
      const p = finite(holding.principalKRW);
      if (v > 0) value += v;
      if (p > 0) principal += p;
    }
    if (value > 0 || principal > 0) hasHoldings = true;
    const netInvestment = principal - prevPrincipal;
    const monthlyProfit = value - prevValue - netInvestment;
    prevPrincipal = principal;
    prevValue = value;
    return {
      date,
      label: labelOf(date),
      year: Number(date.slice(0, 4)),
      depositKRW: principal,
      portfolioKRW: value,
      netInvestmentKRW: netInvestment,
      monthlyProfitKRW: monthlyProfit,
      totalAssetsKRW: value,
    };
  });

  if (!hasHoldings) {
    return unavailable(`${group} 계좌 유형의 보유 데이터가 없어 성과를 계산할 수 없습니다.`);
  }

  const yearlyProfitKRW: Record<number, number> = {};
  for (const point of points) {
    yearlyProfitKRW[point.year] = (yearlyProfitKRW[point.year] ?? 0) + point.monthlyProfitKRW;
  }
  const last = points[points.length - 1];
  const portfolioReturnPct =
    last.depositKRW > 0 && last.portfolioKRW > 0 ? (last.portfolioKRW / last.depositKRW - 1) * 100 : null;

  return {
    group,
    available: true,
    dataSource: "snapshot-history",
    sampleFallbackUsed: false,
    points,
    availableYears: Object.keys(yearlyProfitKRW).map(Number).sort((a, b) => a - b),
    yearlyProfitKRW,
    latest: {
      depositKRW: last.depositKRW,
      portfolioKRW: last.portfolioKRW,
      portfolioReturnPct,
    },
    warnings: [
      "거래내역 store가 없어 스냅샷 투자원금 증감액을 순투자금으로 간주해 계산합니다(스냅샷 기반).",
    ],
  };
}

// ----------------------------------------------------------------
// 벤치마크 계산 (원본 _benchmark_values 흐름과 동일)
// 동일한 순투자금 흐름을 벤치마크 종목에 투자했다고 가정하고, 각 시점 평가액을 구한다.
// USD 벤치마크는 순투자금(KRW)을 환율로 USD 환산 → 좌수 매입 → 평가 시 다시 KRW 환산.
// ----------------------------------------------------------------

export type BenchmarkPricePoint = { date: string; close: number };

export type BenchmarkComputeInput = {
  points: Array<{ date: string; netInvestmentKRW: number }>;
  prices: BenchmarkPricePoint[]; // 날짜 오름차순
  fx?: BenchmarkPricePoint[] | null; // USD/KRW 히스토리 (isUsd면 필수)
  isUsd: boolean;
};

export type BenchmarkSeriesResult = {
  available: boolean;
  values: Array<number | null>; // points와 정렬 일치
  latestValue: number | null;
  unavailableReason?: string;
};

// 정렬된 시계열에서 target 날짜 이하의 마지막 값(asof)을 찾는다.
function asof(series: BenchmarkPricePoint[], target: string): number | null {
  let result: number | null = null;
  for (const point of series) {
    if (point.date <= target) {
      if (point.close > 0) result = point.close;
    } else {
      break;
    }
  }
  return result;
}

export function computeBenchmarkSeries(input: BenchmarkComputeInput): BenchmarkSeriesResult {
  const { points, prices, fx, isUsd } = input;
  if (!prices || prices.length === 0) {
    return { available: false, values: points.map(() => null), latestValue: null, unavailableReason: "benchmark_price_unavailable" };
  }
  if (isUsd && (!fx || fx.length === 0)) {
    return { available: false, values: points.map(() => null), latestValue: null, unavailableReason: "benchmark_fx_unavailable" };
  }
  const sortedPrices = [...prices].sort((a, b) => (a.date < b.date ? -1 : 1));
  const sortedFx = fx ? [...fx].sort((a, b) => (a.date < b.date ? -1 : 1)) : null;

  let units = 0;
  let lastValue: number | null = null;
  const values = points.map((point) => {
    const close = asof(sortedPrices, point.date);
    const rate = isUsd ? asof(sortedFx as BenchmarkPricePoint[], point.date) : 1;
    if (close && close > 0 && rate && rate > 0) {
      const investInIndexCurrency = isUsd ? point.netInvestmentKRW / rate : point.netInvestmentKRW;
      units += investInIndexCurrency / close;
      lastValue = units * close * rate;
      return lastValue;
    }
    // 가격/환율이 없는 구간은 직전 계산값으로 표시(없으면 null).
    return lastValue;
  });

  const available = values.some((value) => value != null);
  return {
    available,
    values,
    latestValue: lastValue,
    unavailableReason: available ? undefined : "benchmark_unavailable",
  };
}

export function benchmarkReturnPct(latestValue: number | null, depositKRW: number): number | null {
  if (latestValue == null || depositKRW <= 0 || latestValue <= 0) return null;
  return (latestValue / depositKRW - 1) * 100;
}
