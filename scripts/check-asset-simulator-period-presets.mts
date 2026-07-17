import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { calculateAssetSimulatorPreview, normalizeInputs, normalizeYearPlans, normalizeYearPlansPreservingOutsidePeriod } from "../lib/asset-simulator.ts";
import { buildStoredSimulatorConfig, normalizePersistedSimulatorConfig } from "../lib/asset-simulator-persistence.ts";
import { getVisibleYearPlanRows, MAX_VISIBLE_YEAR_PLAN_ROWS } from "../lib/asset-simulator-year-plan-view.ts";
import { buildDefaultYearPlans, DEFAULT_SIMULATOR_INPUTS } from "../lib/mock-asset-simulator-data.ts";

const PERIODS = [10, 20, 21, 30, 60] as const;
const editableValues = (row: { year: number; monthlyContribution: number; isaContribution: boolean; pensionContribution: boolean; isaToPensionTransfer: boolean }) => ({
  year: row.year,
  monthlyContribution: row.monthlyContribution,
  isaContribution: row.isaContribution,
  pensionContribution: row.pensionContribution,
  isaToPensionTransfer: row.isaToPensionTransfer,
});

for (const years of PERIODS) {
  const inputs = normalizeInputs({ ...DEFAULT_SIMULATOR_INPUTS, years });
  const plans = normalizeYearPlans(inputs, buildDefaultYearPlans(inputs.startYear, inputs.years));
  const projection = calculateAssetSimulatorPreview(inputs, plans);
  assert.equal(plans.length, years, `${years}년 계획표 행 수`);
  assert.equal(projection.results.length, years, `${years}년 결과 행 수`);
  assert.equal(projection.chartRows.length, years, `${years}년 차트 행 수`);
  assert.equal(projection.timeline.simulationYears, years, `${years}년 타임라인 기간`);
  assert.equal(projection.timeline.endYear, inputs.startYear + years - 1, `${years}년 종료연도`);
  assert.equal(getVisibleYearPlanRows(plans).length, Math.min(years, MAX_VISIBLE_YEAR_PLAN_ROWS), `${years}년 화면 계획표 표시 행 수`);
  assert.deepEqual(getVisibleYearPlanRows(plans).map((row) => row.year), plans.slice(0, 20).map((row) => row.year), `${years}년 화면은 시작연도부터 연속 표시`);
}

const sixtyYearInputs = normalizeInputs({ ...DEFAULT_SIMULATOR_INPUTS, years: 60 });
const sixtyYearPlans = buildDefaultYearPlans(sixtyYearInputs.startYear, sixtyYearInputs.years);
const benchmarkStartedAt = performance.now();
for (let index = 0; index < 500; index += 1) {
  calculateAssetSimulatorPreview(sixtyYearInputs, sixtyYearPlans);
}
const benchmarkElapsedMs = performance.now() - benchmarkStartedAt;
assert.ok(benchmarkElapsedMs < 3000, `60년 계산 500회가 현저히 지연됨: ${benchmarkElapsedMs.toFixed(1)}ms`);

const initialInputs = normalizeInputs({ ...DEFAULT_SIMULATOR_INPUTS, years: 30 });
const customized = buildDefaultYearPlans(initialInputs.startYear, initialInputs.years).map((row, index) =>
  index === 10
    ? { ...row, monthlyContribution: 777, isaContribution: false, pensionContribution: true, isaToPensionTransfer: true }
    : row,
);
const shrunkInputs = normalizeInputs({ ...initialInputs, years: 20 });
const preservedShrunk = normalizeYearPlansPreservingOutsidePeriod(shrunkInputs, customized);
const shrunk = normalizeYearPlans(shrunkInputs, preservedShrunk);
assert.equal(shrunk.length, 20, "기간 축소 시 계산·화면 계획표는 20년");
assert.equal(preservedShrunk.length, 30, "기간 축소 시 21년차 이후 저장 계획 보존");
assert.deepEqual(editableValues(shrunk[10]), editableValues(customized[10]), "기간 축소 시 범위 안 사용자 계획 보존");
assert.deepEqual(editableValues(preservedShrunk[20]), editableValues(customized[20]), "기간 축소 시 21년차 사용자 계획 보존");

const expandedInputs = normalizeInputs({ ...shrunkInputs, years: 60 });
const expanded = normalizeYearPlans(expandedInputs, preservedShrunk);
assert.equal(expanded.length, 60, "기간 확대 시 행 추가");
assert.deepEqual(editableValues(expanded[10]), editableValues(customized[10]), "기간 확대 후 기존 사용자 계획 보존");
assert.deepEqual(editableValues(expanded[20]), editableValues(customized[20]), "기간 확대 후 21년차 사용자 계획 보존");

const shiftedInputs = normalizeInputs({ ...initialInputs, startYear: initialInputs.startYear + 1 });
const shifted = normalizeYearPlans(shiftedInputs, customized);
assert.deepEqual(editableValues(shifted[9]), editableValues(customized[10]), "시작연도 변경 시 같은 연도의 사용자 계획 보존");

const stored = buildStoredSimulatorConfig(shrunkInputs, preservedShrunk, "2026-07-11T00:00:00.000Z");
assert.deepEqual(Object.keys(stored).sort(), ["inputs", "updatedAt", "yearPlans"], "저장 스키마는 inputs/yearPlans/updatedAt만 유지");
assert.equal(stored.inputs.years, 20, "선택 기간 저장");
assert.equal(stored.yearPlans.length, 30, "화면 밖 21년차 이후 계획도 저장");
const restored = normalizePersistedSimulatorConfig(stored, "local");
assert.equal(restored?.inputs.years, 20, "재접속 하이드레이션에서 기간 복원");
assert.equal(restored?.yearPlans.length, 30, "재접속 하이드레이션에서 화면 밖 계획 복원");

const panel = readFileSync("components/asset-simulator/SimulatorInputPanel.tsx", "utf8");
const table = readFileSync("components/asset-simulator/YearPlanTable.tsx", "utf8");
assert.doesNotMatch(panel, /SIMULATION_YEAR_PRESETS|시뮬레이션 기간 빠른 선택|aria-pressed=\{selected\}/, "기간 프리셋 정의·버튼·핸들러 제거");
assert.match(panel, /key: "years", label: "시뮬레이션 기간\(년\)"[\s\S]*max: 70/, "기간 숫자 직접 입력과 1~70 제한 유지");
assert.match(panel, /type="number"[\s\S]*min=\{item\.min\}[\s\S]*max=\{item\.max\}/, "기간 숫자 직접 입력 렌더링 유지");
assert.match(table, /getVisibleYearPlanRows\(plans\)/, "계획표 화면 표시 데이터는 전용 helper 사용");
assert.match(table, /rows=\{plans\}/, "CSV는 전체 기간 계획을 내보냄");

console.log(`asset simulator period display checks passed (10/20/21/30/60 display cap + full calculation/persistence/CSV, 60-year x500 ${benchmarkElapsedMs.toFixed(1)}ms)`);
