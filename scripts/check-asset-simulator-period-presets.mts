import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { calculateAssetSimulatorPreview, normalizeInputs, normalizeYearPlans } from "../lib/asset-simulator.ts";
import { buildStoredSimulatorConfig, normalizePersistedSimulatorConfig } from "../lib/asset-simulator-persistence.ts";
import { buildDefaultYearPlans, DEFAULT_SIMULATOR_INPUTS } from "../lib/mock-asset-simulator-data.ts";

const PRESETS = [20, 30, 40, 50, 60] as const;
const editableValues = (row: { year: number; monthlyContribution: number; isaContribution: boolean; pensionContribution: boolean; isaToPensionTransfer: boolean }) => ({
  year: row.year,
  monthlyContribution: row.monthlyContribution,
  isaContribution: row.isaContribution,
  pensionContribution: row.pensionContribution,
  isaToPensionTransfer: row.isaToPensionTransfer,
});

for (const years of PRESETS) {
  const inputs = normalizeInputs({ ...DEFAULT_SIMULATOR_INPUTS, years });
  const plans = normalizeYearPlans(inputs, buildDefaultYearPlans(inputs.startYear, inputs.years));
  const projection = calculateAssetSimulatorPreview(inputs, plans);
  assert.equal(plans.length, years, `${years}년 계획표 행 수`);
  assert.equal(projection.results.length, years, `${years}년 결과 행 수`);
  assert.equal(projection.chartRows.length, years, `${years}년 차트 행 수`);
  assert.equal(projection.timeline.simulationYears, years, `${years}년 타임라인 기간`);
  assert.equal(projection.timeline.endYear, inputs.startYear + years - 1, `${years}년 종료연도`);
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
const shrunk = normalizeYearPlans(shrunkInputs, customized);
assert.equal(shrunk.length, 20, "기간 축소 시 뒤쪽 행만 제거");
assert.deepEqual(editableValues(shrunk[10]), editableValues(customized[10]), "기간 축소 시 범위 안 사용자 계획 보존");

const expandedInputs = normalizeInputs({ ...shrunkInputs, years: 60 });
const expanded = normalizeYearPlans(expandedInputs, shrunk);
assert.equal(expanded.length, 60, "기간 확대 시 행 추가");
assert.deepEqual(editableValues(expanded[10]), editableValues(customized[10]), "기간 확대 후 기존 사용자 계획 보존");
assert.deepEqual(editableValues(expanded[20]), editableValues(buildDefaultYearPlans(expandedInputs.startYear, expandedInputs.years)[20]), "기간 확대 시 새 연도만 기본 계획 생성");

const shiftedInputs = normalizeInputs({ ...initialInputs, startYear: initialInputs.startYear + 1 });
const shifted = normalizeYearPlans(shiftedInputs, customized);
assert.deepEqual(editableValues(shifted[9]), editableValues(customized[10]), "시작연도 변경 시 같은 연도의 사용자 계획 보존");

const stored = buildStoredSimulatorConfig(expandedInputs, expanded, "2026-07-11T00:00:00.000Z");
assert.deepEqual(Object.keys(stored).sort(), ["inputs", "updatedAt", "yearPlans"], "저장 스키마는 inputs/yearPlans/updatedAt만 유지");
assert.equal(stored.inputs.years, 60, "선택 기간 저장");
assert.equal(stored.yearPlans.length, 60, "선택 기간 계획표 저장");
const restored = normalizePersistedSimulatorConfig(stored, "local");
assert.equal(restored?.inputs.years, 60, "재접속 하이드레이션에서 기간 복원");
assert.equal(restored?.yearPlans.length, 60, "재접속 하이드레이션에서 계획표 복원");

const panel = readFileSync("components/asset-simulator/SimulatorInputPanel.tsx", "utf8");
assert.match(panel, /SIMULATION_YEAR_PRESETS = \[20, 30, 40, 50, 60\] as const/, "20·30·40·50·60년 프리셋 정의");
assert.match(panel, /aria-pressed=\{selected\}/, "현재 선택 프리셋 접근성 상태 표시");
assert.match(panel, /const selected = inputs\.years === years/, "비프리셋 직접 입력 시 모든 버튼 비활성");
assert.match(panel, /role="group" aria-label="시뮬레이션 기간 빠른 선택"/, "프리셋 그룹 접근성 이름");
assert.match(panel, /grid grid-cols-5 gap-1\.5/, "모바일 폭 내 5개 버튼 배치");
assert.match(panel, /focus-visible:outline/, "키보드 포커스 표시");
assert.match(panel, /dark:border-cyan-400[\s\S]*dark:bg-cyan-400\/20/, "다크 모드 활성 상태 식별");
assert.match(panel, /border-blue-600 bg-blue-600 text-white/, "라이트 모드 활성 상태 식별");
assert.match(panel, /type="number"[\s\S]*min=\{item\.min\}[\s\S]*max=\{item\.max\}/, "기존 숫자 직접 입력과 1~60 제한 유지");

console.log(`asset simulator period preset checks passed (20/30/40/50/60 + preservation + persistence + accessibility, 60-year x500 ${benchmarkElapsedMs.toFixed(1)}ms)`);
