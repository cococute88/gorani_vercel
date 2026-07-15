import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { calculateRetirementSafety } from "../lib/asset-simulator-safety.ts";
import { buildExitYearPlans, calculateAssetSimulatorPreview, normalizeInputs } from "../lib/asset-simulator.ts";
import {
  buildStoredSimulatorConfig,
  normalizePersistedSimulatorConfig,
  normalizeRetirementSafetyConfig,
} from "../lib/asset-simulator-persistence.ts";
import { buildDefaultYearPlans, DEFAULT_SIMULATOR_INPUTS } from "../lib/mock-asset-simulator-data.ts";
import type { SimulatorProjection } from "../lib/asset-simulator-types.ts";

type Series = number | number[];

type FixtureOptions = {
  taxAssets?: number[];
  brokerageAssets?: number[];
  combinedAssets?: number[];
  requiredMonthlyReal?: Series;
  taxMonthlyReal?: Series;
  brokerageMonthlyReal?: Series;
  dividendsReal?: number[];
};

function seriesLength(value: Series | undefined): number {
  return Array.isArray(value) ? value.length : 0;
}

function at(value: Series | undefined, index: number, fallback: number): number {
  if (!Array.isArray(value)) return value ?? fallback;
  return value[index] ?? value.at(-1) ?? fallback;
}

function assetAt(values: number[] | undefined, index: number, fallback: number): number {
  return values?.[index] ?? values?.at(-1) ?? fallback;
}

// check-asset-simulator-safety.mts 와 동일한 fixture 빌더(정렬/인덱스 규칙을 그대로 재사용).
function fixture(options: FixtureOptions = {}): SimulatorProjection {
  const years = Math.max(
    3,
    options.taxAssets?.length ?? 0,
    options.brokerageAssets?.length ?? 0,
    options.combinedAssets?.length ?? 0,
    options.dividendsReal?.length ?? 0,
    seriesLength(options.requiredMonthlyReal),
    seriesLength(options.taxMonthlyReal),
    seriesLength(options.brokerageMonthlyReal),
  );
  const inputs = normalizeInputs({ ...DEFAULT_SIMULATOR_INPUTS, years });
  const base = calculateAssetSimulatorPreview(inputs, buildExitYearPlans(inputs), true);

  return {
    ...base,
    chartRows: base.chartRows.map((row, index) => {
      const taxAssets = assetAt(options.taxAssets, index, 100);
      const brokerageAssets = assetAt(options.brokerageAssets, index, 100);
      return {
        ...row,
        realTaxSavingBalance: taxAssets,
        taxableDividendBalanceReal: brokerageAssets,
        combinedRealBalance: assetAt(options.combinedAssets, index, taxAssets + brokerageAssets),
      };
    }),
    totalWithdrawRows: base.totalWithdrawRows.map((row, index) => {
      const requiredMonthlyReal = at(options.requiredMonthlyReal, index, 100);
      const taxMonthlyReal = at(options.taxMonthlyReal, index, requiredMonthlyReal);
      const brokerageMonthlyReal = at(options.brokerageMonthlyReal, index, 10);
      return {
        ...row,
        isWithdraw: index > 0,
        realWithdraw: index > 0 ? requiredMonthlyReal * 12 : 0,
        taxSavingMonthlyReal: index > 0 ? taxMonthlyReal : 0,
        taxableMonthlyDividendReal: index > 0 ? brokerageMonthlyReal : 0,
        totalMonthlyIncomeReal: index > 0 ? taxMonthlyReal + brokerageMonthlyReal : 0,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// 1) 목표 월생활비가 없으면 기존 Safety 결과를 그대로 유지한다.
// ---------------------------------------------------------------------------
{
  const source = fixture({
    combinedAssets: [200, 200, 200, 200, 200],
    requiredMonthlyReal: 40,
    taxMonthlyReal: [0, 50, 50, 50, 50],
    brokerageMonthlyReal: 0,
  });
  const noArg = calculateRetirementSafety(source);
  const explicitNull = calculateRetirementSafety(source, { targetMonthlyExpenseReal: null });
  const emptyOptions = calculateRetirementSafety(source, {});
  assert.deepEqual(explicitNull, noArg, "target null 은 무옵션과 동일 결과");
  assert.deepEqual(emptyOptions, noArg, "빈 옵션은 무옵션과 동일 결과");
  assert.equal(noArg.combined.metrics.expenseDemandSource, "legacy_proxy", "target 없으면 proxy 기준");
  assert.equal(noArg.combined.metrics.targetMonthlyExpenseReal, null, "target 없으면 metrics target null");
  assert.equal(noArg.combined.metrics.failed, false, "proxy 부족 없음 → hard failure 아님");
}

// ---------------------------------------------------------------------------
// 2) 목표 월생활비가 있으면 수요 기준이 target 으로 바뀐다(+장기 부족 hard failure).
//    공급 50 < proxy 수요 40 이면 부족 없음, 그러나 target 100 기준으로는 상시 부족.
// ---------------------------------------------------------------------------
{
  const source = fixture({
    combinedAssets: [200, 200, 200, 200, 200],
    requiredMonthlyReal: 40,
    taxMonthlyReal: [0, 50, 50, 50, 50],
    brokerageMonthlyReal: 0,
  });
  const proxy = calculateRetirementSafety(source).combined;
  const target = calculateRetirementSafety(source, { targetMonthlyExpenseReal: 100 }).combined;

  assert.equal(proxy.metrics.shortfallYears, 0, "proxy 수요 기준에서는 부족 없음");
  assert.ok(target.metrics.shortfallYears > 0, "target 수요 기준에서는 부족 발생(수요 기준 전환)");
  assert.equal(target.metrics.expenseDemandSource, "target", "target 기준으로 전환됨");
  assert.equal(target.metrics.targetMonthlyExpenseReal, 100, "metrics 에 목표 월생활비 반영");
  assert.ok(
    typeof target.metrics.monthlyIncomeCoverageRatio === "number" && Math.abs(target.metrics.monthlyIncomeCoverageRatio - 0.5) < 1e-9,
    "충당률 = 공급/수요 = 0.5",
  );
  assert.equal(target.metrics.failed, true, "target 상시 부족(2년 연속/3년 이상)은 hard failure");
  assert.equal(target.metrics.failureReason, "INCOME_SHORTAGE", "target 부족 hard failure 코드");
  assert.equal(target.grade, "F", "target 장기 부족은 F");
  assert.ok(target.score <= 34, "hard failure 점수는 F 구간(≤34)으로 제한되어 등급과 모순되지 않음");
}

// ---------------------------------------------------------------------------
// 3) target 1년 부족 → failed=false, warning.
// ---------------------------------------------------------------------------
{
  const result = calculateRetirementSafety(
    fixture({
      combinedAssets: [200, 200, 200, 200, 200],
      taxMonthlyReal: [0, 50, 100, 100, 100],
      brokerageMonthlyReal: 0,
    }),
    { targetMonthlyExpenseReal: 100 },
  ).combined;
  assert.equal(result.metrics.shortfallYears, 1, "target 부족 1년 감지");
  assert.equal(result.metrics.consecutiveShortfallYears, 1, "최장 연속 1년");
  assert.equal(result.metrics.failed, false, "target 1년 부족은 hard failure 아님");
  assert.notEqual(result.grade, "F", "1년 부족은 F 아님");
  assert.ok(result.warnings.some((message) => message.includes("목표 월생활비")), "target 1년 부족 경고 문구");
}

// ---------------------------------------------------------------------------
// 4) target 2년 연속 부족 → hard failure 가능.
// ---------------------------------------------------------------------------
{
  const result = calculateRetirementSafety(
    fixture({
      combinedAssets: [200, 200, 200, 200, 200],
      taxMonthlyReal: [0, 50, 50, 100, 100],
      brokerageMonthlyReal: 0,
    }),
    { targetMonthlyExpenseReal: 100 },
  ).combined;
  assert.equal(result.metrics.consecutiveShortfallYears, 2, "2년 연속 부족 감지");
  assert.equal(result.metrics.failed, true, "target 2년 연속 부족은 hard failure");
  assert.equal(result.metrics.failureReason, "INCOME_SHORTAGE", "2년 연속 부족 실패 코드");
  assert.equal(result.grade, "F", "2년 연속 부족은 F");
}

// ---------------------------------------------------------------------------
// 5) target 총 3년(비연속) 부족 → hard failure 가능.
// ---------------------------------------------------------------------------
{
  const result = calculateRetirementSafety(
    fixture({
      combinedAssets: [200, 200, 200, 200, 200, 200, 200],
      taxMonthlyReal: [0, 50, 100, 50, 100, 50, 100],
      brokerageMonthlyReal: 0,
    }),
    { targetMonthlyExpenseReal: 100 },
  ).combined;
  assert.equal(result.metrics.shortfallYears, 3, "총 3년 부족 감지");
  assert.equal(result.metrics.consecutiveShortfallYears, 1, "비연속이라 최장 연속은 1년");
  assert.equal(result.metrics.failed, true, "target 총 3년 부족은 hard failure");
  assert.equal(result.metrics.failureReason, "INCOME_SHORTAGE", "총 3년 부족 실패 코드");
}

// ---------------------------------------------------------------------------
// 6) 목표는 절세계좌 단독 평가를 바꾸지 않는다(통합에만 적용).
// ---------------------------------------------------------------------------
{
  const source = fixture({
    combinedAssets: [200, 200, 200, 200, 200],
    taxMonthlyReal: [0, 50, 50, 50, 50],
    brokerageMonthlyReal: 0,
  });
  const taxNoTarget = calculateRetirementSafety(source).taxSaving;
  const taxWithTarget = calculateRetirementSafety(source, { targetMonthlyExpenseReal: 100 }).taxSaving;
  assert.deepEqual(taxWithTarget, taxNoTarget, "절세계좌 평가는 목표 입력과 무관");
  assert.equal(taxWithTarget.metrics.expenseDemandSource, "legacy_proxy", "절세계좌는 계속 proxy 기준");
}

// ---------------------------------------------------------------------------
// 7) 위탁 0원/데이터 부족이 목표 입력 후에도 F 로 보이지 않는다.
// ---------------------------------------------------------------------------
{
  const projection = calculateAssetSimulatorPreview(DEFAULT_SIMULATOR_INPUTS, buildDefaultYearPlans(), false);
  const result = calculateRetirementSafety(projection, { targetMonthlyExpenseReal: 300 });
  assert.equal(result.brokerage.status, "evaluated", "기본 입력 위탁계좌는 목표 입력과 무관하게 평가됨");
  assert.notEqual(result.brokerage.grade, "F", "평가된 위탁계좌는 목표 입력 때문에 F가 되지 않음");
  assert.equal(result.brokerage.metrics.failed, false, "기본 위탁계좌는 실패 아님");
}

// ---------------------------------------------------------------------------
// 8) 점수/failed 무모순 + 순수성(입력 projection 불변).
// ---------------------------------------------------------------------------
{
  const source = fixture({
    combinedAssets: [200, 200, 200, 200, 200],
    taxMonthlyReal: [0, 50, 50, 50, 50],
    brokerageMonthlyReal: 0,
  });
  const before = JSON.stringify(source);
  const result = calculateRetirementSafety(source, { targetMonthlyExpenseReal: 100 });
  assert.equal(JSON.stringify(source), before, "Safety Engine 은 projection 을 변경하지 않는 순수 함수");
  for (const [account, safety] of Object.entries(result)) {
    assert.ok(safety.score >= 0 && safety.score <= 100, `${account} 점수 0~100`);
    if (safety.metrics.failed) assert.equal(safety.grade, "F", `${account} hard failure 는 반드시 F`);
  }
}

// ---------------------------------------------------------------------------
// 9) 저장 설정 정규화(방어) + 라운드트립.
// ---------------------------------------------------------------------------
{
  assert.deepEqual(
    normalizeRetirementSafetyConfig({ version: 1, targetMonthlyExpenseReal: 250 }),
    { version: 1, targetMonthlyExpenseReal: 250 },
    "유효 목표 월생활비 정규화",
  );
  assert.equal(normalizeRetirementSafetyConfig({ version: 1, targetMonthlyExpenseReal: -5 }), null, "음수 방어");
  assert.equal(normalizeRetirementSafetyConfig({ version: 1, targetMonthlyExpenseReal: Number.NaN }), null, "NaN 방어");
  assert.equal(normalizeRetirementSafetyConfig({ version: 1, targetMonthlyExpenseReal: Infinity }), null, "Infinity 방어");
  assert.equal(normalizeRetirementSafetyConfig({ version: 1, targetMonthlyExpenseReal: 0 }), null, "0 은 무효");
  assert.equal(normalizeRetirementSafetyConfig({ version: 2, targetMonthlyExpenseReal: 100 }), null, "미지원 version 방어");
  assert.equal(normalizeRetirementSafetyConfig(null), null, "null 방어");
  assert.equal(normalizeRetirementSafetyConfig("nope"), null, "비객체 방어");

  const plans = buildDefaultYearPlans();
  const stored = buildStoredSimulatorConfig(DEFAULT_SIMULATOR_INPUTS, plans, new Date("2026-07-12T00:00:00.000Z").toISOString(), {
    retirementSafetyConfig: { version: 1, targetMonthlyExpenseReal: 320 },
  });
  assert.ok(stored.retirementSafetyConfig, "저장 payload 에 retirementSafetyConfig 포함");
  assert.equal(stored.retirementSafetyConfig?.targetMonthlyExpenseReal, 320, "저장된 목표 월생활비 유지");
  const restored = normalizePersistedSimulatorConfig({ ...stored }, "local");
  assert.ok(restored, "복원 성공");
  assert.equal(restored!.retirementSafetyConfig?.targetMonthlyExpenseReal, 320, "복원된 목표 월생활비 유지");

  // 기존 저장값(설정 없음)은 그대로 복원되고 target 은 생략된다(하위 호환).
  const legacyStored = buildStoredSimulatorConfig(DEFAULT_SIMULATOR_INPUTS, plans);
  assert.equal(legacyStored.retirementSafetyConfig, undefined, "설정 없으면 payload 에 미포함");
  const legacyRestored = normalizePersistedSimulatorConfig({ ...legacyStored, updatedAt: new Date().toISOString() }, "local");
  assert.equal(legacyRestored!.retirementSafetyConfig, undefined, "기존 저장값은 target 없이 복원");

  // 무효 목표가 payload 에 섞여도 정규화로 제거된다.
  const dirtyRestored = normalizePersistedSimulatorConfig(
    { inputs: DEFAULT_SIMULATOR_INPUTS, yearPlans: plans, retirementSafetyConfig: { version: 1, targetMonthlyExpenseReal: -10 }, updatedAt: new Date().toISOString() },
    "local",
  );
  assert.equal(dirtyRestored!.retirementSafetyConfig, undefined, "무효 목표는 복원 시 제거");
}

// ---------------------------------------------------------------------------
// 10) 페이지/섹션 배선 확인(입력 → 상태 → 저장 → Safety 전달).
// ---------------------------------------------------------------------------
{
  const read = (path: string) => readFileSync(path, "utf8");
  const page = read("components/asset-simulator/AssetSimulatorPage.tsx");
  assert.match(page, /targetMonthlyExpenseReal/, "페이지가 목표 월생활비 상태를 관리");
  assert.match(page, /setTargetMonthlyExpenseReal/, "목표 월생활비 setter 존재");
  assert.match(page, /retirementSafetyConfig: \{ version: 1 as const, targetMonthlyExpenseReal \}/, "저장 payload 에 목표 월생활비 포함");
  assert.match(page, /onTargetMonthlyExpenseChange=\{setTargetMonthlyExpenseReal\}/, "대시보드에 setter 전달");
  assert.match(page, /useState<number \| null>\(100\)/, "기본 목표 월생활비 100만원 유지");

  // 목표 월생활비 입력은 목표 설정 단계의 SafetyHeroCard 에 둔다.
  // 대시보드는 목표와 기간/물가 입력을 Hero 까지 전달한다.
  const dashboard = read("components/asset-simulator/SafetyCheckDashboard.tsx");
  assert.match(dashboard, /onTargetMonthlyExpenseChange=\{onTargetMonthlyExpenseChange\}/, "대시보드가 Hero 로 setter 전달");
  assert.match(dashboard, /inputs=\{inputs\}/, "대시보드가 Hero 로 시뮬레이션 입력 전달");

  const hero = read("components/asset-simulator/SafetyHeroCard.tsx");
  assert.match(hero, /id="target-monthly-expense"/, "Hero 목표 월생활비 입력 id");
  assert.match(hero, /목표 월생활비/, "목표 월생활비 입력 라벨");
  assert.match(hero, /현재 가치 기준/, "현재 가치 기준 안내");
  assert.match(hero, /기간/, "기간 입력 라벨");
  assert.match(hero, /물가상승률/, "물가상승률 입력 라벨");
  assert.match(hero, /onTargetMonthlyExpenseChange/, "Hero 가 목표 값을 상위로 전달");

  const resultCards = read("components/asset-simulator/SafetyKpiCards.tsx");
  assert.doesNotMatch(resultCards, /월생활비 충당 결과/, "단일 대표 충당 결과 제거");
  assert.match(resultCards, /ScenarioSummaryCard[\s\S]*생활비 미달[\s\S]*보존율/, "시나리오별 핵심 결과 카드 표시");
  assert.match(dashboard, /label: "Good"[\s\S]*label: "Normal"[\s\S]*label: "Bad"/, "Good Normal Bad 결과 연결");
  assert.match(resultCards, /생활비 미달/, "생활비 미달 기간 의미 표시");
  assert.match(resultCards, /formatCoverageRatio/, "충당률 표시");

  const section = read("components/asset-simulator/RetirementSafetySection.tsx");
  assert.match(section, /calculateRetirementSafety\(projection, \{ targetMonthlyExpenseReal \}\)/, "섹션이 목표 월생활비를 Safety 에 전달");
  assert.match(section, /overflow-hidden/, "가로 넘침 방지 유지");
}

console.log("asset simulator target expense safety checks passed");
