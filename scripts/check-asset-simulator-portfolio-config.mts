import assert from "node:assert/strict";
import { calculateAssetSimulatorPreview } from "../lib/asset-simulator.ts";
import {
  buildFirestoreSimulatorConfigPayload,
  buildStoredSimulatorConfig,
  findFirestoreUnsafePaths,
  normalizePersistedSimulatorConfig,
} from "../lib/asset-simulator-persistence.ts";
import {
  buildDefaultPortfolioConfig,
  normalizePortfolioConfig,
  normalizePortfolioTicker,
  validatePortfolioConfig,
} from "../lib/asset-simulator-portfolio.ts";
import { buildDefaultYearPlans, DEFAULT_SIMULATOR_INPUTS } from "../lib/mock-asset-simulator-data.ts";
import type {
  AssetSimulatorPortfolioConfigV1,
  PortfolioAssumptionsSnapshot,
  ResolvedPortfolioMetric,
} from "../lib/asset-simulator-types.ts";

const issueCodes = (config: AssetSimulatorPortfolioConfigV1) => validatePortfolioConfig(config).map((issue) => issue.code);
const cloneConfig = (config: AssetSimulatorPortfolioConfigV1) => structuredClone(config);

assert.equal(normalizePortfolioTicker(" schd "), "SCHD", "앞뒤 공백과 대소문자를 정규화");
assert.equal(normalizePortfolioTicker("$jepq"), "JEPQ", "$ 접두어를 제거");
assert.equal(normalizePortfolioTicker(" 005930 . ks "), "005930.KS", "내부 불필요 공백을 제거");
assert.equal(normalizePortfolioTicker("   "), "", "빈 티커는 빈 문자열로 정규화");

const valid = buildDefaultPortfolioConfig();
assert.deepEqual(validatePortfolioConfig(valid), [], "기본 포트폴리오가 유효함");

const emptyTicker = cloneConfig(valid);
emptyTicker.taxSaving.holdings[0].ticker = " $ ";
assert.ok(issueCodes(emptyTicker).includes("ticker_required"), "빈 티커 오류");

const duplicateTicker = cloneConfig(valid);
duplicateTicker.taxSaving.holdings[1].ticker = " $schd ";
assert.ok(issueCodes(duplicateTicker).includes("duplicate_ticker"), "정규화 후 중복 티커 오류");

for (const invalidWeight of [Number.NaN, Infinity, 0, -1, 100.01]) {
  const config = cloneConfig(valid);
  config.taxSaving.holdings[0].weightPct = invalidWeight;
  assert.ok(issueCodes(config).includes("invalid_weight"), `잘못된 비중 오류: ${invalidWeight}`);
}

const wrongTotal = cloneConfig(valid);
wrongTotal.brokerage.holdings[0].weightPct = 69.9;
assert.ok(issueCodes(wrongTotal).includes("weight_total_not_100"), "비중 합계 100% 실패");

const decimalTotal = cloneConfig(valid);
decimalTotal.taxSaving.holdings = [
  { id: "a", ticker: "AAA", weightPct: 33.33, metricMode: "auto" },
  { id: "b", ticker: "BBB", weightPct: 33.33, metricMode: "auto" },
  { id: "c", ticker: "CCC", weightPct: 33.34, metricMode: "auto" },
];
assert.deepEqual(validatePortfolioConfig(decimalTotal), [], "basis point 기준 소수 비중 합계 허용");

const manualMissing = cloneConfig(valid);
manualMissing.taxSaving.holdings[0].metricMode = "manual";
manualMissing.taxSaving.holdings[0].manual = {};
manualMissing.brokerage.holdings[0].metricMode = "manual";
manualMissing.brokerage.holdings[0].manual = { priceCagrPct: 5, dividendYieldPct: 4 };
assert.equal(issueCodes(manualMissing).filter((code) => code === "manual_metric_required").length, 2, "계좌별 수동 필수 metric 검증");

const manualValid = cloneConfig(valid);
manualValid.taxSaving.holdings[0] = {
  ...manualValid.taxSaving.holdings[0],
  metricMode: "manual",
  manual: { totalReturnCagrPct: 7 },
};
manualValid.brokerage.holdings[0] = {
  ...manualValid.brokerage.holdings[0],
  metricMode: "manual",
  manual: { priceCagrPct: 5, dividendYieldPct: 4, dividendGrowthPct: 3 },
};
assert.deepEqual(validatePortfolioConfig(manualValid), [], "수동 필수 metric이 있으면 통과");
assert.deepEqual(validatePortfolioConfig(valid), [], "auto mode는 수동 metric 없이 통과");

const accountMismatch = cloneConfig(valid);
accountMismatch.taxSaving.accountType = "brokerage";
assert.ok(issueCodes(accountMismatch).includes("account_type_mismatch"), "계좌 타입 불일치 오류");
assert.ok(issueCodes({ ...valid, version: 2 } as unknown as AssetSimulatorPortfolioConfigV1).includes("unknown_version"), "알 수 없는 버전 검증 오류");

const normalized = normalizePortfolioConfig({
  version: 1,
  taxSaving: {
    accountType: "taxSaving",
    holdings: [{ id: " raw ", ticker: " $schd ", weightPct: 100, metricMode: "manual", manual: { totalReturnCagrPct: 6, priceCagrPct: Number.NaN } }],
  },
  brokerage: { accountType: "brokerage", holdings: [{ id: "bad", ticker: null, weightPct: Infinity, metricMode: "auto" }] },
});
assert.equal(normalized?.taxSaving.holdings[0].ticker, "SCHD", "version 1 티커 정규화");
assert.deepEqual(normalized?.taxSaving.holdings[0].manual, { totalReturnCagrPct: 6 }, "수동 metric의 비유한 수 제거");
assert.equal(normalized?.brokerage.holdings.length, 1, "잘못된 holding을 임의 삭제하지 않음");
assert.equal(normalized?.brokerage.holdings[0].weightPct, 0, "비유한 비중을 직렬화 가능한 invalid 값으로 보존");
assert.ok(normalized && issueCodes(normalized).includes("ticker_required"), "보존한 잘못된 holding에서 validation issue 발생");
assert.equal(normalizePortfolioConfig(undefined), null, "설정 없음은 null");
assert.equal(normalizePortfolioConfig({ version: 2 }), null, "알 수 없는 버전은 null");

const plans = buildDefaultYearPlans(DEFAULT_SIMULATOR_INPUTS.startYear, DEFAULT_SIMULATOR_INPUTS.years);
const legacyStored = buildStoredSimulatorConfig(DEFAULT_SIMULATOR_INPUTS, plans, "2026-07-11T00:00:00.000Z");
const legacyRestored = normalizePersistedSimulatorConfig(JSON.parse(JSON.stringify(legacyStored)), "local");
assert.ok(legacyRestored, "기존 저장값 복원");
assert.equal(legacyRestored.portfolioConfig, undefined, "기존 저장값은 portfolioConfig 없는 legacy mode 유지");
assert.equal(legacyRestored.portfolioAssumptions, undefined, "기존 저장값에 assumptions를 주입하지 않음");

const metric = (valuePct: number): ResolvedPortfolioMetric => ({
  valuePct,
  source: "manual",
  status: "manual",
  asOf: "2026-07-11",
  periodStart: "2021-07-11",
  periodEnd: "2026-07-11",
  observationYears: 5,
  warnings: [],
});
const assumptions: PortfolioAssumptionsSnapshot = {
  resolvedAt: "2026-07-11T00:00:00.000Z",
  holdings: [{
    ticker: "SCHD",
    totalReturnCagr: metric(8),
    priceCagr: metric(5),
    dividendYield: metric(4),
    dividendGrowth: metric(3),
  }],
};
const stored = buildStoredSimulatorConfig(DEFAULT_SIMULATOR_INPUTS, plans, "2026-07-11T00:00:00.000Z", {
  portfolioConfig: manualValid,
  portfolioAssumptions: assumptions,
});
const localPayload = JSON.parse(JSON.stringify(stored));
const restored = normalizePersistedSimulatorConfig(localPayload, "local");
assert.deepEqual(restored?.portfolioConfig, manualValid, "localStorage payload에서 portfolioConfig 저장/복원");
assert.deepEqual(restored?.portfolioAssumptions, assumptions, "localStorage payload에서 portfolioAssumptions 저장/복원");

const unsafeStored = structuredClone(stored);
unsafeStored.portfolioConfig!.taxSaving.holdings[0].manual!.totalReturnCagrPct = Number.NaN;
unsafeStored.portfolioAssumptions!.holdings[0].priceCagr.valuePct = Infinity;
const firestorePayload = buildFirestoreSimulatorConfigPayload(unsafeStored);
assert.equal(firestorePayload.portfolioConfig?.taxSaving.holdings[0].manual, undefined, "Firestore payload에서 비유한 수동 metric 제거");
assert.equal(firestorePayload.portfolioAssumptions?.holdings[0].priceCagr.valuePct, null, "Firestore payload에서 비유한 snapshot 값을 null 처리");
assert.deepEqual(findFirestoreUnsafePaths(firestorePayload), [], "Firestore payload 직렬화 안전성");
assert.equal(firestorePayload.updatedAt, undefined, "Firestore updatedAt은 repository serverTimestamp가 담당");

const projectionBefore = calculateAssetSimulatorPreview(DEFAULT_SIMULATOR_INPUTS, plans);
const projectionAfter = calculateAssetSimulatorPreview(restored!.inputs, restored!.yearPlans);
assert.deepEqual(projectionAfter, projectionBefore, "portfolio 저장/복원이 legacy projection 계산 결과를 변경하지 않음");

console.log("asset simulator portfolio config checks passed");
