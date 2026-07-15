import type { SimulatorProjection, TotalWithdrawRow } from "./asset-simulator-types";

export type SafetyMonthlySupplyRow = {
  year: number;
  baseSupply: number | null;
  baseSupplyNominal: number | null;
  normalSupply: number | null;
  normalSupplyNominal: number | null;
  stressSupply: number | null;
  stressSupplyNominal: number | null;
  target: number | null;
  targetNominal: number | null;
};

export type SafetyAssetTrajectoryRow = {
  year: number;
  base: number | null;
  baseNominal: number | null;
  normal: number | null;
  normalNominal: number | null;
  stress: number | null;
  stressNominal: number | null;
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

// Good/Bad projection의 이미 계산된 월 월 현금흐름을 year 기준으로만 병합한다.
export function buildMonthlySupplyRows(
  projection: SimulatorProjection,
  normalProjection: SimulatorProjection | null,
  stressProjection: SimulatorProjection,
  targetMonthlyExpenseReal: number | null,
): SafetyMonthlySupplyRow[] | null {
  const baseRows = withdrawalRows(projection);
  const normalRows = normalProjection ? withdrawalRows(normalProjection) : null;
  const stressRows = withdrawalRows(stressProjection);
  if (!baseRows || !stressRows || baseRows.length === 0 || stressRows.length === 0) return null;

  const rows = new Map<number, SafetyMonthlySupplyRow>();
  const ensureRow = (year: unknown) => {
    if (typeof year !== "number" || !Number.isFinite(year)) return null;
    const existing = rows.get(year);
    if (existing) return existing;
    const nominalTarget = targetMonthlyExpenseReal === null
      ? null
      : targetMonthlyExpenseReal * Math.pow(1 + projection.inputs.inflationRate / 100, year - projection.inputs.startYear);
    const next: SafetyMonthlySupplyRow = {
      year, baseSupply: null, baseSupplyNominal: null, normalSupply: null, normalSupplyNominal: null,
      stressSupply: null, stressSupplyNominal: null, target: targetMonthlyExpenseReal, targetNominal: nominalTarget,
    };
    rows.set(year, next);
    return next;
  };

  baseRows.forEach((row) => {
    const merged = ensureRow(row.year);
    if (merged) {
      merged.baseSupply = toFiniteNumber(row.totalMonthlyIncomeReal);
      merged.baseSupplyNominal = toFiniteNumber(row.totalMonthlyIncomeNominal);
    }
  });
  normalRows?.forEach((row) => {
    const merged = ensureRow(row.year);
    if (merged) {
      merged.normalSupply = toFiniteNumber(row.totalMonthlyIncomeReal);
      merged.normalSupplyNominal = toFiniteNumber(row.totalMonthlyIncomeNominal);
    }
  });
  stressRows.forEach((row) => {
    const merged = ensureRow(row.year);
    if (merged) {
      merged.stressSupply = toFiniteNumber(row.totalMonthlyIncomeReal);
      merged.stressSupplyNominal = toFiniteNumber(row.totalMonthlyIncomeNominal);
    }
  });

  return Array.from(rows.values())
    .filter((row) => row.baseSupply !== null || row.normalSupply !== null || row.stressSupply !== null)
    .sort((left, right) => left.year - right.year);
}

// 두 projection의 실질 총자산을 같은 year 기준으로 방어적으로 병합한다.
export function buildAssetTrajectoryRows(
  projection: SimulatorProjection,
  normalProjection: SimulatorProjection | null,
  stressProjection: SimulatorProjection,
): SafetyAssetTrajectoryRow[] {
  const rows = new Map<number, SafetyAssetTrajectoryRow>();
  const ensureRow = (year: unknown) => {
    if (typeof year !== "number" || !Number.isFinite(year)) return null;
    const existing = rows.get(year);
    if (existing) return existing;
    const next: SafetyAssetTrajectoryRow = {
      year, base: null, baseNominal: null, normal: null, normalNominal: null, stress: null, stressNominal: null,
    };
    rows.set(year, next);
    return next;
  };

  projection.chartRows.forEach((row) => {
    const merged = ensureRow(row.year);
    if (merged) {
      merged.base = toFiniteNumber(row.combinedRealBalance);
      merged.baseNominal = toFiniteNumber(row.combinedNominalBalance);
    }
  });
  normalProjection?.chartRows.forEach((row) => {
    const merged = ensureRow(row.year);
    if (merged) {
      merged.normal = toFiniteNumber(row.combinedRealBalance);
      merged.normalNominal = toFiniteNumber(row.combinedNominalBalance);
    }
  });
  stressProjection.chartRows.forEach((row) => {
    const merged = ensureRow(row.year);
    if (merged) {
      merged.stress = toFiniteNumber(row.combinedRealBalance);
      merged.stressNominal = toFiniteNumber(row.combinedNominalBalance);
    }
  });

  return Array.from(rows.values())
    .filter((row) => row.base !== null || row.normal !== null || row.stress !== null)
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
    return `${year}년 · ${scenarioLabel} 월 현금흐름 데이터 없음`;
  }
  const coverage = (monthlySupply / targetMonthlyExpenseReal) * 100;
  return `${year}년 · ${scenarioLabel} 월 현금흐름 ${Math.round(monthlySupply).toLocaleString("ko-KR")}만원 / 목표 ${Math.round(targetMonthlyExpenseReal).toLocaleString("ko-KR")}만원 · 충당률 ${Math.round(coverage)}%`;
}

export function buildYearlyDetailRows(
  projection: SimulatorProjection,
  stressProjection: SimulatorProjection,
  targetMonthlyExpenseReal: number | null,
): SafetyYearlyDetailRow[] {
  const monthlyRows = buildMonthlySupplyRows(projection, null, stressProjection, targetMonthlyExpenseReal) ?? [];
  const trajectoryByYear = new Map(buildAssetTrajectoryRows(projection, null, stressProjection).map((row) => [row.year, row]));

  return monthlyRows.map((row) => {
    const trajectory = trajectoryByYear.get(row.year);
    return {
      ...row,
      base: trajectory?.base ?? null,
      baseNominal: trajectory?.baseNominal ?? null,
      normal: trajectory?.normal ?? null,
      normalNominal: trajectory?.normalNominal ?? null,
      stress: trajectory?.stress ?? null,
      stressNominal: trajectory?.stressNominal ?? null,
      baseStatus: getShortfallCellStatus(row.baseSupply, targetMonthlyExpenseReal),
      stressStatus: getShortfallCellStatus(row.stressSupply, targetMonthlyExpenseReal),
    };
  });
}
