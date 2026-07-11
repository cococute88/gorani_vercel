import assert from "node:assert/strict";

import { calculateAssetSimulatorPreview } from "../lib/asset-simulator.ts";
import {
  resolvePortfolioHoldingMetrics,
  type PortfolioResolverSeries,
} from "../lib/asset-simulator-portfolio-resolver.ts";
import {
  buildDefaultPortfolioConfig,
  validatePortfolioConfig,
} from "../lib/asset-simulator-portfolio.ts";
import { buildDefaultYearPlans, DEFAULT_SIMULATOR_INPUTS } from "../lib/mock-asset-simulator-data.ts";
import type { PortfolioHoldingResolution } from "../lib/asset-simulator-types.ts";

function buildPoints(startYear: number, endYear: number, closeGrowth: number, adjGrowth: number) {
  return Array.from({ length: endYear - startYear + 1 }, (_, index) => ({
    date: `${startYear + index}-07-01`,
    close: Number((100 * Math.pow(1 + closeGrowth, index)).toFixed(6)),
    adjClose: Number((100 * Math.pow(1 + adjGrowth, index)).toFixed(6)),
  }));
}

function buildQuarterlyDividends(startYear: number, endYear: number, annualGrowth: number) {
  return Array.from({ length: endYear - startYear + 1 }, (_, yearIndex) => {
    const annualAmount = 4 * Math.pow(1 + annualGrowth, yearIndex);
    return ["03-15", "06-15", "09-15", "12-15"].map((monthDay) => ({
      date: `${startYear + yearIndex}-${monthDay}`,
      amount: Number((annualAmount / 4).toFixed(6)),
    }));
  }).flat();
}

function yahooSeries(
  symbol: string,
  points: PortfolioResolverSeries["points"],
  dividends: PortfolioResolverSeries["dividends"],
): PortfolioResolverSeries {
  return {
    symbol,
    source: "yahoo",
    updatedAt: "2026-07-01T00:00:00.000Z",
    points,
    dividends,
    warnings: [],
  };
}

const schdSeries = yahooSeries(
  "SCHD",
  buildPoints(2014, 2026, 0.05, 0.09),
  buildQuarterlyDividends(2021, 2026, 0.08),
);

const schdTaxSaving = resolvePortfolioHoldingMetrics(
  { ticker: " $schd ", accountType: "taxSaving" },
  schdSeries,
);
const schdBrokerage = resolvePortfolioHoldingMetrics(
  { ticker: "SCHD", accountType: "brokerage" },
  schdSeries,
);

assert.equal(schdTaxSaving.ticker, "SCHD", "PR181 티커 정규화를 재사용");
assert.equal(schdTaxSaving.totalReturnCagr.status, "resolved", "SCHD total-return CAGR 성공");
assert.equal(schdTaxSaving.totalReturnCagr.source, "yahoo-adj-close", "totalReturnCagr는 adjClose 기반");
assert.equal(schdBrokerage.priceCagr.status, "resolved", "SCHD price CAGR 성공");
assert.equal(schdBrokerage.priceCagr.source, "yahoo-close", "priceCagr는 close 기반");
assert.notEqual(schdTaxSaving.totalReturnCagr.valuePct, schdBrokerage.priceCagr.valuePct, "total-return과 price CAGR 분리");
assert.ok((schdTaxSaving.totalReturnCagr.observationYears ?? 0) >= 9.9, "10년 observationYears 기록");
assert.ok(schdTaxSaving.totalReturnCagr.periodStart, "CAGR periodStart 기록");
assert.equal(schdTaxSaving.totalReturnCagr.periodEnd, "2026-07-01", "CAGR periodEnd 기록");
assert.equal(schdTaxSaving.priceCagr.status, "not_applicable", "절세계좌 가격 CAGR은 비적용");
assert.equal(schdBrokerage.totalReturnCagr.status, "not_applicable", "위탁계좌 total-return CAGR은 비적용");

const ttmExpected = schdSeries.dividends
  .filter((row) => row.date >= "2025-07-01" && row.date <= "2026-07-01")
  .reduce((sum, row) => sum + row.amount, 0);
const latestClose = schdSeries.points[schdSeries.points.length - 1].close;
assert.equal(
  schdBrokerage.dividendYield.valuePct,
  Number(((ttmExpected / latestClose) * 100).toFixed(4)),
  "최근 365일 배당금 / 최신 close로 TTM 배당률 계산",
);
assert.equal(schdBrokerage.dividendYield.periodStart, "2025-07-01", "TTM 시작일 기록");
assert.equal(schdBrokerage.dividendYield.asOf, "2026-07-01", "TTM asOf 기록");
assert.equal(schdBrokerage.dividendGrowth.status, "resolved", "SCHD 배당성장률 성공");
assert.equal(schdBrokerage.dividendGrowth.periodStart, "2021-01-01", "5개 완전연도 시작 기록");
assert.equal(schdBrokerage.dividendGrowth.periodEnd, "2025-12-31", "현재 미완전연도 제외");
assert.equal(schdBrokerage.dividendGrowth.observationYears, 4, "완전연도 CAGR 관측 간격 기록");
assert.ok(schdBrokerage.dividendGrowth.warnings.some((warning) => warning.includes("특별배당")), "배당성장률 한계 warning");

const qld = resolvePortfolioHoldingMetrics(
  { ticker: "qld", accountType: "taxSaving" },
  yahooSeries("QLD", buildPoints(2014, 2026, 0.1, 0.14), buildQuarterlyDividends(2021, 2026, 0.05)),
);
assert.equal(qld.totalReturnCagr.status, "resolved", "QLD resolver 성공");
assert.ok(qld.totalReturnCagr.warnings.some((warning) => warning.includes("레버리지 ETF")), "QLD 레버리지 warning");

const jepq = resolvePortfolioHoldingMetrics(
  { ticker: "JEPQ", accountType: "brokerage" },
  yahooSeries("JEPQ", buildPoints(2022, 2026, 0.04, 0.1), buildQuarterlyDividends(2022, 2026, 0.03)),
);
assert.equal(jepq.priceCagr.status, "insufficient_history", "JEPQ 짧은 가격 이력 처리");
assert.ok(jepq.priceCagr.warnings.some((warning) => warning.includes("수동 fallback")), "JEPQ 수동 fallback warning");
assert.equal(jepq.dividendGrowth.status, "resolved", "JEPQ는 3개 완전연도 fallback으로 배당성장률 계산");
assert.ok(jepq.dividendGrowth.warnings.some((warning) => warning.includes("3개 완전연도")), "3개 완전연도 fallback warning");

const sinceInception = resolvePortfolioHoldingMetrics(
  { ticker: "MID", accountType: "taxSaving" },
  yahooSeries("MID", buildPoints(2019, 2026, 0.05, 0.07), []),
);
assert.equal(sinceInception.totalReturnCagr.status, "resolved", "5년 이상 10년 미만은 상장 이후 CAGR 계산");
assert.ok(sinceInception.totalReturnCagr.warnings.some((warning) => warning.includes("상장 이후")), "10년 미만 warning");

const invalidTicker = resolvePortfolioHoldingMetrics(
  { ticker: " $ ", accountType: "brokerage" },
  schdSeries,
);
assert.equal(invalidTicker.ticker, "", "빈 티커 정규화");
assert.ok(Object.values(invalidTicker).filter((value) => typeof value === "object").every((value) => value.status === "failed"), "빈 티커 metric 전체 failed");

const noDividend = resolvePortfolioHoldingMetrics(
  { ticker: "BRK-B", accountType: "brokerage" },
  yahooSeries("BRK-B", buildPoints(2014, 2026, 0.08, 0.08), []),
);
assert.equal(noDividend.dividendYield.status, "not_applicable", "무배당 TTM yield 비적용");
assert.equal(noDividend.dividendYield.valuePct, 0, "무배당 TTM yield 0");
assert.equal(noDividend.dividendGrowth.status, "not_applicable", "무배당 growth 비적용");
assert.equal(noDividend.dividendGrowth.valuePct, 0, "무배당 growth 0");

const shortDividendHistory = resolvePortfolioHoldingMetrics(
  { ticker: "NEW", accountType: "brokerage" },
  yahooSeries("NEW", buildPoints(2014, 2026, 0.04, 0.05), buildQuarterlyDividends(2024, 2026, 0.05)),
);
assert.equal(shortDividendHistory.dividendGrowth.status, "insufficient_history", "3개 미만 완전연도는 배당성장 이력 부족");

const providerFailure = resolvePortfolioHoldingMetrics(
  { ticker: "BAD", accountType: "taxSaving" },
  { ...yahooSeries("BAD", [], []), source: "empty", warnings: ["provider error"] },
);
assert.equal(providerFailure.totalReturnCagr.status, "failed", "provider 실패 구분");
assert.equal(providerFailure.dividendYield.status, "failed", "provider 실패를 무배당으로 오인하지 않음");

const sampleFailure = resolvePortfolioHoldingMetrics(
  { ticker: "SCHD", accountType: "taxSaving" },
  { ...schdSeries, source: "sample" },
);
assert.equal(sampleFailure.totalReturnCagr.status, "failed", "sample fallback 성공 처리 거부");
assert.ok(sampleFailure.totalReturnCagr.warnings.some((warning) => warning.includes("sample fallback")), "sample 거부 사유 기록");

const missingAdjClose = resolvePortfolioHoldingMetrics(
  { ticker: "SCHD", accountType: "taxSaving" },
  yahooSeries("SCHD", buildPoints(2014, 2026, 0.05, 0.09).map((point) => ({ ...point, adjClose: null })), []),
);
assert.equal(missingAdjClose.totalReturnCagr.status, "failed", "adjClose 없는 total-return CAGR 실패");

const typedResolution: PortfolioHoldingResolution = schdBrokerage;
assert.deepEqual(JSON.parse(JSON.stringify(typedResolution)), typedResolution, "resolver 출력 JSON 직렬화 가능");
assert.deepEqual(validatePortfolioConfig(buildDefaultPortfolioConfig()), [], "기존 portfolio config 타입/검증 호환");

const plans = buildDefaultYearPlans(DEFAULT_SIMULATOR_INPUTS.startYear, DEFAULT_SIMULATOR_INPUTS.years);
const projectionBefore = calculateAssetSimulatorPreview(DEFAULT_SIMULATOR_INPUTS, plans);
resolvePortfolioHoldingMetrics({ ticker: "BAD", accountType: "brokerage" }, { ...schdSeries, source: "empty" });
const projectionAfter = calculateAssetSimulatorPreview(DEFAULT_SIMULATOR_INPUTS, plans);
assert.deepEqual(projectionAfter, projectionBefore, "resolver 실패가 기존 projection/golden 계산에 영향 없음");

console.log("asset simulator portfolio resolver checks passed");
