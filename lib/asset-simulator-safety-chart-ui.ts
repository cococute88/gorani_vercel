import type { SimulatorProjection, TotalWithdrawRow } from "./asset-simulator-types";

export type SafetyMonthlySupplyRow = {
  year: number;
  baseSupply: number | null;
  stressSupply: number | null;
  target: number | null;
};

export type SafetyAssetTrajectoryRow = {
  year: number;
  base: number | null;
  stress: number | null;
};

export type ShortfallCellStatus = "sufficient" | "mild_shortfall" | "severe_shortfall" | "no_target" | "unavailable";

export type SafetyYearlyDetailRow = SafetyMonthlySupplyRow & SafetyAssetTrajectoryRow & {
  baseStatus: ShortfallCellStatus;
  stressStatus: ShortfallCellStatus;
};

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// Safety 판정과 같은 인출 시작 시점 이후의 isWithdraw 행만 표시용으로 추린다.
function withdrawalRows(projection: SimulatorProjection): TotalWithdrawRow[] | null {
  const withdrawalStartIndex = projection.timeline.withdrawalStartIndex;
  if (withdrawalStartIndex === null || withdrawalStartIndex < 0 || projection.totalWithdrawRows.length === 0) return null;
  return projection.totalWithdrawRows.slice(withdrawalStartIndex).filter((row) => row.isWithdraw === true);
}

// 기본/하락장 projection의 이미 계산된 월 공급을 year 기준으로만 병합한다.
export function buildMonthlySupplyRows(
  projection: SimulatorProjection,
  stressProjection: SimulatorProjection,
  targetMonthlyExpenseReal: number | null,
): SafetyMonthlySupplyRow[] | null {
  const baseRows = withdrawalRows(projection);
  const stressRows = withdrawalRows(stressProjection);
  if (!baseRows || !stressRows || baseRows.length === 0 || stressRows.length === 0) return null;

  const rows = new Map<number, SafetyMonthlySupplyRow>();
  const ensureRow = (year: unknown) => {
    if (typeof year !== "number" || !Number.isFinite(year)) return null;
    const existing = rows.get(year);
    if (existing) return existing;
    const next: SafetyMonthlySupplyRow = { year, baseSupply: null, stressSupply: null, target: targetMonthlyExpenseReal };
    rows.set(year, next);
    return next;
  };

  baseRows.forEach((row) => {
    const merged = ensureRow(row.year);
    if (merged) merged.baseSupply = toFiniteNumber(row.totalMonthlyIncomeReal);
  });
  stressRows.forEach((row) => {
    const merged = ensureRow(row.year);
    if (merged) merged.stressSupply = toFiniteNumber(row.totalMonthlyIncomeReal);
  });

  return Array.from(rows.values())
    .filter((row) => row.baseSupply !== null || row.stressSupply !== null)
    .sort((left, right) => left.year - right.year);
}

// 두 projection의 실질 총자산을 같은 year 기준으로 방어적으로 병합한다.
export function buildAssetTrajectoryRows(
  projection: SimulatorProjection,
  stressProjection: SimulatorProjection,
): SafetyAssetTrajectoryRow[] {
  const rows = new Map<number, SafetyAssetTrajectoryRow>();
  const ensureRow = (year: unknown) => {
    if (typeof year !== "number" || !Number.isFinite(year)) return null;
    const existing = rows.get(year);
    if (existing) return existing;
    const next: SafetyAssetTrajectoryRow = { year, base: null, stress: null };
    rows.set(year, next);
    return next;
  };

  projection.chartRows.forEach((row) => {
    const merged = ensureRow(row.year);
    if (merged) merged.base = toFiniteNumber(row.combinedRealBalance);
  });
  stressProjection.chartRows.forEach((row) => {
    const merged = ensureRow(row.year);
    if (merged) merged.stress = toFiniteNumber(row.combinedRealBalance);
  });

  return Array.from(rows.values())
    .filter((row) => row.base !== null || row.stress !== null)
    .sort((left, right) => left.year - right.year);
}

// Safety meaningful shortfall(수요의 1% 이상 부족) 기준과 맞춘 UI 표시 기준이다.
export function getShortfallCellStatus(monthlySupply: number | null, targetMonthlyExpenseReal: number | null): ShortfallCellStatus {
  if (targetMonthlyExpenseReal === null || !Number.isFinite(targetMonthlyExpenseReal) || targetMonthlyExpenseReal <= 0) return "no_target";
  if (monthlySupply === null || !Number.isFinite(monthlySupply)) return "unavailable";
  const coverage = monthlySupply / targetMonthlyExpenseReal;
  if (coverage >= 0.99) return "sufficient";
  if (coverage >= 0.9) return "mild_shortfall";
  return "severe_shortfall";
}

export function formatShortfallCellLabel(
  year: number,
  scenarioLabel: string,
  monthlySupply: number | null,
  targetMonthlyExpenseReal: number | null,
): string {
  if (targetMonthlyExpenseReal === null || !Number.isFinite(targetMonthlyExpenseReal) || targetMonthlyExpenseReal <= 0) {
    return `${year}년 · ${scenarioLabel} 목표 월생활비 없음`;
  }
  if (monthlySupply === null || !Number.isFinite(monthlySupply)) {
    return `${year}년 · ${scenarioLabel} 공급 데이터 없음`;
  }
  const coverage = (monthlySupply / targetMonthlyExpenseReal) * 100;
  return `${year}년 · ${scenarioLabel} 공급 ${Math.round(monthlySupply).toLocaleString("ko-KR")}만원 / 목표 ${Math.round(targetMonthlyExpenseReal).toLocaleString("ko-KR")}만원 · 충당률 ${Math.round(coverage)}%`;
}

export function buildYearlyDetailRows(
  projection: SimulatorProjection,
  stressProjection: SimulatorProjection,
  targetMonthlyExpenseReal: number | null,
): SafetyYearlyDetailRow[] {
  const monthlyRows = buildMonthlySupplyRows(projection, stressProjection, targetMonthlyExpenseReal) ?? [];
  const trajectoryByYear = new Map(buildAssetTrajectoryRows(projection, stressProjection).map((row) => [row.year, row]));

  return monthlyRows.map((row) => {
    const trajectory = trajectoryByYear.get(row.year);
    return {
      ...row,
      base: trajectory?.base ?? null,
      stress: trajectory?.stress ?? null,
      baseStatus: getShortfallCellStatus(row.baseSupply, targetMonthlyExpenseReal),
      stressStatus: getShortfallCellStatus(row.stressSupply, targetMonthlyExpenseReal),
    };
  });
}
