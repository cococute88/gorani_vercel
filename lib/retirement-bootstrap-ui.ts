import { RETIREMENT_BOOTSTRAP_UI_POLICY_VERSION } from "./retirement-bootstrap-config";
import type {
  RetirementBootstrapInput,
  RetirementBootstrapResult,
} from "./retirement-bootstrap-types";
import type {
  RetirementBootstrapWorkerError,
  RetirementBootstrapWorkerTiming,
} from "./retirement-bootstrap-worker-protocol";

const MAX_MEMORY_CACHE_ENTRIES = 8;

type NormalizedIdentityHolding = Record<string, string | number>;

export type RetirementBootstrapCalculationIdentity = {
  cacheKey: string;
  seed: number;
  normalizedInput: Record<string, unknown>;
};

export type RetirementBootstrapCacheEntry = {
  result: RetirementBootstrapResult;
  timing: RetirementBootstrapWorkerTiming;
  cachedAtEpochMs: number;
};

const memoryCache = new Map<string, RetirementBootstrapCacheEntry>();

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function compareIdentityHoldings(left: NormalizedIdentityHolding, right: NormalizedIdentityHolding): number {
  return stableStringify(left).localeCompare(stableStringify(right), "en");
}

function normalizeInputForIdentity(input: RetirementBootstrapInput): Record<string, unknown> {
  return {
    startYear: input.startYear,
    initialIsa: input.initialIsa,
    initialPension: input.initialPension,
    initialBrokerage: input.initialBrokerage,
    expectedInflationPct: input.expectedInflationPct,
    withdrawalRatePct: input.withdrawalRatePct,
    withdrawalGrowthRatePct: input.withdrawalGrowthRatePct,
    withdrawalDelayYears: input.withdrawalDelayYears,
    annualRequiredWithdrawalReal: input.annualRequiredWithdrawalReal,
    taxSavingHoldings: input.taxSavingHoldings.map((holding): NormalizedIdentityHolding => ({
      ticker: holding.mapping.ticker,
      weightPct: holding.weightPct,
      expectedTotalReturnCagrPct: holding.expectedTotalReturnCagrPct,
      assetClass: holding.mapping.assetClass,
      distributionPolicy: holding.mapping.distributionPolicy,
    })).sort(compareIdentityHoldings),
    brokerageHoldings: input.brokerageHoldings.map((holding): NormalizedIdentityHolding => ({
      ticker: holding.mapping.ticker,
      weightPct: holding.weightPct,
      expectedPriceCagrPct: holding.expectedPriceCagrPct,
      initialDividendYieldPct: holding.initialDividendYieldPct,
      expectedDividendGrowthPct: holding.expectedDividendGrowthPct,
      assetClass: holding.mapping.assetClass,
      distributionPolicy: holding.mapping.distributionPolicy,
    })).sort(compareIdentityHoldings),
  };
}

/** FNV-1a 32-bit. 현재 시각이나 Math.random()을 사용하지 않는 고정 product seed 정책이다. */
export function deterministicRetirementBootstrapSeed(material: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < material.length; index += 1) {
    hash ^= material.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function buildRetirementBootstrapCalculationIdentity(
  input: RetirementBootstrapInput,
  datasetVersion: string,
  simulationCount: number,
  blockLength: number,
): RetirementBootstrapCalculationIdentity {
  const normalizedInput = normalizeInputForIdentity(input);
  const seedMaterial = stableStringify({
    policyVersion: RETIREMENT_BOOTSTRAP_UI_POLICY_VERSION,
    datasetVersion,
    normalizedInput,
  });
  const seed = deterministicRetirementBootstrapSeed(seedMaterial);
  const cacheKey = stableStringify({
    policyVersion: RETIREMENT_BOOTSTRAP_UI_POLICY_VERSION,
    datasetVersion,
    simulationCount,
    blockLength,
    seed,
    normalizedInput,
  });
  return { cacheKey, seed, normalizedInput };
}

export function getRetirementBootstrapMemoryCache(cacheKey: string): RetirementBootstrapCacheEntry | null {
  const cached = memoryCache.get(cacheKey);
  if (!cached) return null;
  memoryCache.delete(cacheKey);
  memoryCache.set(cacheKey, cached);
  return cached;
}

export function setRetirementBootstrapMemoryCache(cacheKey: string, entry: RetirementBootstrapCacheEntry): void {
  memoryCache.delete(cacheKey);
  memoryCache.set(cacheKey, entry);
  while (memoryCache.size > MAX_MEMORY_CACHE_ENTRIES) {
    const oldestKey = memoryCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    memoryCache.delete(oldestKey);
  }
}

export function clearRetirementBootstrapMemoryCache(): void {
  memoryCache.clear();
}

export function classifyRetirementBootstrapInputError(error: unknown): RetirementBootstrapWorkerError {
  const message = error instanceof Error ? error.message : "장기 지속 가능성 분석 입력을 확인하지 못했습니다.";
  if (message.includes("승인된 자산군 패턴 매핑")) {
    return { code: "unsupported_etf", message, retryable: false };
  }
  return { code: "invalid_user_input", message, retryable: false };
}
