import { normalizePortfolioTicker, validatePortfolioConfig } from "./asset-simulator-portfolio";
import type {
  AppliedAccountPortfolioAssumptions,
  AppliedPortfolioAssumptionsV1,
  AppliedPortfolioHoldingAssumption,
  AssetSimulatorPortfolioConfigV1,
  EffectivePortfolioProjectionAssumptions,
  PortfolioAccountType,
  PortfolioHoldingInput,
  PortfolioHoldingResolution,
  PortfolioManualMetrics,
  PortfolioMetricKey,
  PortfolioMetricSource,
  PortfolioMetricStatus,
  PortfolioValidationIssue,
  ResolvedPortfolioMetric,
} from "./asset-simulator-types";

const MIN_RETURN_PCT = -99;
const MAX_RETURN_PCT = 100;
const MAX_DIVIDEND_YIELD_PCT = 100;

function clampProjectionPct(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(min, value));
}

function weightedMetricPct(
  holdings: AppliedPortfolioHoldingAssumption[],
  metric: "totalReturnCagrPct" | "priceCagrPct" | "dividendYieldPct",
): number {
  return holdings.reduce((sum, holding) => {
    const value = holding[metric];
    return sum + holding.weightPct * (typeof value === "number" && Number.isFinite(value) ? value : 0);
  }, 0) / 100;
}

export function resolveEffectivePortfolioProjectionAssumptions(
  assumptions: AppliedPortfolioAssumptionsV1,
): EffectivePortfolioProjectionAssumptions {
  const taxSavingTotalReturnPct = clampProjectionPct(
    weightedMetricPct(assumptions.taxSaving.holdings, "totalReturnCagrPct"),
    MIN_RETURN_PCT,
    MAX_RETURN_PCT,
  );
  const brokeragePriceReturnPct = clampProjectionPct(
    weightedMetricPct(assumptions.brokerage.holdings, "priceCagrPct"),
    MIN_RETURN_PCT,
    MAX_RETURN_PCT,
  );
  const brokerageDividendYieldPct = clampProjectionPct(
    weightedMetricPct(assumptions.brokerage.holdings, "dividendYieldPct"),
    0,
    MAX_DIVIDEND_YIELD_PCT,
  );
  const dividendContributionTotal = assumptions.brokerage.holdings.reduce((sum, holding) => {
    const yieldPct = typeof holding.dividendYieldPct === "number" && Number.isFinite(holding.dividendYieldPct)
      ? Math.max(0, holding.dividendYieldPct)
      : 0;
    return sum + holding.weightPct * yieldPct;
  }, 0);
  const brokerageDividendGrowthPct = dividendContributionTotal > 0
    ? clampProjectionPct(assumptions.brokerage.holdings.reduce((sum, holding) => {
      const yieldPct = typeof holding.dividendYieldPct === "number" && Number.isFinite(holding.dividendYieldPct)
        ? Math.max(0, holding.dividendYieldPct)
        : 0;
      const growthPct = typeof holding.dividendGrowthPct === "number" && Number.isFinite(holding.dividendGrowthPct)
        ? holding.dividendGrowthPct
        : 0;
      return sum + holding.weightPct * yieldPct * growthPct;
    }, 0) / dividendContributionTotal, MIN_RETURN_PCT, MAX_RETURN_PCT)
    : 0;

  return {
    taxSavingTotalReturnPct,
    brokeragePriceReturnPct,
    brokerageDividendYieldPct,
    brokerageDividendGrowthPct,
    portfolioSummary: {
      appliedAt: assumptions.appliedAt,
      taxSaving: {
        tickers: assumptions.taxSaving.holdings.map((holding) => holding.ticker),
        effectiveTotalReturnPct: taxSavingTotalReturnPct,
      },
      brokerage: {
        tickers: assumptions.brokerage.holdings.map((holding) => holding.ticker),
        effectivePriceReturnPct: brokeragePriceReturnPct,
        effectiveDividendYieldPct: brokerageDividendYieldPct,
        effectiveDividendGrowthPct: brokerageDividendGrowthPct,
      },
    },
  };
}

const ACCOUNT_TYPES: PortfolioAccountType[] = ["taxSaving", "brokerage"];
const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

const METRIC_VALUE_FIELDS: Record<PortfolioMetricKey, keyof PortfolioManualMetrics> = {
  totalReturnCagr: "totalReturnCagrPct",
  priceCagr: "priceCagrPct",
  dividendYield: "dividendYieldPct",
  dividendGrowth: "dividendGrowthPct",
};

function requiredMetricKeys(accountType: PortfolioAccountType): PortfolioMetricKey[] {
  return accountType === "taxSaving"
    ? ["totalReturnCagr"]
    : ["priceCagr", "dividendYield", "dividendGrowth"];
}

function manualMetricValue(holding: PortfolioHoldingInput, metric: PortfolioMetricKey): number | null {
  const key = METRIC_VALUE_FIELDS[metric];
  const value = holding.manual?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function resolutionMetric(
  resolution: PortfolioHoldingResolution,
  metric: PortfolioMetricKey,
): ResolvedPortfolioMetric {
  return resolution[metric];
}

function isAllowedMetric(metric: PortfolioMetricKey, value: ResolvedPortfolioMetric): boolean {
  if (value.status === "resolved") return value.valuePct !== null && Number.isFinite(value.valuePct);
  return (
    (metric === "dividendYield" || metric === "dividendGrowth") &&
    value.status === "not_applicable" &&
    value.valuePct === 0
  );
}

function resolutionScore(
  resolution: PortfolioHoldingResolution,
  accountType: PortfolioAccountType,
): number {
  return requiredMetricKeys(accountType).reduce((score, metric) => {
    const resolved = resolutionMetric(resolution, metric);
    if (isAllowedMetric(metric, resolved)) return score + 10;
    if (resolved.status !== "not_applicable") return score + 1;
    return score;
  }, 0);
}

function selectResolution(
  candidates: PortfolioHoldingResolution[],
  accountType: PortfolioAccountType,
): PortfolioHoldingResolution {
  return candidates.reduce((best, candidate) => (
    resolutionScore(candidate, accountType) > resolutionScore(best, accountType) ? candidate : best
  ));
}

function uniqueWarnings(resolution: PortfolioHoldingResolution): string[] {
  return Array.from(new Set([
    ...resolution.totalReturnCagr.warnings,
    ...resolution.priceCagr.warnings,
    ...resolution.dividendYield.warnings,
    ...resolution.dividendGrowth.warnings,
  ].filter(Boolean)));
}

function buildManualHolding(holding: PortfolioHoldingInput): AppliedPortfolioHoldingAssumption {
  const sources: Record<PortfolioMetricKey, PortfolioMetricSource> = {
    totalReturnCagr: "manual",
    priceCagr: "manual",
    dividendYield: "manual",
    dividendGrowth: "manual",
  };
  const statuses: Record<PortfolioMetricKey, PortfolioMetricStatus> = {
    totalReturnCagr: "manual",
    priceCagr: "manual",
    dividendYield: "manual",
    dividendGrowth: "manual",
  };
  return {
    holdingId: holding.id,
    ticker: normalizePortfolioTicker(holding.ticker),
    weightPct: holding.weightPct,
    metricMode: "manual",
    totalReturnCagrPct: manualMetricValue(holding, "totalReturnCagr"),
    priceCagrPct: manualMetricValue(holding, "priceCagr"),
    dividendYieldPct: manualMetricValue(holding, "dividendYield"),
    dividendGrowthPct: manualMetricValue(holding, "dividendGrowth"),
    sources,
    statuses,
    warnings: [],
  };
}

function buildAutoHolding(
  holding: PortfolioHoldingInput,
  resolution: PortfolioHoldingResolution,
): AppliedPortfolioHoldingAssumption {
  return {
    holdingId: holding.id,
    ticker: normalizePortfolioTicker(holding.ticker),
    weightPct: holding.weightPct,
    metricMode: "auto",
    totalReturnCagrPct: resolution.totalReturnCagr.valuePct,
    priceCagrPct: resolution.priceCagr.valuePct,
    dividendYieldPct: resolution.dividendYield.valuePct,
    dividendGrowthPct: resolution.dividendGrowth.valuePct,
    sources: {
      totalReturnCagr: resolution.totalReturnCagr.source,
      priceCagr: resolution.priceCagr.source,
      dividendYield: resolution.dividendYield.source,
      dividendGrowth: resolution.dividendGrowth.source,
    },
    statuses: {
      totalReturnCagr: resolution.totalReturnCagr.status,
      priceCagr: resolution.priceCagr.status,
      dividendYield: resolution.dividendYield.status,
      dividendGrowth: resolution.dividendGrowth.status,
    },
    warnings: uniqueWarnings(resolution),
  };
}

function unresolvedMetricIssue(
  accountType: PortfolioAccountType,
  holding: PortfolioHoldingInput,
  metric: PortfolioMetricKey,
  resolved: ResolvedPortfolioMetric,
): PortfolioValidationIssue {
  const valueMissing = resolved.status === "resolved" && (
    resolved.valuePct === null || !Number.isFinite(resolved.valuePct)
  );
  return {
    accountType,
    holdingId: holding.id,
    field: "metrics",
    metric,
    code: valueMissing ? "assumption_incomplete" : "metric_unresolved",
    message: valueMissing
      ? `${normalizePortfolioTicker(holding.ticker)} ${metric} 적용값이 없습니다.`
      : `${normalizePortfolioTicker(holding.ticker)} ${metric} 상태(${resolved.status})는 적용할 수 없습니다.`,
  };
}

function buildAccountAssumptions(
  accountType: PortfolioAccountType,
  config: AssetSimulatorPortfolioConfigV1,
  resolutionsByTicker: Map<string, PortfolioHoldingResolution[]>,
  issues: PortfolioValidationIssue[],
): AppliedAccountPortfolioAssumptions {
  const holdings = config[accountType].holdings.map((holding) => {
    if (holding.metricMode === "manual") return buildManualHolding(holding);

    const ticker = normalizePortfolioTicker(holding.ticker);
    const candidates = resolutionsByTicker.get(ticker) ?? [];
    if (candidates.length === 0) {
      issues.push({
        accountType,
        holdingId: holding.id,
        field: "metrics",
        code: "resolution_missing",
        message: `${ticker} resolver 결과가 없습니다.`,
      });
      return null;
    }

    const resolution = selectResolution(candidates, accountType);
    for (const metric of requiredMetricKeys(accountType)) {
      const resolved = resolutionMetric(resolution, metric);
      if (!isAllowedMetric(metric, resolved)) {
        issues.push(unresolvedMetricIssue(accountType, holding, metric, resolved));
      }
    }
    return buildAutoHolding(holding, resolution);
  }).filter((holding): holding is AppliedPortfolioHoldingAssumption => holding !== null);

  return { accountType, holdings };
}

export function buildAppliedPortfolioAssumptions(
  config: AssetSimulatorPortfolioConfigV1,
  resolutions: PortfolioHoldingResolution[],
  now = new Date(),
): { assumptions: AppliedPortfolioAssumptionsV1 | null; issues: PortfolioValidationIssue[] } {
  const issues = validatePortfolioConfig(config);
  if (issues.length > 0) return { assumptions: null, issues };

  const resolutionsByTicker = new Map<string, PortfolioHoldingResolution[]>();
  for (const resolution of resolutions) {
    const ticker = normalizePortfolioTicker(resolution.ticker);
    if (!ticker) continue;
    const existing = resolutionsByTicker.get(ticker) ?? [];
    existing.push(resolution);
    resolutionsByTicker.set(ticker, existing);
  }

  const taxSaving = buildAccountAssumptions("taxSaving", config, resolutionsByTicker, issues);
  const brokerage = buildAccountAssumptions("brokerage", config, resolutionsByTicker, issues);
  if (issues.length > 0) return { assumptions: null, issues };

  return {
    assumptions: {
      version: 1,
      appliedAt: now.toISOString(),
      taxSaving,
      brokerage,
    },
    issues,
  };
}

export function isPortfolioAssumptionsStale(
  assumptions: AppliedPortfolioAssumptionsV1,
  now = new Date(),
): boolean {
  const appliedAtMs = Date.parse(assumptions.appliedAt);
  if (!Number.isFinite(appliedAtMs)) return true;
  return now.getTime() - appliedAtMs > STALE_AFTER_MS;
}

function manualValuesMatch(
  accountType: PortfolioAccountType,
  configHolding: PortfolioHoldingInput,
  appliedHolding: AppliedPortfolioHoldingAssumption,
): boolean {
  return requiredMetricKeys(accountType).every((metric) => {
    const appliedField = METRIC_VALUE_FIELDS[metric];
    return manualMetricValue(configHolding, metric) === appliedHolding[appliedField];
  });
}

export function doPortfolioAssumptionsMatchConfig(
  config: AssetSimulatorPortfolioConfigV1,
  assumptions: AppliedPortfolioAssumptionsV1,
): boolean {
  if (config.version !== 1 || assumptions.version !== 1) return false;
  return ACCOUNT_TYPES.every((accountType) => {
    const configHoldings = config[accountType].holdings;
    const appliedAccount = assumptions[accountType];
    if (appliedAccount.accountType !== accountType || configHoldings.length !== appliedAccount.holdings.length) {
      return false;
    }
    const appliedById = new Map(appliedAccount.holdings.map((holding) => [holding.holdingId, holding]));
    if (appliedById.size !== appliedAccount.holdings.length) return false;
    return configHoldings.every((holding) => {
      const applied = appliedById.get(holding.id);
      if (!applied) return false;
      if (
        normalizePortfolioTicker(holding.ticker) !== normalizePortfolioTicker(applied.ticker) ||
        holding.weightPct !== applied.weightPct ||
        holding.metricMode !== applied.metricMode
      ) {
        return false;
      }
      return holding.metricMode !== "manual" || manualValuesMatch(accountType, holding, applied);
    });
  });
}
