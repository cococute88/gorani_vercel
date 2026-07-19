import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildRetirementBootstrapInput } from "../lib/retirement-bootstrap-adapter.ts";
import {
  PRODUCTION_MARKET_PATTERN_DATASET_VERSION,
  RETIREMENT_BOOTSTRAP_UI_POLICY_VERSION,
} from "../lib/retirement-bootstrap-config.ts";
import {
  buildRetirementBootstrapCalculationIdentity,
  classifyRetirementBootstrapInputError,
  clearRetirementBootstrapMemoryCache,
  getRetirementBootstrapMemoryCache,
  setRetirementBootstrapMemoryCache,
} from "../lib/retirement-bootstrap-ui.ts";
import { executeRetirementBootstrapWorkerRequest } from "../lib/retirement-bootstrap-worker-runner.ts";
import { runRetirementBootstrap } from "../lib/retirement-bootstrap-engine.ts";
import { PRODUCTION_MARKET_PATTERN_DATA_ADAPTER } from "../lib/retirement-bootstrap-production-adapter.ts";
import type { AppliedPortfolioAssumptionsV1, SimulatorInputs } from "../lib/asset-simulator-types.ts";
import type { RetirementBootstrapWorkerRunRequest } from "../lib/retirement-bootstrap-worker-protocol.ts";
import { RETIREMENT_BOOTSTRAP_RESULT_SCHEMA_VERSION } from "../lib/retirement-bootstrap-types.ts";

const inputs: SimulatorInputs = {
  startYear: 2026,
  years: 12,
  annualReturnRate: 99,
  inflationRate: 2.7,
  initialIsa: 7_000,
  initialPension: 11_000,
  reserveCash: 500,
  initialTaxableDividend: 15_000,
  withdrawalRate: 3.5,
  withdrawalGrowthRate: 2.5,
  withdrawalDelayYears: 1,
};

const assumptions: AppliedPortfolioAssumptionsV1 = {
  version: 1,
  appliedAt: "2026-07-18T00:00:00.000Z",
  taxSaving: {
    accountType: "taxSaving",
    holdings: [
      {
        holdingId: "tax-spy",
        ticker: "SPY",
        weightPct: 60,
        metricMode: "manual",
        totalReturnCagrPct: 7,
        priceCagrPct: null,
        dividendYieldPct: null,
        dividendGrowthPct: null,
        sources: { totalReturnCagr: "manual", priceCagr: "manual", dividendYield: "manual", dividendGrowth: "manual" },
        statuses: { totalReturnCagr: "manual", priceCagr: "manual", dividendYield: "manual", dividendGrowth: "manual" },
        warnings: [],
      },
      {
        holdingId: "tax-qqq",
        ticker: "QQQ",
        weightPct: 40,
        metricMode: "manual",
        totalReturnCagrPct: 8,
        priceCagrPct: null,
        dividendYieldPct: null,
        dividendGrowthPct: null,
        sources: { totalReturnCagr: "manual", priceCagr: "manual", dividendYield: "manual", dividendGrowth: "manual" },
        statuses: { totalReturnCagr: "manual", priceCagr: "manual", dividendYield: "manual", dividendGrowth: "manual" },
        warnings: [],
      },
    ],
  },
  brokerage: {
    accountType: "brokerage",
    holdings: [
      {
        holdingId: "brokerage-schd",
        ticker: "SCHD",
        weightPct: 90,
        metricMode: "manual",
        totalReturnCagrPct: null,
        priceCagrPct: 4,
        dividendYieldPct: 3.8,
        dividendGrowthPct: 5,
        sources: { totalReturnCagr: "manual", priceCagr: "manual", dividendYield: "manual", dividendGrowth: "manual" },
        statuses: { totalReturnCagr: "manual", priceCagr: "manual", dividendYield: "manual", dividendGrowth: "manual" },
        warnings: [],
      },
      {
        holdingId: "brokerage-jepq",
        ticker: "JEPQ",
        weightPct: 10,
        metricMode: "manual",
        totalReturnCagrPct: null,
        priceCagrPct: 3,
        dividendYieldPct: 9,
        dividendGrowthPct: 1,
        sources: { totalReturnCagr: "manual", priceCagr: "manual", dividendYield: "manual", dividendGrowth: "manual" },
        statuses: { totalReturnCagr: "manual", priceCagr: "manual", dividendYield: "manual", dividendGrowth: "manual" },
        warnings: [],
      },
    ],
  },
};

const bootstrapInput = buildRetirementBootstrapInput({
  inputs,
  portfolioAssumptions: assumptions,
  targetMonthlyExpenseReal: 120,
});
assert.equal(bootstrapInput.expectedInflationPct, 2.7, "사용자 inflation 연결");
assert.equal(bootstrapInput.annualRequiredWithdrawalReal, 1_440, "목표 월생활비를 연간 필수 세후 현금흐름으로 연결");
const threeMillionWonTarget = buildRetirementBootstrapInput({
  inputs: { ...inputs, initialIsa: 0, initialPension: 11_900, initialTaxableDividend: 15_000 },
  portfolioAssumptions: assumptions,
  targetMonthlyExpenseReal: 300,
});
assert.equal(threeMillionWonTarget.initialPension, 11_900, "1.19억원은 내부 11,900만원으로 유지");
assert.equal(threeMillionWonTarget.initialPension * 10_000, 119_000_000, "만원→원 환산 계약");
assert.equal(threeMillionWonTarget.annualRequiredWithdrawalReal, 3_600, "월 300만원은 연 3,600만원");
assert.deepEqual(bootstrapInput.taxSavingHoldings.map((row) => row.expectedTotalReturnCagrPct), [7, 8], "절세계좌 CAGR source-field 계약");
assert.deepEqual(bootstrapInput.brokerageHoldings.map((row) => [row.expectedPriceCagrPct, row.initialDividendYieldPct, row.expectedDividendGrowthPct]), [[4, 3.8, 5], [3, 9, 1]], "위탁 가격·배당·배당성장 source-field 계약");
assert.throws(
  () => buildRetirementBootstrapInput({ inputs, portfolioAssumptions: null, targetMonthlyExpenseReal: 120 }),
  /portfolioAssumptions/,
  "portfolioAssumptions 누락 시 기본값 대체 차단",
);
const unsupportedAssumptions = structuredClone(assumptions);
unsupportedAssumptions.taxSaving.holdings[0].ticker = "VTI";
let unsupportedError: unknown;
try {
  buildRetirementBootstrapInput({ inputs, portfolioAssumptions: unsupportedAssumptions, targetMonthlyExpenseReal: 120 });
} catch (error) {
  unsupportedError = error;
}
assert.equal(classifyRetirementBootstrapInputError(unsupportedError).code, "unsupported_etf", "unsupported ETF 전용 오류 상태");

const identity = buildRetirementBootstrapCalculationIdentity(bootstrapInput, PRODUCTION_MARKET_PATTERN_DATASET_VERSION, 10_000, 5, "combined");
assert.match(identity.cacheKey, new RegExp(RETIREMENT_BOOTSTRAP_UI_POLICY_VERSION), "V5 cache policy로 이전 결과 무효화");
assert.match(identity.cacheKey, /resultSchemaVersion/, "result schema version이 cache key에 포함");
assert.match(identity.cacheKey, /analysisScope/, "analysis scope가 cache key에 포함");
const sameIdentity = buildRetirementBootstrapCalculationIdentity(structuredClone(bootstrapInput), PRODUCTION_MARKET_PATTERN_DATASET_VERSION, 10_000, 5, "combined");
assert.deepEqual(sameIdentity, identity, "동일 정규화 입력의 seed/cache key 재현");
const taxIdentity = buildRetirementBootstrapCalculationIdentity(bootstrapInput, PRODUCTION_MARKET_PATTERN_DATASET_VERSION, 10_000, 5, "tax");
const brokerageIdentity = buildRetirementBootstrapCalculationIdentity(bootstrapInput, PRODUCTION_MARKET_PATTERN_DATASET_VERSION, 10_000, 5, "brokerage");
assert.equal(taxIdentity.seed, identity.seed, "scope 비교는 동일 sampled path seed 공유");
assert.equal(brokerageIdentity.seed, identity.seed, "위탁도 동일 sampled path seed 공유");
assert.notEqual(taxIdentity.cacheKey, identity.cacheKey, "절세·종합 cache 분리");
assert.notEqual(brokerageIdentity.cacheKey, identity.cacheKey, "위탁·종합 cache 분리");

const reordered = {
  ...bootstrapInput,
  taxSavingHoldings: [...bootstrapInput.taxSavingHoldings].reverse(),
  brokerageHoldings: [...bootstrapInput.brokerageHoldings].reverse(),
};
assert.deepEqual(
  buildRetirementBootstrapCalculationIdentity(reordered, PRODUCTION_MARKET_PATTERN_DATASET_VERSION, 10_000, 5),
  identity,
  "holding 순서와 무관한 cache key 정규화",
);
assert.notEqual(
  buildRetirementBootstrapCalculationIdentity({ ...bootstrapInput, expectedInflationPct: 3 }, PRODUCTION_MARKET_PATTERN_DATASET_VERSION, 10_000, 5).cacheKey,
  identity.cacheKey,
  "결과 영향 입력 변경 시 cache invalidation",
);
assert.notEqual(
  buildRetirementBootstrapCalculationIdentity(bootstrapInput, `${PRODUCTION_MARKET_PATTERN_DATASET_VERSION}-next`, 10_000, 5).cacheKey,
  identity.cacheKey,
  "datasetVersion 변경 시 cache invalidation",
);
assert.notEqual(
  buildRetirementBootstrapCalculationIdentity(bootstrapInput, PRODUCTION_MARKET_PATTERN_DATASET_VERSION, 9_999, 5).cacheKey,
  identity.cacheKey,
  "simulation count 변경 시 cache invalidation",
);
assert.notEqual(
  buildRetirementBootstrapCalculationIdentity(bootstrapInput, PRODUCTION_MARKET_PATTERN_DATASET_VERSION, 10_000, 4).cacheKey,
  identity.cacheKey,
  "block length 변경 시 cache invalidation",
);

const request: RetirementBootstrapWorkerRunRequest = structuredClone({
  type: "run",
  requestId: "serialization-reproduction",
  input: bootstrapInput,
  analysisScope: "combined",
  datasetVersion: PRODUCTION_MARKET_PATTERN_DATASET_VERSION,
  resultSchemaVersion: RETIREMENT_BOOTSTRAP_RESULT_SCHEMA_VERSION,
  simulationCount: 120,
  blockLength: 5,
  seed: identity.seed,
});
const first = await executeRetirementBootstrapWorkerRequest(request);
const second = await executeRetirementBootstrapWorkerRequest(structuredClone(request));
assert.equal(first.type, "success", "production Worker runner 성공");
assert.equal(second.type, "success", "직렬화된 Worker request 성공");
if (first.type !== "success" || second.type !== "success") throw new Error("Worker runner 결과 생성 실패");
assert.deepEqual(first.result, second.result, "Worker fixed-seed production 결과 재현");
const direct = runRetirementBootstrap(bootstrapInput, await PRODUCTION_MARKET_PATTERN_DATA_ADAPTER.loadDataset(), {
  iterations: request.simulationCount,
  blockLength: request.blockLength,
  periods: [30, 40, 50, 60, 70],
  seed: request.seed,
  analysisScope: request.analysisScope,
});
assert.deepEqual(first.result, direct, "Worker 결과와 direct engine 결과 동일");
const taxWorker = await executeRetirementBootstrapWorkerRequest({
  ...request,
  requestId: "tax-scope-serialization",
  analysisScope: "tax",
});
assert.equal(taxWorker.type, "success", "절세 scope Worker 성공");
if (taxWorker.type !== "success") throw new Error("절세 scope Worker 결과 생성 실패");
const directTax = runRetirementBootstrap(bootstrapInput, await PRODUCTION_MARKET_PATTERN_DATA_ADAPTER.loadDataset(), {
  iterations: request.simulationCount,
  blockLength: request.blockLength,
  periods: [30, 40, 50, 60, 70],
  seed: request.seed,
  analysisScope: "tax",
});
assert.deepEqual(taxWorker.result, directTax, "절세 Worker/direct parity");
assert.equal(taxWorker.result.fundingBaseline.type, "tax_initial_withdrawal", "절세 deterministic 기준선 Worker 전달");
assert.equal(taxWorker.result.fundingBaseline.status, "available");
assert.ok(taxWorker.result.periods.every((period) => period.realAfterTaxDividendCashflowRisk.observedPathCount === 0), "절세 배당 위험 해당 없음");
assert.deepEqual(structuredClone(first.result), first.result, "Worker 결과 structured clone 직렬화");
assert.deepEqual(first.result.periods.map((row) => row.periodYears), [30, 40, 50, 60, 70], "Worker 5개 checkpoint 출력");
assert.equal(first.result.datasetUsage, "production", "Worker production dataset 전용");
assert.equal(first.result.schemaVersion, RETIREMENT_BOOTSTRAP_RESULT_SCHEMA_VERSION, "Worker V5 result schema");
assert.equal(first.result.analysisScope, "combined", "Worker scope 직렬화");
assert.equal(first.result.fundingBaseline.type, "combined_target_expense", "Worker 종합 기준선 metadata 직렬화");
assert.equal(first.result.fundingBaseline.monthlyReal, bootstrapInput.annualRequiredWithdrawalReal / 12);
assert.ok(first.result.periods.every((row) => row.sustainabilitySuccessRate85 >= row.fullFundingSuccessRate100));
assert.ok(first.result.periods.every((row) => row.finalRealAssetRetention.lower5PctRetentionRatio !== null), "Worker가 최종자산 p05를 직렬화");
assert.ok(first.result.periods.every((row) => row.finalRealAssetRetention.upper95PctRetentionRatio !== null), "Worker가 최종자산 p95를 직렬화");
assert.ok(first.result.periods.every((row) => row.finalRealAssetRetention.representativeSampleRetentionRatios.length <= row.simulationCount), "Worker representative sample은 전체 경로를 넘지 않음");
const wrongDatasetVersion = await executeRetirementBootstrapWorkerRequest({ ...request, requestId: "wrong-dataset", datasetVersion: "stale-version" });
assert.equal(wrongDatasetVersion.type, "error", "오래된 datasetVersion 결과 생성 차단");
if (wrongDatasetVersion.type === "error") {
  assert.equal(wrongDatasetVersion.error.code, "dataset_integrity_failed", "datasetVersion 불일치 전용 오류 상태");
}
const wrongScope = await executeRetirementBootstrapWorkerRequest({
  ...request,
  requestId: "wrong-scope",
  analysisScope: "invalid" as "combined",
});
assert.equal(wrongScope.type, "error", "지원하지 않는 Worker scope 차단");
if (wrongScope.type === "error") assert.equal(wrongScope.error.code, "invalid_user_input");
const wrongResultSchemaVersion = await executeRetirementBootstrapWorkerRequest({
  ...request,
  requestId: "wrong-result-schema",
  resultSchemaVersion: RETIREMENT_BOOTSTRAP_RESULT_SCHEMA_VERSION - 1,
});
assert.equal(wrongResultSchemaVersion.type, "error", "오래된 result schema Worker request 차단");
if (wrongResultSchemaVersion.type === "error") {
  assert.equal(wrongResultSchemaVersion.error.code, "dataset_integrity_failed");
}

clearRetirementBootstrapMemoryCache();
assert.equal(getRetirementBootstrapMemoryCache(identity.cacheKey), null, "초기 cache miss");
setRetirementBootstrapMemoryCache(identity.cacheKey, {
  result: first.result,
  timing: first.timing,
  cachedAtEpochMs: Date.now(),
});
assert.deepEqual(getRetirementBootstrapMemoryCache(identity.cacheKey)?.result, first.result, "동일 입력 cache hit");
setRetirementBootstrapMemoryCache(taxIdentity.cacheKey, {
  result: taxWorker.result,
  timing: taxWorker.timing,
  cachedAtEpochMs: Date.now(),
});
assert.equal(getRetirementBootstrapMemoryCache(taxIdentity.cacheKey)?.result.analysisScope, "tax", "이전 절세 scope cache 재사용");
assert.equal(getRetirementBootstrapMemoryCache(identity.cacheKey)?.result.analysisScope, "combined", "종합 cache와 stale 혼입 없음");
assert.equal(getRetirementBootstrapMemoryCache(`${identity.cacheKey}-other`), null, "다른 입력 cache miss");

const page = readFileSync("components/asset-simulator/AssetSimulatorPage.tsx", "utf8");
const dashboard = readFileSync("components/asset-simulator/SafetyCheckDashboard.tsx", "utf8");
const section = readFileSync("components/asset-simulator/LongTermSustainabilitySection.tsx", "utf8");
const hook = readFileSync("components/asset-simulator/useRetirementBootstrapAnalysis.ts", "utf8");
const worker = readFileSync("components/asset-simulator/retirement-bootstrap.worker.ts", "utf8");
const productionRuntimeSources = [page, dashboard, section, hook, worker].join("\n");

assert.match(page, /<LongTermSustainabilitySection/, "신규 장기 분석 production 연결");
assert.doesNotMatch(page, /<RetirementSafetySection/, "기존 계좌별 안정성 production 렌더 제거");
assert.doesNotMatch(dashboard, /계좌별 안전성 참고/, "기존 하단 토글 제거");
assert.match(section, /<table[\s\S]*<LineChart/, "표와 점 그래프 제공");
assert.match(section, /createPortal\([\s\S]*document\.body/, "표 스크롤 컨테이너 밖 body portal tooltip");
assert.match(section, /style=\{\{[\s\S]*color: "#fff"/, "light theme 전역 text-white 재매핑과 무관한 tooltip 대비");
assert.match(section, /fitsAbove[\s\S]*placement[\s\S]*data-tooltip-placement/, "viewport 상단 공간 부족 시 아래로 배치");
assert.match(section, /event\.key === "Escape"/, "tooltip Escape 닫기");
assert.match(section, /onFocus=\{\(\) => setOpen\(true\)\}[\s\S]*onBlur=\{\(\) => setOpen\(false\)\}/, "tooltip keyboard focus 접근");
assert.match(section, /const periods = useMemo[\s\S]*chartData = useMemo<ChartDatum\[]>\(\(\) => periods\.map/, "표·그래프가 같은 result periods 객체 사용");
assert.match(section, /summaryPeriod[\s\S]*periodYears === 60/, "60년 대표 요약");
assert.match(section, /월85%이상수령률[\s\S]*월목표완전수령률/, "scope 기준 85%·100% 수령 지표를 명확히 표시");
assert.match(section, />\s*월85%이상수령률\s*<[\s\S]*>\s*월목표완전수령률\s*<[\s\S]*>\s*반토막진입비율\s*<[\s\S]*>\s*-75%진입비율\s*</, "기간별 표 직관화 헤더");
assert.match(section, /절세계좌 최초 실질 세후 월인출액[\s\S]*위탁계좌 최초 실질 세후 월배당[\s\S]*목표 월생활비/, "scope별 deterministic 기준 설명");
assert.match(section, /fundingBaseline\.monthlyReal/, "실제 scope 기준 월금액 표시");
assert.match(section, /type="radio"[\s\S]*checked=\{scope === option\.value\}/, "배타적 native radio selector semantics");
assert.match(section, /useState<RetirementBootstrapAnalysisScope>\("combined"\)/, "기본 분석 범위 종합");
assert.match(section, /절세계좌 분석에서는 별도 배당 현금흐름을 사용하지 않습니다[\s\S]*해당 없음/, "절세 배당 위험 0% 오해 방지");
assert.match(section, /data-testid="sustainability-period-table-scroll"[\s\S]*xl:overflow-x-visible[\s\S]*min-w-\[620px\]/, "desktop 표 scrollbar 제거와 mobile 최소폭 유지");
assert.match(section, /최종 실질자산 보존 분포[\s\S]*100% 이상[\s\S]*25% 미만/, "최종자산 5개 bucket 표");
assert.match(section, /절세: 초기 인출액 대비 · 위탁: 초기 배당액 대비 · 종합: 목표 생활비 대비/, "세 scope 기준 차이를 항상 표시");
assert.match(section, /최종자산 보존 중앙값[\s\S]*하위 5%/, "상단 최종자산 카드에 p05 표시");
assert.match(section, /aria-haspopup="dialog"[\s\S]*최종 실질자산 보존 분포[\s\S]*자세히 보기/, "최종자산 분포 제목은 modal button semantics");
assert.match(section, /최종 실질자산 보존율 분포[\s\S]*ScatterChart[\s\S]*ReferenceLine y=\{retentionRatioToPlotY\(1\)\}/, "modal 점도표와 100% 기준선");
assert.match(section, /representativeSampleRetentionRatios[\s\S]*lower5PctRetentionRatio[\s\S]*upper95PctRetentionRatio/, "대표 점과 전체 percentile 통계 분리");
assert.match(section, /document\.body\.style\.overflow = "hidden"[\s\S]*event\.key === "Escape"[\s\S]*triggerElement\?\.focus\(\)/, "modal 스크롤 잠금, Escape, focus restore");
assert.match(section, /생활비 하방 위험[\s\S]*최악 경로[\s\S]*하위 5%/, "최악과 하위 5% 생활비 MDD 표시");
assert.match(section, /실질 세후 배당 현금흐름 하락 위험[\s\S]*명목 배당 -20%/, "실질 현금흐름 MDD와 명목 삭감 구분");
assert.match(section, /반토막진입비율[\s\S]*이후 다시 회복한 경우도 포함[\s\S]*-75%진입비율/, "기존 50%·25% 계산 의미를 새 명칭 tooltip에 유지");
assert.match(page, /active=\{activeTab === "safety"\}/, "안정성 탭이 활성일 때만 Worker 실행");
assert.match(hook, /new Worker\(new URL\("\.\/retirement-bootstrap\.worker\.ts", import\.meta\.url\)/, "Next.js module Worker 생성");
assert.match(hook, /worker\?\.terminate\(\)/, "입력 변경·unmount cleanup");
assert.match(hook, /response\.requestId !== requestId/, "stale requestId 차단");
assert.match(hook, /CALCULATION_DEBOUNCE_MS/, "빠른 입력 변경 debounce");
assert.doesNotMatch(productionRuntimeSources, /retirement-bootstrap-synthetic|scripts\/fixtures|scripts\\fixtures/, "production UI synthetic fixture import 없음");

console.log("retirement bootstrap UI/Worker/cache checks passed");
