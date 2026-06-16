import { normalizeInputs, normalizeYearPlans } from "./asset-simulator";
import type { SimulatorInputs, StoredSimulatorPreview, YearPlanRow } from "./asset-simulator-types";
import { DEFAULT_SIMULATOR_INPUTS } from "./mock-asset-simulator-data";

export type SimulatorPersistedConfig = StoredSimulatorPreview & {
  updatedAt?: unknown;
};

export type SimulatorHydrationSource = "cloud" | "local" | "default";

export type ResolvedSimulatorConfig = {
  inputs: SimulatorInputs;
  yearPlans: YearPlanRow[];
  updatedAtMs: number;
  source: SimulatorHydrationSource;
};

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
  return {
    inputs,
    yearPlans: normalizeYearPlans(inputs, config.yearPlans ?? []),
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

export function buildStoredSimulatorConfig(inputs: SimulatorInputs, yearPlans: YearPlanRow[], updatedAt = new Date().toISOString()): StoredSimulatorPreview & { updatedAt: string } {
  const normalizedInputs = normalizeInputs(inputs);
  return {
    inputs: normalizedInputs,
    yearPlans: normalizeYearPlans(normalizedInputs, yearPlans),
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
  const normalizedConfig: StoredSimulatorPreview = {
    inputs: normalizedInputs,
    yearPlans: normalizeYearPlans(normalizedInputs, config.yearPlans ?? []),
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
