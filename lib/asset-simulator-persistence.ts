import { normalizeInputs, normalizeYearPlansPreservingOutsidePeriod } from "./asset-simulator";
import { normalizePortfolioAssumptions, normalizePortfolioConfig } from "./asset-simulator-portfolio";
import type {
  AssetSimulatorPortfolioConfigV1,
  PersistedPortfolioAssumptions,
  RetirementSafetyConfigV1,
  SimulatorInputs,
  StoredSimulatorPreview,
  YearPlanRow,
} from "./asset-simulator-types";
import { DEFAULT_SIMULATOR_INPUTS } from "./mock-asset-simulator-data";

export type SimulatorPersistedConfig = StoredSimulatorPreview & {
  updatedAt?: unknown;
};

export type SimulatorHydrationSource = "cloud" | "local" | "default";

export type ResolvedSimulatorConfig = {
  inputs: SimulatorInputs;
  yearPlans: YearPlanRow[];
  portfolioConfig?: AssetSimulatorPortfolioConfigV1;
  portfolioAssumptions?: PersistedPortfolioAssumptions;
  retirementSafetyConfig?: RetirementSafetyConfigV1;
  updatedAtMs: number;
  source: SimulatorHydrationSource;
};

export type SimulatorPortfolioPersistence = {
  portfolioConfig?: AssetSimulatorPortfolioConfigV1;
  portfolioAssumptions?: PersistedPortfolioAssumptions;
  retirementSafetyConfig?: RetirementSafetyConfigV1;
};

// 저장/복원 시 안전성 체크 전용 설정을 방어적으로 정규화한다.
// - version 이 1 이 아니면 무효(null)
// - 목표 월생활비는 유한한 양수, 기간은 1~70년 정수, 물가상승률은 0~50%만 허용한다.
// - 기존 문서가 목표 월생활비만 가진 경우도 그대로 유효하다.
export function normalizeRetirementSafetyConfig(raw: unknown): RetirementSafetyConfigV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as { version?: unknown; targetMonthlyExpenseReal?: unknown; simulationYears?: unknown; inflationRate?: unknown };
  if (candidate.version !== 1) return null;
  const targetMonthlyExpenseReal =
    typeof candidate.targetMonthlyExpenseReal === "number" && Number.isFinite(candidate.targetMonthlyExpenseReal) && candidate.targetMonthlyExpenseReal > 0
      ? candidate.targetMonthlyExpenseReal
      : null;
  const simulationYears =
    typeof candidate.simulationYears === "number" && Number.isFinite(candidate.simulationYears) && Number.isInteger(candidate.simulationYears) && candidate.simulationYears >= 1 && candidate.simulationYears <= 70
      ? candidate.simulationYears
      : null;
  const inflationRate =
    typeof candidate.inflationRate === "number" && Number.isFinite(candidate.inflationRate) && candidate.inflationRate >= 0 && candidate.inflationRate <= 50
      ? candidate.inflationRate
      : null;
  if (targetMonthlyExpenseReal === null && simulationYears === null && inflationRate === null) return null;
  return {
    version: 1,
    ...(targetMonthlyExpenseReal !== null ? { targetMonthlyExpenseReal } : {}),
    ...(simulationYears !== null ? { simulationYears } : {}),
    ...(inflationRate !== null ? { inflationRate } : {}),
  };
}

function timestampToMs(value: unknown): number {
  if (!value) return 0;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "object") {
    const candidate = value as { toMillis?: () => number; seconds?: number; nanoseconds?: number; _seconds?: number; _nanoseconds?: number };
    if (typeof candidate.toMillis === "function") {
      const next = candidate.toMillis();
      return Number.isFinite(next) ? next : 0;
    }
    const seconds = candidate.seconds ?? candidate._seconds;
    const nanoseconds = candidate.nanoseconds ?? candidate._nanoseconds ?? 0;
    if (typeof seconds === "number" && Number.isFinite(seconds)) return seconds * 1000 + Math.floor(nanoseconds / 1_000_000);
  }
  return 0;
}

export function normalizePersistedSimulatorConfig(
  config: Partial<SimulatorPersistedConfig> | null | undefined,
  source: SimulatorHydrationSource,
): ResolvedSimulatorConfig | null {
  if (!config?.inputs) return null;
  const inputs = normalizeInputs({ ...DEFAULT_SIMULATOR_INPUTS, ...config.inputs });
  const portfolioConfig = normalizePortfolioConfig(config.portfolioConfig);
  const portfolioAssumptions = normalizePortfolioAssumptions(config.portfolioAssumptions);
  const retirementSafetyConfig = normalizeRetirementSafetyConfig(config.retirementSafetyConfig);
  return {
    inputs,
    yearPlans: normalizeYearPlansPreservingOutsidePeriod(inputs, config.yearPlans ?? []),
    ...(portfolioConfig ? { portfolioConfig } : {}),
    ...(portfolioAssumptions ? { portfolioAssumptions } : {}),
    ...(retirementSafetyConfig ? { retirementSafetyConfig } : {}),
    updatedAtMs: timestampToMs(config.updatedAt),
    source,
  };
}

export function chooseLatestSimulatorConfig(
  cloud: ResolvedSimulatorConfig | null,
  local: ResolvedSimulatorConfig | null,
): ResolvedSimulatorConfig | null {
  if (cloud && local) return cloud.updatedAtMs >= local.updatedAtMs ? cloud : local;
  return cloud ?? local;
}

export function buildStoredSimulatorConfig(
  inputs: SimulatorInputs,
  yearPlans: YearPlanRow[],
  updatedAt = new Date().toISOString(),
  portfolio: SimulatorPortfolioPersistence = {},
): StoredSimulatorPreview & { updatedAt: string } {
  const normalizedInputs = normalizeInputs(inputs);
  const portfolioConfig = normalizePortfolioConfig(portfolio.portfolioConfig);
  const portfolioAssumptions = normalizePortfolioAssumptions(portfolio.portfolioAssumptions);
  const retirementSafetyConfig = normalizeRetirementSafetyConfig(portfolio.retirementSafetyConfig);
  return {
    inputs: normalizedInputs,
    yearPlans: normalizeYearPlansPreservingOutsidePeriod(normalizedInputs, yearPlans),
    ...(portfolioConfig ? { portfolioConfig } : {}),
    ...(portfolioAssumptions ? { portfolioAssumptions } : {}),
    ...(retirementSafetyConfig ? { retirementSafetyConfig } : {}),
    updatedAt,
  };
}

export function sanitizeForFirestore(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "function" || typeof value === "symbol") return undefined;
  if (Array.isArray(value)) {
    return value.map((item) => {
      const cleaned = sanitizeForFirestore(item);
      return cleaned === undefined ? null : cleaned;
    });
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      const cleaned = sanitizeForFirestore(child);
      if (cleaned !== undefined) result[key] = cleaned;
    }
    return result;
  }
  return value;
}

export function findFirestoreUnsafePaths(value: unknown, path = "payload"): string[] {
  const unsafe: string[] = [];
  const visit = (item: unknown, currentPath: string) => {
    if (
      item === undefined ||
      typeof item === "function" ||
      typeof item === "symbol" ||
      (typeof item === "number" && !Number.isFinite(item))
    ) {
      unsafe.push(currentPath);
      return;
    }
    if (Array.isArray(item)) {
      item.forEach((child, index) => visit(child, `${currentPath}[${index}]`));
      return;
    }
    if (item && typeof item === "object") {
      for (const [key, child] of Object.entries(item)) {
        visit(child, `${currentPath}.${key}`);
      }
    }
  };
  visit(value, path);
  return unsafe;
}

export function buildFirestoreSimulatorConfigPayload(config: StoredSimulatorPreview): StoredSimulatorPreview {
  const normalizedInputs = normalizeInputs(config.inputs);
  const portfolioConfig = normalizePortfolioConfig(config.portfolioConfig);
  const portfolioAssumptions = normalizePortfolioAssumptions(config.portfolioAssumptions);
  const retirementSafetyConfig = normalizeRetirementSafetyConfig(config.retirementSafetyConfig);
  const normalizedConfig: StoredSimulatorPreview = {
    inputs: normalizedInputs,
    yearPlans: normalizeYearPlansPreservingOutsidePeriod(normalizedInputs, config.yearPlans ?? []),
    ...(portfolioConfig ? { portfolioConfig } : {}),
    ...(portfolioAssumptions ? { portfolioAssumptions } : {}),
    ...(retirementSafetyConfig ? { retirementSafetyConfig } : {}),
  };
  const cleaned = sanitizeForFirestore(normalizedConfig) as StoredSimulatorPreview;
  const unsafePaths = findFirestoreUnsafePaths(cleaned);
  if (unsafePaths.length > 0) {
    console.warn("assetSimulator.save sanitized payload still contains Firestore-unsafe values", unsafePaths);
    throw new Error(`Asset simulator Firestore payload is not serializable: ${unsafePaths.join(", ")}`);
  }
  return cleaned;
}

export function formatSimulatorSavedAt(updatedAtMs: number): string | null {
  if (!Number.isFinite(updatedAtMs) || updatedAtMs <= 0) return null;
  return new Date(updatedAtMs).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
}
