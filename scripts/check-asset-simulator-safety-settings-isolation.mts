import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { calculateAssetSimulatorPreview, normalizeInputs } from "../lib/asset-simulator.ts";
import {
  buildStoredSimulatorConfig,
  normalizePersistedSimulatorConfig,
  normalizeRetirementSafetyConfig,
} from "../lib/asset-simulator-persistence.ts";
import { buildDefaultYearPlans } from "../lib/mock-asset-simulator-data.ts";

const basicInputs = normalizeInputs({
  startYear: 2026,
  years: 20,
  annualReturnRate: 7,
  inflationRate: 3.1,
  initialIsa: 10_000,
  initialPension: 10_000,
  reserveCash: 0,
  initialTaxableDividend: 10_000,
  withdrawalRate: 4,
  withdrawalGrowthRate: 0,
  withdrawalDelayYears: 0,
});

const stored = buildStoredSimulatorConfig(
  basicInputs,
  buildDefaultYearPlans(basicInputs.startYear, basicInputs.years),
  "2026-07-18T00:00:00.000Z",
  {
    retirementSafetyConfig: {
      version: 1,
      targetMonthlyExpenseReal: 250,
      simulationYears: 70,
      inflationRate: 2.5,
    },
  },
);
const restored = normalizePersistedSimulatorConfig(stored, "local");
assert.ok(restored, "독립 설정 저장값 복원");
assert.equal(restored.inputs.years, 20, "기본 시뮬레이터 기간 보존");
assert.equal(restored.inputs.inflationRate, 3.1, "기본 시뮬레이터 물가상승률 보존");
assert.equal(restored.retirementSafetyConfig?.simulationYears, 70, "안정성 체크 기간 보존");
assert.equal(restored.retirementSafetyConfig?.inflationRate, 2.5, "안정성 체크 물가상승률 보존");
assert.equal(restored.retirementSafetyConfig?.targetMonthlyExpenseReal, 250, "기존 안정성 목표 월생활비 보존");

const legacy = normalizePersistedSimulatorConfig(
  {
    inputs: basicInputs,
    yearPlans: buildDefaultYearPlans(basicInputs.startYear, basicInputs.years),
    updatedAt: "2026-07-17T00:00:00.000Z",
  },
  "cloud",
);
assert.ok(legacy, "전용 필드 없는 기존 저장값 복원");
assert.equal(legacy.retirementSafetyConfig, undefined, "기존 저장 구조는 변경 없이 읽음");
assert.equal(legacy.inputs.years, 20, "기존 공용 기간은 fallback 후보로 보존");
assert.equal(legacy.inputs.inflationRate, 3.1, "기존 공용 물가상승률은 fallback 후보로 보존");

assert.deepEqual(
  normalizeRetirementSafetyConfig({ version: 1, simulationYears: 70, inflationRate: 2.5 }),
  { version: 1, simulationYears: 70, inflationRate: 2.5 },
  "안정성 체크 전용 기간·물가상승률 정규화",
);
assert.equal(normalizeRetirementSafetyConfig({ version: 1, simulationYears: 0, inflationRate: -1 }), null, "빈값/범위 밖 안전성 설정은 저장하지 않음");

const safetyInputs = normalizeInputs({ ...basicInputs, years: 70, inflationRate: 2.5 });
const differentInflationInputs = normalizeInputs({ ...basicInputs, inflationRate: 2.5 });
const basicProjection = calculateAssetSimulatorPreview(basicInputs, buildDefaultYearPlans(basicInputs.startYear, basicInputs.years), true);
const safetyProjection = calculateAssetSimulatorPreview(safetyInputs, buildDefaultYearPlans(safetyInputs.startYear, safetyInputs.years), true);
const differentInflationProjection = calculateAssetSimulatorPreview(differentInflationInputs, buildDefaultYearPlans(differentInflationInputs.startYear, differentInflationInputs.years), true);
assert.equal(basicProjection.timeline.simulationYears, 20, "기본 계산은 기본 기간 사용");
assert.equal(safetyProjection.timeline.simulationYears, 70, "안정성 계산은 안전성 기간 사용");
assert.notEqual(basicProjection.summary.finalRealWithoutWithdrawal, differentInflationProjection.summary.finalRealWithoutWithdrawal, "물가상승률이 다른 두 계산 결과는 독립적");

const page = readFileSync("components/asset-simulator/AssetSimulatorPage.tsx", "utf8");
const dashboard = readFileSync("components/asset-simulator/SafetyCheckDashboard.tsx", "utf8");
const hero = readFileSync("components/asset-simulator/SafetyHeroCard.tsx", "utf8");
assert.match(page, /const \[safetySimulationYears, setSafetySimulationYears\]/, "안정성 기간 전용 state");
assert.match(page, /const \[safetyInflationRate, setSafetyInflationRate\]/, "안정성 물가상승률 전용 state");
assert.match(page, /years: safetySimulationYears,[\s\S]*inflationRate: safetyInflationRate/, "안정성 projection 이 전용 입력값 사용");
assert.match(page, /simulationYears: safetySettingsRef\.current\.simulationYears,[\s\S]*inflationRate: safetySettingsRef\.current\.inflationRate/, "안정성 전용 필드를 저장");
assert.match(page, /simulationYears=\{safetySimulationYears\}[\s\S]*inflationRate=\{safetyInflationRate\}/, "안정성 UI 가 전용 state 표시");
assert.doesNotMatch(page, /SafetyDotState|safetyDotState|bg-emerald-500|bg-amber-500/, "안정성 탭 상태 점과 전용 판정 제거");
assert.match(dashboard, /simulationYears=\{simulationYears\}[\s\S]*inflationRate=\{inflationRate\}/, "대시보드가 전용 입력값을 Hero 로 전달");
assert.match(hero, /onSimulationYearsChange|onInflationRateChange/, "Hero 가 공용 inputs 대신 전용 setter 사용");
assert.doesNotMatch(hero, /SimulatorInputs|onInputsChange/, "Hero 는 기본 시뮬레이터 입력을 변경하지 않음");

console.log("asset simulator basic/safety period and inflation isolation checks passed");
