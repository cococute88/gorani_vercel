import type {
  AccountPortfolioConfig,
  AssetSimulatorPortfolioConfigV1,
  PortfolioAccountType,
  PortfolioAssumptionsSnapshot,
  PortfolioHoldingInput,
  PortfolioHoldingResolution,
  PortfolioManualMetrics,
  PortfolioMetricSource,
  PortfolioMetricStatus,
  PortfolioValidationIssue,
  ResolvedPortfolioMetric,
} from "./asset-simulator-types";

const ACCOUNT_TYPES: PortfolioAccountType[] = ["taxSaving", "brokerage"];
const METRIC_SOURCES: PortfolioMetricSource[] = ["yahoo-adj-close", "yahoo-close", "yahoo-dividends", "manual", "legacy"];
const METRIC_STATUSES: PortfolioMetricStatus[] = ["resolved", "manual", "insufficient_history", "not_applicable", "failed"];
const WEIGHT_BASIS_POINTS = 100;
const TOTAL_WEIGHT_BASIS_POINTS = 100 * WEIGHT_BASIS_POINTS;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function nullableFiniteNumber(value: unknown): number | null {
  return finiteNumber(value) ?? null;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function normalizePortfolioTicker(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\$/g, "").replace(/\s+/g, "").toUpperCase();
}

function normalizeManualMetrics(value: unknown): PortfolioManualMetrics | undefined {
  if (!isRecord(value)) return undefined;
  const manual: PortfolioManualMetrics = {};
  const totalReturnCagrPct = finiteNumber(value.totalReturnCagrPct);
  const priceCagrPct = finiteNumber(value.priceCagrPct);
  const dividendYieldPct = finiteNumber(value.dividendYieldPct);
  const dividendGrowthPct = finiteNumber(value.dividendGrowthPct);
  if (totalReturnCagrPct !== undefined) manual.totalReturnCagrPct = totalReturnCagrPct;
  if (priceCagrPct !== undefined) manual.priceCagrPct = priceCagrPct;
  if (dividendYieldPct !== undefined) manual.dividendYieldPct = dividendYieldPct;
  if (dividendGrowthPct !== undefined) manual.dividendGrowthPct = dividendGrowthPct;
  return Object.keys(manual).length > 0 ? manual : undefined;
}

function normalizeHolding(value: unknown, index: number): PortfolioHoldingInput {
  const holding = isRecord(value) ? value : {};
  const manual = normalizeManualMetrics(holding.manual);
  return {
    id: typeof holding.id === "string" ? holding.id : `holding-${index + 1}`,
    ticker: normalizePortfolioTicker(holding.ticker),
    weightPct: finiteNumber(holding.weightPct) ?? 0,
    metricMode: holding.metricMode === "manual" ? "manual" : "auto",
    ...(manual ? { manual } : {}),
  };
}

function normalizeAccount(value: unknown, accountType: PortfolioAccountType): AccountPortfolioConfig {
  const account = isRecord(value) ? value : {};
  const holdings = Array.isArray(account.holdings) ? account.holdings.map(normalizeHolding) : [];
  return { accountType, holdings };
}

export function normalizePortfolioConfig(raw: unknown): AssetSimulatorPortfolioConfigV1 | null {
  if (!isRecord(raw) || raw.version !== 1) return null;
  return {
    version: 1,
    taxSaving: normalizeAccount(raw.taxSaving, "taxSaving"),
    brokerage: normalizeAccount(raw.brokerage, "brokerage"),
  };
}

function requiredManualMetricKeys(accountType: PortfolioAccountType): (keyof PortfolioManualMetrics)[] {
  return accountType === "taxSaving"
    ? ["totalReturnCagrPct"]
    : ["priceCagrPct", "dividendYieldPct", "dividendGrowthPct"];
}

export function validatePortfolioConfig(config: AssetSimulatorPortfolioConfigV1): PortfolioValidationIssue[] {
  if (!isRecord(config) || config.version !== 1) {
    return [{ accountType: "taxSaving", code: "unknown_version", message: "지원하지 않는 포트폴리오 설정 버전입니다." }];
  }

  const issues: PortfolioValidationIssue[] = [];
  for (const accountType of ACCOUNT_TYPES) {
    const account = config[accountType];
    if (!isRecord(account) || account.accountType !== accountType) {
      issues.push({ accountType, code: "account_type_mismatch", message: `${accountType} 계좌 유형이 저장 위치와 일치하지 않습니다.` });
    }
    const holdings = Array.isArray(account?.holdings) ? account.holdings : [];
    const seenTickers = new Set<string>();
    let totalBasisPoints = 0;

    for (const holding of holdings) {
      const ticker = normalizePortfolioTicker(holding?.ticker);
      if (!ticker) {
        issues.push({ accountType, holdingId: holding?.id, field: "ticker", code: "ticker_required", message: "티커를 입력해야 합니다." });
      } else if (seenTickers.has(ticker)) {
        issues.push({ accountType, holdingId: holding?.id, field: "ticker", code: "duplicate_ticker", message: `계좌 안에 중복 티커(${ticker})가 있습니다.` });
      } else {
        seenTickers.add(ticker);
      }

      if (!Number.isFinite(holding?.weightPct) || holding.weightPct <= 0 || holding.weightPct > 100) {
        issues.push({ accountType, holdingId: holding?.id, field: "weightPct", code: "invalid_weight", message: "비중은 0보다 크고 100 이하여야 합니다." });
      } else {
        totalBasisPoints += Math.round(holding.weightPct * WEIGHT_BASIS_POINTS);
      }

      if (holding?.metricMode === "manual") {
        const missing = requiredManualMetricKeys(accountType).filter((key) => !Number.isFinite(holding.manual?.[key]));
        if (missing.length > 0) {
          issues.push({ accountType, holdingId: holding.id, field: "metrics", code: "manual_metric_required", message: `수동 모드 필수 값이 없습니다: ${missing.join(", ")}` });
        }
      }
    }

    if (totalBasisPoints !== TOTAL_WEIGHT_BASIS_POINTS) {
      issues.push({ accountType, field: "weightPct", code: "weight_total_not_100", message: "계좌별 비중 합계는 100%여야 합니다." });
    }
  }
  return issues;
}

export function buildDefaultPortfolioConfig(): AssetSimulatorPortfolioConfigV1 {
  return {
    version: 1,
    taxSaving: {
      accountType: "taxSaving",
      holdings: [
        { id: "tax-saving-schd", ticker: "SCHD", weightPct: 50, metricMode: "auto" },
        { id: "tax-saving-qld", ticker: "QLD", weightPct: 50, metricMode: "auto" },
      ],
    },
    brokerage: {
      accountType: "brokerage",
      holdings: [
        { id: "brokerage-schd", ticker: "SCHD", weightPct: 70, metricMode: "auto" },
        { id: "brokerage-jepq", ticker: "JEPQ", weightPct: 30, metricMode: "auto" },
      ],
    },
  };
}

function normalizeResolvedMetric(value: unknown): ResolvedPortfolioMetric {
  const metric = isRecord(value) ? value : {};
  return {
    valuePct: nullableFiniteNumber(metric.valuePct),
    source: typeof metric.source === "string" && METRIC_SOURCES.includes(metric.source as PortfolioMetricSource)
      ? metric.source as PortfolioMetricSource
      : "legacy",
    status: typeof metric.status === "string" && METRIC_STATUSES.includes(metric.status as PortfolioMetricStatus)
      ? metric.status as PortfolioMetricStatus
      : "failed",
    asOf: nullableString(metric.asOf),
    periodStart: nullableString(metric.periodStart),
    periodEnd: nullableString(metric.periodEnd),
    observationYears: nullableFiniteNumber(metric.observationYears),
    warnings: Array.isArray(metric.warnings) ? metric.warnings.filter((warning): warning is string => typeof warning === "string") : [],
  };
}

function normalizeHoldingResolution(value: unknown): PortfolioHoldingResolution {
  const holding = isRecord(value) ? value : {};
  return {
    ticker: normalizePortfolioTicker(holding.ticker),
    totalReturnCagr: normalizeResolvedMetric(holding.totalReturnCagr),
    priceCagr: normalizeResolvedMetric(holding.priceCagr),
    dividendYield: normalizeResolvedMetric(holding.dividendYield),
    dividendGrowth: normalizeResolvedMetric(holding.dividendGrowth),
  };
}

export function normalizePortfolioAssumptions(raw: unknown): PortfolioAssumptionsSnapshot | null {
  if (!isRecord(raw) || typeof raw.resolvedAt !== "string" || !Array.isArray(raw.holdings)) return null;
  return {
    resolvedAt: raw.resolvedAt,
    holdings: raw.holdings.map(normalizeHoldingResolution),
  };
}
