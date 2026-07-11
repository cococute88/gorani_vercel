import assert from "node:assert/strict";

import { calculateAssetSimulatorPreview } from "../lib/asset-simulator.ts";
import {
  buildAppliedPortfolioAssumptions,
  doPortfolioAssumptionsMatchConfig,
  isPortfolioAssumptionsStale,
} from "../lib/asset-simulator-portfolio-assumptions.ts";
import {
  buildFirestoreSimulatorConfigPayload,
  buildStoredSimulatorConfig,
  findFirestoreUnsafePaths,
  normalizePersistedSimulatorConfig,
} from "../lib/asset-simulator-persistence.ts";
import { buildDefaultYearPlans, DEFAULT_SIMULATOR_INPUTS } from "../lib/mock-asset-simulator-data.ts";
import type {
  AppliedPortfolioAssumptionsV1,
  AssetSimulatorPortfolioConfigV1,
  PortfolioHoldingResolution,
  PortfolioMetricSource,
  PortfolioMetricStatus,
  ResolvedPortfolioMetric,
} from "../lib/asset-simulator-types.ts";

const NOW = new Date("2026-07-12T00:00:00.000Z");

function metric(
  valuePct: number | null,
  status: PortfolioMetricStatus = "resolved",
  source: PortfolioMetricSource = "yahoo-close",
  warnings: string[] = [],
): ResolvedPortfolioMetric {
  return {
    valuePct,
    source,
    status,
    asOf: "2026-07-11",
    periodStart: "2016-07-11",
    periodEnd: "2026-07-11",
    observationYears: 10,
    warnings,
  };
}

function taxResolution(ticker: string, overrides: Partial<PortfolioHoldingResolution> = {}): PortfolioHoldingResolution {
  return {
    ticker,
    totalReturnCagr: metric(8, "resolved", "yahoo-adj-close", ["tax warning"]),
    priceCagr: metric(null, "not_applicable", "yahoo-close"),
    dividendYield: metric(null, "not_applicable", "yahoo-dividends"),
    dividendGrowth: metric(null, "not_applicable", "yahoo-dividends"),
    ...overrides,
  };
}

function brokerageResolution(ticker: string, overrides: Partial<PortfolioHoldingResolution> = {}): PortfolioHoldingResolution {
  return {
    ticker,
    totalReturnCagr: metric(null, "not_applicable", "yahoo-adj-close"),
    priceCagr: metric(5, "resolved", "yahoo-close", ["brokerage warning"]),
    dividendYield: metric(4, "resolved", "yahoo-dividends"),
    dividendGrowth: metric(3, "resolved", "yahoo-dividends"),
    ...overrides,
  };
}

function manualConfig(): AssetSimulatorPortfolioConfigV1 {
  return {
    version: 1,
    taxSaving: {
      accountType: "taxSaving",
      holdings: [{
        id: "tax-manual",
        ticker: " qld ",
        weightPct: 100,
        metricMode: "manual",
        manual: { totalReturnCagrPct: 7.5 },
      }],
    },
    brokerage: {
      accountType: "brokerage",
      holdings: [{
        id: "broker-manual",
        ticker: "$jepq",
        weightPct: 100,
        metricMode: "manual",
        manual: { priceCagrPct: 4.5, dividendYieldPct: 8, dividendGrowthPct: 2.5 },
      }],
    },
  };
}

function autoConfig(ticker = " $schd "): AssetSimulatorPortfolioConfigV1 {
  return {
    version: 1,
    taxSaving: {
      accountType: "taxSaving",
      holdings: [{ id: "tax-auto", ticker, weightPct: 100, metricMode: "auto" }],
    },
    brokerage: {
      accountType: "brokerage",
      holdings: [{ id: "broker-auto", ticker, weightPct: 100, metricMode: "auto" }],
    },
  };
}

function requireAssumptions(value: AppliedPortfolioAssumptionsV1 | null): AppliedPortfolioAssumptionsV1 {
  assert.ok(value, "assumptions가 생성되어야 함");
  return value;
}

const manualResult = buildAppliedPortfolioAssumptions(manualConfig(), [], NOW);
assert.deepEqual(manualResult.issues, [], "manual mode는 resolver 없이 적용 가능");
const manual = requireAssumptions(manualResult.assumptions);
assert.equal(manual.appliedAt, NOW.toISOString(), "주입한 now로 appliedAt 결정");
assert.equal(manual.taxSaving.holdings[0].ticker, "QLD", "manual 절세계좌 티커 정규화");
assert.equal(manual.taxSaving.holdings[0].totalReturnCagrPct, 7.5, "manual 절세계좌 total return 적용");
assert.equal(manual.brokerage.holdings[0].priceCagrPct, 4.5, "manual 위탁 price CAGR 적용");
assert.equal(manual.brokerage.holdings[0].dividendYieldPct, 8, "manual 위탁 dividend yield 적용");
assert.equal(manual.brokerage.holdings[0].dividendGrowthPct, 2.5, "manual 위탁 dividend growth 적용");
assert.ok(Object.values(manual.taxSaving.holdings[0].sources).every((source) => source === "manual"), "manual source 기록");
assert.ok(Object.values(manual.taxSaving.holdings[0].statuses).every((status) => status === "manual"), "manual status 기록");

const duplicateAccountTicker = manualConfig();
duplicateAccountTicker.taxSaving.holdings = [
  ...duplicateAccountTicker.taxSaving.holdings.map((holding) => ({ ...holding, weightPct: 50 })),
  { id: "tax-duplicate", ticker: "$QLD", weightPct: 50, metricMode: "manual", manual: { totalReturnCagrPct: 6 } },
];
assert.ok(
  buildAppliedPortfolioAssumptions(duplicateAccountTicker, [], NOW).issues.some((issue) => issue.code === "duplicate_ticker"),
  "계좌 내 정규화 중복 티커는 assumptions 생성 전에 차단",
);

const resolutions = [
  brokerageResolution("schd"),
  taxResolution("$SCHD"),
];
const autoResult = buildAppliedPortfolioAssumptions(autoConfig(), resolutions, NOW);
assert.deepEqual(autoResult.issues, [], "auto resolved metric 적용");
const auto = requireAssumptions(autoResult.assumptions);
assert.equal(auto.taxSaving.holdings[0].totalReturnCagrPct, 8, "중복 resolution ticker 중 절세계좌 결과 선택");
assert.equal(auto.brokerage.holdings[0].priceCagrPct, 5, "중복 resolution ticker 중 위탁계좌 결과 선택");
assert.equal(auto.brokerage.holdings[0].sources.dividendYield, "yahoo-dividends", "resolver source 보존");
assert.equal(auto.brokerage.holdings[0].statuses.priceCagr, "resolved", "resolver status 보존");
assert.ok(auto.taxSaving.holdings[0].warnings.includes("tax warning"), "resolver warning 보존");

const missing = buildAppliedPortfolioAssumptions(autoConfig("MISSING"), [], NOW);
assert.equal(missing.assumptions, null, "resolver missing이면 snapshot 생성 차단");
assert.equal(missing.issues.filter((issue) => issue.code === "resolution_missing").length, 2, "계좌별 resolution missing issue");

const insufficient = buildAppliedPortfolioAssumptions(autoConfig(), [
  taxResolution("SCHD", { totalReturnCagr: metric(null, "insufficient_history", "yahoo-adj-close") }),
  brokerageResolution("SCHD", { dividendGrowth: metric(null, "insufficient_history", "yahoo-dividends") }),
], NOW);
assert.equal(insufficient.assumptions, null, "insufficient history는 적용 차단");
assert.ok(insufficient.issues.some((issue) => issue.metric === "totalReturnCagr" && issue.code === "metric_unresolved"), "절세계좌 history issue");
assert.ok(insufficient.issues.some((issue) => issue.metric === "dividendGrowth" && issue.code === "metric_unresolved"), "배당 ETF history 부족도 issue 정책");

const failed = buildAppliedPortfolioAssumptions(autoConfig(), [
  taxResolution("SCHD"),
  brokerageResolution("SCHD", { priceCagr: metric(null, "failed", "yahoo-close") }),
], NOW);
assert.ok(failed.issues.some((issue) => issue.metric === "priceCagr" && issue.code === "metric_unresolved"), "failed metric issue");

const incomplete = buildAppliedPortfolioAssumptions(autoConfig(), [
  taxResolution("SCHD", { totalReturnCagr: metric(null, "resolved", "yahoo-adj-close") }),
  brokerageResolution("SCHD"),
], NOW);
assert.ok(incomplete.issues.some((issue) => issue.code === "assumption_incomplete"), "resolved status의 null 필수값 issue");

const noDividendConfig = autoConfig("BRK-B");
const noDividend = buildAppliedPortfolioAssumptions(noDividendConfig, [
  taxResolution("BRK-B"),
  brokerageResolution("BRK-B", {
    dividendYield: metric(0, "not_applicable", "yahoo-dividends", ["무배당 자산"]),
    dividendGrowth: metric(0, "not_applicable", "yahoo-dividends", ["무배당 자산"]),
  }),
], NOW);
assert.deepEqual(noDividend.issues, [], "무배당 dividend metric의 not_applicable 0 허용");
assert.equal(noDividend.assumptions?.brokerage.holdings[0].dividendYieldPct, 0, "무배당 yield 0 적용");
assert.equal(noDividend.assumptions?.brokerage.holdings[0].dividendGrowthPct, 0, "무배당 growth 0 적용");

const disallowedNotApplicable = buildAppliedPortfolioAssumptions(autoConfig(), [
  taxResolution("SCHD", { totalReturnCagr: metric(0, "not_applicable", "yahoo-adj-close") }),
  brokerageResolution("SCHD"),
], NOW);
assert.ok(disallowedNotApplicable.issues.some((issue) => issue.metric === "totalReturnCagr"), "필수 CAGR not_applicable 차단");

assert.equal(isPortfolioAssumptionsStale(auto, new Date("2026-07-19T00:00:00.000Z")), false, "정확히 7일은 stale 아님");
assert.equal(isPortfolioAssumptionsStale(auto, new Date("2026-07-19T00:00:00.001Z")), true, "7일 초과는 stale");
assert.equal(isPortfolioAssumptionsStale({ ...auto, appliedAt: "invalid" }, NOW), true, "잘못된 appliedAt은 stale");

assert.equal(doPortfolioAssumptionsMatchConfig(autoConfig(), auto), true, "동일 config는 applied snapshot과 일치");
const mismatchCases: AssetSimulatorPortfolioConfigV1[] = [];
const changedTicker = structuredClone(autoConfig());
changedTicker.taxSaving.holdings[0].ticker = "QLD";
mismatchCases.push(changedTicker);
const changedWeight = structuredClone(autoConfig());
changedWeight.taxSaving.holdings[0].weightPct = 99;
mismatchCases.push(changedWeight);
const changedId = structuredClone(autoConfig());
changedId.taxSaving.holdings[0].id = "new-id";
mismatchCases.push(changedId);
const changedMode = structuredClone(autoConfig());
changedMode.taxSaving.holdings[0].metricMode = "manual";
changedMode.taxSaving.holdings[0].manual = { totalReturnCagrPct: 8 };
mismatchCases.push(changedMode);
const changedCount = structuredClone(autoConfig());
changedCount.taxSaving.holdings.push({ id: "extra", ticker: "QLD", weightPct: 1, metricMode: "auto" });
mismatchCases.push(changedCount);
for (const config of mismatchCases) {
  assert.equal(doPortfolioAssumptionsMatchConfig(config, auto), false, "holding count/id/ticker/weight/mode 변경 감지");
}
assert.equal(doPortfolioAssumptionsMatchConfig(manualConfig(), manual), true, "동일 manual 값 일치");
const changedManual = manualConfig();
changedManual.brokerage.holdings[0].manual!.dividendYieldPct = 7.9;
assert.equal(doPortfolioAssumptionsMatchConfig(changedManual, manual), false, "manual 값 변경 감지");

const plans = buildDefaultYearPlans(DEFAULT_SIMULATOR_INPUTS.startYear, DEFAULT_SIMULATOR_INPUTS.years);
const stored = buildStoredSimulatorConfig(DEFAULT_SIMULATOR_INPUTS, plans, NOW.toISOString(), {
  portfolioConfig: autoConfig(),
  portfolioAssumptions: auto,
});
const localRoundTrip = normalizePersistedSimulatorConfig(JSON.parse(JSON.stringify(stored)), "local");
assert.deepEqual(localRoundTrip?.portfolioAssumptions, auto, "localStorage applied assumptions round-trip");
const firestorePayload = buildFirestoreSimulatorConfigPayload(stored);
assert.deepEqual(findFirestoreUnsafePaths(firestorePayload), [], "Firestore applied assumptions 직렬화 안전성");
const firestoreRoundTrip = normalizePersistedSimulatorConfig(firestorePayload, "cloud");
assert.deepEqual(firestoreRoundTrip?.portfolioAssumptions, auto, "Firestore applied assumptions round-trip");
assert.deepEqual(JSON.parse(JSON.stringify(auto)), auto, "applied assumptions JSON 직렬화 가능");

const projectionBefore = calculateAssetSimulatorPreview(DEFAULT_SIMULATOR_INPUTS, plans);
buildAppliedPortfolioAssumptions(autoConfig(), resolutions, NOW);
normalizePersistedSimulatorConfig(JSON.parse(JSON.stringify(stored)), "local");
const projectionAfter = calculateAssetSimulatorPreview(DEFAULT_SIMULATOR_INPUTS, plans);
assert.deepEqual(projectionAfter, projectionBefore, "apply/persistence가 기존 projection을 변경하지 않음");

console.log("asset simulator portfolio assumptions checks passed");
