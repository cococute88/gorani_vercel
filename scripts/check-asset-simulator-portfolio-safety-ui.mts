import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { calculateAssetSimulatorPreview } from "../lib/asset-simulator.ts";
import { calculateRetirementSafety } from "../lib/asset-simulator-safety.ts";
import {
  buildDefaultPortfolioConfig,
  normalizePortfolioConfig,
  normalizePortfolioAssumptions,
} from "../lib/asset-simulator-portfolio.ts";
import { buildAppliedPortfolioAssumptions } from "../lib/asset-simulator-portfolio-assumptions.ts";
import {
  buildStoredSimulatorConfig,
  normalizePersistedSimulatorConfig,
} from "../lib/asset-simulator-persistence.ts";
import {
  describeApplyState,
  describeMetricStatus,
  describeSafety,
  isWeightTotalValid,
  sumWeightPct,
} from "../lib/asset-simulator-portfolio-ui.ts";
import { buildDefaultYearPlans, DEFAULT_SIMULATOR_INPUTS } from "../lib/mock-asset-simulator-data.ts";
import type {
  AssetSimulatorPortfolioConfigV1,
  PortfolioHoldingResolution,
  ResolvedPortfolioMetric,
  SafetyResult,
} from "../lib/asset-simulator-types.ts";

const read = (path: string) => readFileSync(path, "utf8");

// ----- 1) 비중 합계 / 100% 검증 --------------------------------------------
const valid = buildDefaultPortfolioConfig();
assert.equal(sumWeightPct(valid.taxSaving.holdings), 100, "절세계좌 기본 비중 합계 100%");
assert.equal(sumWeightPct(valid.brokerage.holdings), 100, "위탁계좌 기본 비중 합계 100%");
assert.ok(isWeightTotalValid(valid.taxSaving.holdings), "100% 합계는 유효");

const skewed = structuredClone(valid);
skewed.taxSaving.holdings[0].weightPct = 40;
assert.equal(sumWeightPct(skewed.taxSaving.holdings), 90, "합계 반영");
assert.ok(!isWeightTotalValid(skewed.taxSaving.holdings), "90% 합계는 무효");

// ----- 2) metric status 표시 (무배당/조회 실패/데이터 부족) ------------------
const metric = (overrides: Partial<ResolvedPortfolioMetric>): ResolvedPortfolioMetric => ({
  valuePct: null,
  source: "yahoo-close",
  status: "failed",
  asOf: null,
  periodStart: null,
  periodEnd: null,
  observationYears: null,
  warnings: [],
  ...overrides,
});

assert.equal(describeMetricStatus(metric({ status: "resolved", valuePct: 6 })).label, "계산 완료", "resolved → 계산 완료");
assert.equal(describeMetricStatus(metric({ status: "failed" })).label, "조회 실패", "failed → 조회 실패");
assert.equal(
  describeMetricStatus(metric({ status: "insufficient_history" })).label,
  "데이터 부족 · 수동 보완",
  "insufficient_history → 데이터 부족",
);
assert.equal(
  describeMetricStatus(metric({ status: "not_applicable", valuePct: 0 }), { isDividendMetric: true }).label,
  "무배당",
  "not_applicable(0) 배당 metric → 무배당",
);
assert.equal(describeMetricStatus(metric({ status: "manual", valuePct: 5 })).label, "수동 입력", "manual → 수동 입력");

// ----- 3) Safety 카드가 grade null 을 F 로 표시하지 않음 ---------------------
const baseMetrics = {
  startingRealAssets: 0,
  endingRealAssets: 0,
  preservationRatio: 0,
  yearsEvaluated: 0,
  failed: false,
  failureReason: "DATA_INSUFFICIENT" as const,
  depleted: false,
  livingExpensesCovered: null,
  sustainedThroughRetirement: false,
  principalSold: null,
  dividendsContinued: null,
  shortfallYears: 0,
  consecutiveShortfallYears: 0,
  preservationScore: 0,
  incomeCoverageScore: 0,
  depletionScore: 0,
  stabilityScore: 0,
  latePeriodDecline: false,
};
const dataInsufficient: SafetyResult = { status: "data_insufficient", grade: null, score: 0, positives: [], warnings: [], metrics: baseMetrics };
const notApplicable: SafetyResult = { status: "not_applicable", grade: null, score: 0, positives: [], warnings: [], metrics: baseMetrics };

const insufficientDisplay = describeSafety(dataInsufficient);
assert.notEqual(insufficientDisplay.gradeLabel, "F", "grade null 을 F 로 표시하지 않음");
assert.equal(insufficientDisplay.gradeLabel, "데이터 부족", "data_insufficient → 데이터 부족");
assert.equal(insufficientDisplay.showScore, false, "미평가 상태는 점수를 표시하지 않음");
assert.equal(describeSafety(notApplicable).gradeLabel, "평가 대상 없음", "not_applicable → 평가 대상 없음");

// 실제 파이프라인으로도 grade null 이 F 로 새지 않는지 확인 (은퇴 없음 시나리오).
const noRetireInputs = { ...DEFAULT_SIMULATOR_INPUTS, years: 1, withdrawalDelayYears: 15 };
const noRetireProjection = calculateAssetSimulatorPreview(noRetireInputs, buildDefaultYearPlans(noRetireInputs.startYear, noRetireInputs.years));
const noRetireSafety = calculateRetirementSafety(noRetireProjection);
for (const key of ["taxSaving", "brokerage", "combined"] as const) {
  const display = describeSafety(noRetireSafety[key]);
  if (noRetireSafety[key].grade === null) {
    assert.notEqual(display.gradeLabel, "F", `${key} grade null 은 F 로 표시하지 않음`);
  }
}

// evaluated + F 등급은 문자 등급을 그대로 보여주되 부드러운 문구를 사용.
const evaluatedF: SafetyResult = { status: "evaluated", grade: "F", score: 10, positives: [], warnings: [], metrics: { ...baseMetrics, yearsEvaluated: 5 } };
const fDisplay = describeSafety(evaluatedF);
assert.equal(fDisplay.gradeLabel, "F", "평가 완료된 F 는 등급 그대로 표시");
assert.equal(fDisplay.toneLabel, "보수적 조정 권장", "F 는 공포 문구 대신 부드러운 문구");
assert.ok(!/망함|파산|실패 확정/.test(fDisplay.toneLabel), "단정적 공포 표현 금지");

// ----- 4) 적용 전/후 projection: 미적용은 legacy 유지, 적용은 변경 ----------
const plans = buildDefaultYearPlans();
const legacy = calculateAssetSimulatorPreview(DEFAULT_SIMULATOR_INPUTS, plans);
assert.equal(legacy.summary.portfolioSummary, undefined, "미적용 시 portfolioSummary 없음");

const manualConfig: AssetSimulatorPortfolioConfigV1 = {
  version: 1,
  taxSaving: { accountType: "taxSaving", holdings: [{ id: "t1", ticker: "SCHD", weightPct: 100, metricMode: "manual", manual: { totalReturnCagrPct: 12 } }] },
  brokerage: { accountType: "brokerage", holdings: [{ id: "b1", ticker: "JEPQ", weightPct: 100, metricMode: "manual", manual: { priceCagrPct: 3, dividendYieldPct: 9, dividendGrowthPct: 1 } }] },
};
const { assumptions, issues } = buildAppliedPortfolioAssumptions(manualConfig, []);
assert.deepEqual(issues, [], "수동 fallback 만으로 적용 가능(issues 없음)");
assert.ok(assumptions, "적용 가정 생성됨");
const applied = calculateAssetSimulatorPreview(DEFAULT_SIMULATOR_INPUTS, plans, false, { portfolioAssumptions: assumptions });
assert.ok(applied.summary.portfolioSummary, "적용 시 portfolioSummary 표시");
assert.notEqual(
  applied.results.at(-1)!.totalNominal,
  legacy.results.at(-1)!.totalNominal,
  "적용된 가정이 projection 을 변경",
);

// 미적용(빈 옵션)은 legacy 와 동일해야 한다.
assert.deepEqual(
  calculateAssetSimulatorPreview(DEFAULT_SIMULATOR_INPUTS, plans, false, {}),
  legacy,
  "portfolioAssumptions 없는 legacy 결과 유지",
);

// resolver 결과가 있어도 apply 전에는 projection 이 바뀌지 않는다(apply 게이트).
const resolution: PortfolioHoldingResolution = {
  ticker: "SCHD",
  totalReturnCagr: metric({ status: "resolved", valuePct: 20, source: "yahoo-adj-close" }),
  priceCagr: metric({ status: "resolved", valuePct: 5 }),
  dividendYield: metric({ status: "resolved", valuePct: 4, source: "yahoo-dividends" }),
  dividendGrowth: metric({ status: "resolved", valuePct: 2, source: "yahoo-dividends" }),
};
void resolution; // resolver 결과는 UI 상태로만 보관되고, 적용 버튼 전에는 projection 계산에 넘기지 않는다.
assert.deepEqual(
  calculateAssetSimulatorPreview(DEFAULT_SIMULATOR_INPUTS, plans),
  legacy,
  "resolver 결과 존재만으로 projection 이 바뀌지 않음",
);

// ----- 5) 저장/복원 후 portfolioConfig, portfolioAssumptions 유지 -----------
const stored = buildStoredSimulatorConfig(DEFAULT_SIMULATOR_INPUTS, plans, new Date("2026-07-12T00:00:00.000Z").toISOString(), {
  portfolioConfig: manualConfig,
  portfolioAssumptions: assumptions!,
});
assert.ok(stored.portfolioConfig, "저장 payload 에 portfolioConfig 포함");
assert.ok(stored.portfolioAssumptions, "저장 payload 에 portfolioAssumptions 포함");
const restored = normalizePersistedSimulatorConfig({ ...stored }, "local");
assert.ok(restored, "복원 성공");
assert.equal(restored!.portfolioConfig?.taxSaving.holdings[0].ticker, "SCHD", "복원된 절세 티커 유지");
assert.equal(
  restored!.portfolioAssumptions && "version" in restored!.portfolioAssumptions ? restored!.portfolioAssumptions.version : null,
  1,
  "복원된 적용 가정은 version 1",
);
// 정규화 라운드트립도 확인.
assert.ok(normalizePortfolioConfig(stored.portfolioConfig), "portfolioConfig 정규화 라운드트립");
assert.ok(normalizePortfolioAssumptions(stored.portfolioAssumptions), "portfolioAssumptions 정규화 라운드트립");

// ----- 6) apply 상태 안내 문구 --------------------------------------------
assert.ok(describeApplyState("none")?.label.includes("아직"), "미적용 상태 안내");
assert.equal(describeApplyState("clean"), null, "일치 상태는 배너 없음");
assert.ok(describeApplyState("config_changed")?.label.includes("다릅니다"), "설정 변경 배너 문구");
assert.ok(describeApplyState("stale")?.label.includes("오래"), "stale 배너 문구");

// ----- 7) 페이지/컴포넌트 배선 확인 ----------------------------------------
const page = read("components/asset-simulator/AssetSimulatorPage.tsx");
assert.match(page, /calculateAssetSimulatorPreview\(inputs, yearPlans, exitMode, \{ portfolioAssumptions \}\)/, "projection 에 portfolioAssumptions 전달");
assert.match(page, /<PortfolioConfigSection/, "포트폴리오 설정 섹션 렌더");
assert.match(page, /<RetirementSafetySection/, "은퇴 안전성 섹션 렌더");
assert.match(page, /onApply=\{setPortfolioAssumptions\}/, "적용 버튼이 portfolioAssumptions 를 갱신");

const section = read("components/asset-simulator/PortfolioConfigSection.tsx");
assert.match(section, /절세계좌 · 인출 기반[\s\S]*위탁계좌 · 배당 현금흐름 기반/, "절세/위탁 현금흐름 기준 라벨 사용");
assert.match(section, /결과 확인/, "결과 확인 CTA 문구");
assert.match(section, /예시 포트폴리오로 시작/, "예시 시작 버튼");
assert.doesNotMatch(section, /포트폴리오 가정 적용/, "이전 가정 적용 CTA 제거");
assert.match(section, /자동 환산/, "환산 금액 readonly 표시");
assert.match(section, /가정 수정/, "접힘 가정 수정 UX");
assert.doesNotMatch(section, /전체 자동 계산/, "전체 자동 계산 버튼 제거");
assert.doesNotMatch(section, /자동 계산\s*\/\s*수동 입력/, "자동/수동 토글 제거");
assert.match(section, /overflow-hidden/, "가로 넘침 방지용 overflow-hidden 사용");
assert.match(section, /aria-label/, "접근성 라벨 사용");

const hero = read("components/asset-simulator/SafetyHeroCard.tsx");
assert.match(hero, /목표 월생활비[\s\S]*기간[\s\S]*물가상승률/, "목표 설정 입력 구조");
assert.doesNotMatch(hero, /시작 연도|시작년도/, "시작 연도 입력 제거");

const kpis = read("components/asset-simulator/SafetyKpiCards.tsx");
assert.match(kpis, /총 월 공급[\s\S]*절세계좌[\s\S]*위탁계좌[\s\S]*충당률/, "월 공급 중심 결과");
assert.match(kpis, /실가치보존율/, "실가치보존율 표기");
assert.doesNotMatch(kpis, /하락장 손상폭/, "하락장 손상폭 KPI 제거");

const safety = read("components/asset-simulator/RetirementSafetySection.tsx");
assert.match(safety, /은퇴 안전성 분석/, "안전성 섹션 제목");
assert.match(safety, /절세계좌 안전성[\s\S]*위탁계좌 안전성[\s\S]*통합 안전성/, "3개 안전성 계좌 기준");
assert.match(safety, /overflow-hidden/, "가로 넘침 방지용 overflow-hidden 사용");
assert.match(safety, /displayedStressSafety/, "하락장 표시 점수 보정 결과 사용");
// PR-3: 과대 보존율 상한 표시는 계좌 상세 패널(SafetyAccountDetailPanel)에서 담당한다.
const safetyDetailPanel = read("components/asset-simulator/SafetyAccountDetailPanel.tsx");
assert.match(safetyDetailPanel, /1,000% 이상|formatPreservationRatio/, "과대 보존율 상한 표시 사용");

console.log("asset simulator portfolio + safety UI checks passed");
