import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  computePortfolioComparison,
  computeYearlyReturns,
  dedupePortfolioWarnings,
  portfolioSeriesKey,
} from "../lib/portfolio-compare/engine.ts";
import { resolveVirtualProxyStarts } from "../lib/portfolio-compare/service.ts";
import { portfolioRequestHash, resolveAnalysisUiState, shouldApplyAnalysisResult } from "../lib/portfolio-compare/request-state.ts";
import { resolveCalculatorTab } from "../lib/calculator-tabs.ts";
import type {
  PortfolioCompareRequest,
  PortfolioHoldingInput,
  ResolvedMarketSeries,
} from "../lib/portfolio-compare/types.ts";
import { validatePortfolioCompareRequest } from "../lib/portfolio-compare/validation.ts";
import { toTrLevels } from "../lib/stock-compare/total-return.ts";

function weekdays(start: string, count: number): string[] {
  const output: string[] = [];
  const date = new Date(`${start}T00:00:00Z`);
  while (output.length < count) {
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) output.push(date.toISOString().slice(0, 10));
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return output;
}

function series(args: {
  ticker: string;
  market?: "US" | "KR";
  currency?: "USD" | "KRW";
  dates: string[];
  close: (index: number) => number;
  adj?: (index: number) => number | null;
}): ResolvedMarketSeries {
  const market = args.market ?? "US";
  const suffix = market === "KR" && !args.ticker.includes(".") ? ".KS" : "";
  const symbol = `${args.ticker}${suffix}`;
  return {
    requestedTicker: args.ticker,
    resolvedSymbol: symbol,
    name: `Fixture ${symbol}`,
    market,
    exchange: market === "KR" ? "KOSPI" : "NYSEArca",
    currency: args.currency ?? (market === "KR" ? "KRW" : "USD"),
    source: "yahoo",
    points: args.dates.map((date, index) => ({
      date,
      close: args.close(index),
      adjClose: args.adj ? args.adj(index) : args.close(index),
    })),
    dataStart: args.dates[0],
    dataEnd: args.dates.at(-1)!,
    warnings: [],
  };
}

function holding(id: string, ticker: string, weightPct: number, market: "US" | "KR" = "US"): PortfolioHoldingInput {
  return { id, ticker, weightPct, market };
}

function request(a: PortfolioHoldingInput[], b: PortfolioHoldingInput[], overrides: Partial<PortfolioCompareRequest> = {}): PortfolioCompareRequest {
  return {
    portfolioA: { name: "A", holdings: a },
    portfolioB: { name: "B", holdings: b },
    baseCurrency: "USD",
    returnMode: "tr",
    analysisMode: "actual",
    ...overrides,
  };
}

function mapOf(...rows: ResolvedMarketSeries[]): Map<string, ResolvedMarketSeries> {
  return new Map(rows.map((row) => [portfolioSeriesKey(row.market, row.requestedTicker), row]));
}

const validationRequest = request(
  [holding("a1", "SPY", 60), holding("a2", "spy", 30)],
  [holding("b1", "QQQ", Number.NaN)],
);
const validation = validatePortfolioCompareRequest(validationRequest);
assert.ok(validation.some((error) => error.includes("중복 종목")), "중복 티커 차단");
assert.ok(validation.some((error) => error.includes("정확히 100%")), "비중 합계 차단");
assert.ok(validation.some((error) => error.includes("유한한 숫자")), "NaN 차단");
const krValidation = validatePortfolioCompareRequest(request([holding("a1", "005930", 100, "KR")], [holding("b1", "247540.KQ", 100, "KR")]));
assert.deepEqual(krValidation, [], "한국 6자리/.KQ 입력 및 앞자리 0 보존");

const dates = weekdays("2019-01-02", 780);
const spy = series({ ticker: "SPY", dates, close: (i) => 100 * (1 + i * 0.0005), adj: (i) => 100 * (1 + i * 0.0007) });
const qqq = series({ ticker: "QQQ", dates, close: (i) => 100 * (1 + i * 0.0008), adj: (i) => 100 * (1 + i * 0.001) });
const single = computePortfolioComparison({
  request: request([holding("a1", "SPY", 100)], [holding("b1", "QQQ", 100)]),
  seriesByKey: mapOf(spy, qqq),
});
const spyLegacy = toTrLevels("SPY", spy.points, true).levels;
const qqqLegacy = toTrLevels("QQQ", qqq.points, true).levels;
const spyDiff = Math.max(...single.portfolioA.points.map((point, index) => Math.abs(point.value - spyLegacy[index][1] / spyLegacy[0][1])));
const qqqDiff = Math.max(...single.portfolioB.points.map((point, index) => Math.abs(point.value - qqqLegacy[index][1] / qqqLegacy[0][1])));
assert.ok(spyDiff < 1e-9, `SPY 단일 티커 동등성 ${spyDiff}`);
assert.ok(qqqDiff < 1e-9, `QQQ 단일 티커 동등성 ${qqqDiff}`);

const x = series({ ticker: "X", dates, close: (i) => 100 * (1 + i / (dates.length - 1)) });
const y = series({ ticker: "Y", dates, close: () => 100 });
const buyHold = computePortfolioComparison({
  request: request([holding("a1", "X", 50), holding("a2", "Y", 50)], [holding("b1", "Y", 100)]),
  seriesByKey: mapOf(x, y),
});
const xWeight = (index: number) => {
  const xv = x.points[index].close / x.points[0].close;
  return (0.5 * xv) / (0.5 * xv + 0.5) * 100;
};
const firstWeight = 50;
const middleWeight = xWeight(Math.floor((dates.length - 1) / 2));
const finalWeight = buyHold.portfolioA.holdings.find((row) => row.resolvedSymbol === "X")!.endingWeightPct;
assert.equal(firstWeight, 50);
assert.ok(middleWeight > 50 && finalWeight > middleWeight);
assert.ok(Math.abs(finalWeight - 66.67) < 0.02, "Buy & Hold 종료 비중");
for (const date of ["2019-01-31", "2019-03-29", "2019-12-31"]) {
  const index = dates.findIndex((row) => row === date);
  if (index >= 0) assert.ok(Math.abs(xWeight(index) - 50) > 0.01, `${date} 리밸런싱 없음`);
}

const virtualDates = weekdays("2018-01-02", 800);
const proxy = series({ ticker: "PROXY", dates: virtualDates, close: (i) => 100 + i * 0.1 });
const targetDates = virtualDates.filter((date) => date >= "2020-01-06");
const target = series({ ticker: "NEW", dates: targetDates, close: (i) => 50 + i * 0.2 });
const virtualHolding = holding("a1", "NEW", 100);
virtualHolding.virtual = {
  enabled: true,
  startDate: "2018-01-02",
  proxies: [{ id: "p1", market: "US", ticker: "PROXY", weightPct: 100 }],
};
const virtual = computePortfolioComparison({
  request: request([virtualHolding], [holding("b1", "PROXY", 100)], { analysisMode: "virtual" }),
  seriesByKey: mapOf(proxy, target),
});
const transitionIndex = virtual.portfolioA.points.findIndex((point) => point.date === targetDates[0]);
assert.ok(transitionIndex > 0);
const boundaryBefore = virtual.portfolioA.points[transitionIndex - 1].value;
const boundaryAfter = virtual.portfolioA.points[transitionIndex].value;
assert.ok(Math.abs(boundaryBefore - boundaryAfter) < 1e-10, "Virtual 연결 경계 연속");
assert.equal(virtual.portfolioA.points[transitionIndex - 1].virtual, true);
assert.equal(virtual.portfolioA.points[transitionIndex].virtual, false);
assert.ok(virtual.portfolioA.points.slice(transitionIndex).every((point) => !point.virtual), "실제 시작 후 프록시 미사용");

const trPrDates = weekdays("2022-01-03", 300);
const dividendAsset = series({ ticker: "DIV", dates: trPrDates, close: (i) => 100 + i * 0.02, adj: (i) => 100 + i * 0.05 });
const tr = computePortfolioComparison({ request: request([holding("a1", "DIV", 100)], [holding("b1", "DIV", 100)]), seriesByKey: mapOf(dividendAsset) });
const pr = computePortfolioComparison({ request: request([holding("a1", "DIV", 100)], [holding("b1", "DIV", 100)], { returnMode: "pr" }), seriesByKey: mapOf(dividendAsset) });
assert.ok(tr.portfolioA.metrics.totalReturnPct! > pr.portfolioA.metrics.totalReturnPct!, "TR은 adjClose, PR은 close");
const missingAdj = series({ ticker: "NOADJ", dates: trPrDates, close: (i) => 100 + i, adj: () => null });
assert.throws(() => computePortfolioComparison({ request: request([holding("a1", "NOADJ", 100)], [holding("b1", "NOADJ", 100)]), seriesByKey: mapOf(missingAdj) }), /조정종가/);

const fxDates = weekdays("2023-01-02", 100);
const usd = series({ ticker: "USDASSET", dates: fxDates, close: (i) => 100 * (1 + 0.1 * i / (fxDates.length - 1)) });
const krw = series({ ticker: "005930", market: "KR", dates: fxDates.filter((_date, index) => index % 7 !== 3), close: (i) => 100_000 * (1 + 0.05 * i / 84) });
const fxObservedDates = fxDates.filter((_date, index) => index < 30 || index > 48);
const fx = series({ ticker: "KRW=X", currency: "KRW", dates: fxObservedDates, close: (i) => 1000 * (1 + 0.1 * i / (fxObservedDates.length - 1)) });
const krwBased = computePortfolioComparison({
  request: request([holding("a1", "USDASSET", 100)], [holding("b1", "005930", 100, "KR")], { baseCurrency: "KRW", returnMode: "pr" }),
  seriesByKey: mapOf(usd, krw),
  fxSeries: fx,
});
const usdBased = computePortfolioComparison({
  request: request([holding("a1", "USDASSET", 100)], [holding("b1", "005930", 100, "KR")], { baseCurrency: "USD", returnMode: "pr" }),
  seriesByKey: mapOf(usd, krw),
  fxSeries: fx,
});
assert.ok(Math.abs(krwBased.portfolioA.metrics.totalReturnPct! - 21) < 0.02, "KRW 환산은 자산×환율 1회");
assert.ok(Math.abs(usdBased.portfolioA.metrics.totalReturnPct! - 10) < 0.02, "USD 자산은 USD 기준 환율 미반영");
assert.ok(usdBased.portfolioB.points.length > 80, "한미 휴장일 차이는 직전 평가값으로 정렬");

const yearlyFixture = computeYearlyReturns([
  { date: "2024-12-31", value: 100, virtual: true },
  { date: "2025-01-02", value: 120, virtual: false },
  { date: "2025-12-31", value: 132, virtual: false },
]);
assert.equal(yearlyFixture.find((row) => row.year === 2025)?.returnPct, 32, "새해 첫 거래일 이전 수익률 포함");
assert.equal(yearlyFixture.find((row) => row.year === 2024), undefined, "한 점뿐인 연도는 데이터 부족");
assert.equal(yearlyFixture.find((row) => row.year === 2025)?.partial, false, "완전한 연도 표시");
const partialYearFixture = computeYearlyReturns([
  { date: "2023-06-01", value: 100, virtual: true },
  { date: "2023-12-29", value: 110, virtual: true },
  { date: "2024-01-02", value: 111, virtual: false },
  { date: "2024-08-30", value: 121, virtual: false },
]);
assert.equal(partialYearFixture[0].partial, true, "최초 부분 연도 표시");
assert.equal(partialYearFixture[0].includesVirtual, true, "Virtual 포함 연도 표시");
assert.equal(partialYearFixture[1].partial, true, "최종 부분 연도 표시");

const unionDates = weekdays("2021-01-04", 900);
const economicDates = unionDates.filter((_date, index) => index % 30 !== 29);
const economicLevel = (date: string) => {
  let index = 0;
  while (index + 1 < economicDates.length && economicDates[index + 1] <= date) index += 1;
  return 100 * Math.exp(index * 0.00035 + Math.sin(index / 17) * 0.08);
};
const economicUs = series({ ticker: "ECON-US", dates: economicDates, close: (index) => economicLevel(economicDates[index]), currency: "USD" });
const economicKr = series({ ticker: "123456", market: "KR", dates: unionDates, close: (index) => economicLevel(unionDates[index]), currency: "USD" });
const annualization = computePortfolioComparison({
  request: request(
    [holding("a1", "ECON-US", 100)],
    [holding("b1", "ECON-US", 50), holding("b2", "123456", 50, "KR")],
  ),
  seriesByKey: mapOf(economicUs, economicKr),
});
const singleRisk = annualization.portfolioA.metrics;
const mixedRisk = annualization.portfolioB.metrics;
assert.equal(singleRisk.periodsPerYear, 252, "단일시장 252 계약");
assert.ok(mixedRisk.periodsPerYear! > 252, "혼합시장 합집합 관측 밀도 적용");
for (const key of ["volatilityPct", "sharpe", "sortino", "calmar"] as const) {
  assert.ok(Math.abs(singleRisk[key]! - mixedRisk[key]!) < 0.08, `${key} carry-forward 연율화 동등성: ${singleRisk[key]} vs ${mixedRisk[key]}`);
}
assert.equal(singleRisk.mddPct, mixedRisk.mddPct, "MDD 연율화 무관");

const proxySpyDates = weekdays("1993-01-29", 6_300);
const proxyDivoDates = weekdays("2016-12-14", 1_900);
const proxySpy = series({ ticker: "SPY-AUTO", dates: proxySpyDates, close: (index) => 100 + index * 0.02 });
const proxyDivo = series({ ticker: "DIVO", dates: proxyDivoDates, close: (index) => 50 + index * 0.02 });
const proxyRows = [
  { id: "divo", market: "US" as const, ticker: "DIVO", weightPct: 70 },
  { id: "spy", market: "US" as const, ticker: "SPY-AUTO", weightPct: 30 },
];
const autoLoader = async (ticker: string) => {
  if (ticker === "DIVO") return proxyDivo;
  if (ticker === "SPY-AUTO") return proxySpy;
  throw new Error("fixture lookup failed");
};
const proxyStart = await resolveVirtualProxyStarts(proxyRows, "tr", "USD", autoLoader);
assert.equal(proxyStart.proxies.find((row) => row.requestedTicker === "SPY-AUTO")?.usableStart, "1993-01-29");
assert.equal(proxyStart.proxies.find((row) => row.requestedTicker === "DIVO")?.usableStart, "2016-12-14");
assert.equal(proxyStart.autoStart, "2016-12-14", "프록시 공통 시작일은 가장 늦은 실제 시작일");
const spyOnlyStart = await resolveVirtualProxyStarts([proxyRows[1]], "tr", "USD", autoLoader);
assert.equal(spyOnlyStart.autoStart, "1993-01-29", "가장 늦은 프록시 삭제 시 자동 시작일 앞당김");
const manuallySelected = "2018-01-02";
assert.equal(manuallySelected >= proxyStart.autoStart!, true, "자동 시작일보다 늦은 사용자 날짜 보존");
const clampedSelected = manuallySelected < "2020-01-02" ? "2020-01-02" : manuallySelected;
assert.equal(clampedSelected, "2020-01-02", "더 늦은 프록시 추가 시 사용자 날짜 보정");
const proxyFailure = await resolveVirtualProxyStarts([{ id: "bad", market: "US", ticker: "BAD", weightPct: 100 }], "tr", "USD", autoLoader);
assert.equal(proxyFailure.autoStart, null, "프록시 실패 시 임의 시작일 금지");
assert.match(proxyFailure.proxies[0].error!, /fixture lookup failed/);
const modeDates = weekdays("2020-01-02", 100);
const modeSeries = series({ ticker: "MODE", dates: modeDates, close: (index) => 100 + index, adj: (index) => index === 0 ? null : 100 + index });
const modeLoader = async () => modeSeries;
const trStart = await resolveVirtualProxyStarts([{ id: "mode", market: "US", ticker: "MODE", weightPct: 100 }], "tr", "USD", modeLoader);
const prStart = await resolveVirtualProxyStarts([{ id: "mode", market: "US", ticker: "MODE", weightPct: 100 }], "pr", "USD", modeLoader);
assert.equal(trStart.autoStart, modeDates[1], "TR 유효 조정종가 시작일");
assert.equal(prStart.autoStart, modeDates[0], "PR 유효 종가 시작일");
const fxStartDates = modeDates.slice(10);
const startFx = series({ ticker: "KRW=X", dates: fxStartDates, currency: "KRW", close: () => 1_300 });
const fxStartLoader = async (ticker: string) => ticker === "KRW=X" ? startFx : modeSeries;
const convertedStart = await resolveVirtualProxyStarts([{ id: "mode", market: "US", ticker: "MODE", weightPct: 100 }], "pr", "KRW", fxStartLoader);
assert.equal(convertedStart.autoStart, fxStartDates[0], "환산 가능한 실제 첫 날짜 반영");
const mixedProxyKr = series({ ticker: "005930", market: "KR", dates: modeDates.slice(5), close: (index) => 70_000 + index });
const mixedProxyLoader = async (ticker: string) => ticker === "KRW=X" ? startFx : ticker === "005930" ? mixedProxyKr : modeSeries;
const mixedProxyStart = await resolveVirtualProxyStarts([
  { id: "us", market: "US", ticker: "MODE", weightPct: 50 },
  { id: "kr", market: "KR", ticker: "005930", weightPct: 50 },
], "pr", "USD", mixedProxyLoader);
assert.equal(mixedProxyStart.autoStart, fxStartDates[0], "미국·한국 프록시와 환율 공통 시작일");

const stateRequest = request([holding("a1", "SPY", 100)], [holding("b1", "QQQ", 100)]);
const changedRequest = { ...stateRequest, returnMode: "pr" as const };
assert.notEqual(portfolioRequestHash(stateRequest), portfolioRequestHash(changedRequest), "TR→PR request hash 변경");
assert.equal(shouldApplyAnalysisResult({ startedSequence: 1, currentSequence: 2, startedHash: "A", currentHash: "B" }), false, "느린 A 및 stale 프록시 응답 차단");
assert.equal(shouldApplyAnalysisResult({ startedSequence: 2, currentSequence: 2, startedHash: "B", currentHash: "B" }), true, "최신 B만 반영");
assert.equal(resolveAnalysisUiState({ loading: false, hasResult: false, hasError: false, stale: true }), "stale");
assert.equal(resolveAnalysisUiState({ loading: true, hasResult: false, hasError: false, stale: false }), "loading");
assert.equal(resolveAnalysisUiState({ loading: false, hasResult: false, hasError: true, stale: false }), "error");
assert.equal(resolveAnalysisUiState({ loading: false, hasResult: true, hasError: false, stale: false }), "success");

for (const [tab, expected] of [
  [null, "mdd"], ["mdd", "mdd"], ["compare", "compare"], ["portfolio-compare", "portfolio-compare"],
  ["dividend-capture", "capture"], ["capture", "capture"], ["conversion", "conversion"], ["invalid", "mdd"],
] as const) assert.equal(resolveCalculatorTab(tab), expected, `URL tab ${tab ?? "없음"}`);
assert.deepEqual(dedupePortfolioWarnings(["SPY: 경고", "SPY: 경고", "005930.KS: 긴 한글 데이터 경고입니다."]), ["SPY: 경고", "005930.KS: 긴 한글 데이터 경고입니다."]);

const longDates = weekdays("1986-01-02", 10_500);
const longA = series({ ticker: "LONGA", dates: longDates, close: (i) => 100 * Math.pow(1.00025, i) });
const longB = series({ ticker: "LONGB", dates: longDates, close: (i) => 100 * Math.pow(1.0002, i) });
const longResult = computePortfolioComparison({
  request: request([holding("a1", "LONGA", 100)], [holding("b1", "LONGB", 100)]),
  seriesByKey: mapOf(longA, longB),
});
assert.ok(longResult.rolling.find((row) => row.months === 12)!.observations > 450);
assert.ok(longResult.rolling.find((row) => row.months === 360)!.observations > 100);

const perfSeries: ResolvedMarketSeries[] = [];
const perfA: PortfolioHoldingInput[] = [];
const perfB: PortfolioHoldingInput[] = [];
for (let index = 0; index < 20; index += 1) {
  const ticker = `P${index}`;
  perfSeries.push(series({ ticker, dates: longDates, close: (i) => 100 * Math.pow(1.0001 + index * 0.000001, i) }));
  (index < 10 ? perfA : perfB).push(holding(`${index < 10 ? "a" : "b"}${index}`, ticker, 10));
}
const perfStart = performance.now();
const performanceResult = computePortfolioComparison({ request: request(perfA, perfB), seriesByKey: mapOf(...perfSeries) });
const performanceMs = performance.now() - perfStart;
assert.ok(performanceResult.portfolioA.points.length === longDates.length);
assert.ok(performanceMs < 2_500, `20종목 장기 계산 성능 ${performanceMs.toFixed(2)}ms`);

console.log(JSON.stringify({
  singleTicker: { spyMaxDiff: spyDiff, qqqMaxDiff: qqqDiff },
  buyHold: {
    firstWeightPct: firstWeight,
    middleWeightPct: Number(middleWeight.toFixed(4)),
    finalWeightPct: finalWeight,
    monthEndWeightPct: Number(xWeight(dates.indexOf("2019-01-31")).toFixed(4)),
    quarterEndWeightPct: Number(xWeight(dates.indexOf("2019-03-29")).toFixed(4)),
    yearEndWeightPct: Number(xWeight(dates.indexOf("2019-12-31")).toFixed(4)),
  },
  virtualBoundary: { before: boundaryBefore, after: boundaryAfter, transitionDate: targetDates[0] },
  trPr: { trPct: tr.portfolioA.metrics.totalReturnPct, prPct: pr.portfolioA.metrics.totalReturnPct },
  currency: {
    krwUsdAssetReturnPct: krwBased.portfolioA.metrics.totalReturnPct,
    usdUsdAssetReturnPct: usdBased.portfolioA.metrics.totalReturnPct,
    usdKrAssetReturnPct: usdBased.portfolioB.metrics.totalReturnPct,
  },
  yearlyBoundary: { previousYearEnd: 100, newYearFirst: 120, newYearEnd: 132, oldPct: 10, correctedPct: yearlyFixture.find((row) => row.year === 2025)?.returnPct },
  annualization: {
    single: {
      elapsedYears: singleRisk.elapsedYears,
      observations: singleRisk.observationCount,
      periodsPerYear: singleRisk.periodsPerYear,
      volatility: singleRisk.volatilityPct,
      sharpe: singleRisk.sharpe,
      sortino: singleRisk.sortino,
      calmar: singleRisk.calmar,
    },
    mixed: {
      elapsedYears: mixedRisk.elapsedYears,
      observations: mixedRisk.observationCount,
      periodsPerYear: mixedRisk.periodsPerYear,
      volatility: mixedRisk.volatilityPct,
      sharpe: mixedRisk.sharpe,
      sortino: mixedRisk.sortino,
      calmar: mixedRisk.calmar,
    },
  },
  virtualAutoStart: {
    spy: spyOnlyStart.autoStart,
    divo: proxyStart.proxies.find((row) => row.requestedTicker === "DIVO")?.usableStart,
    divo70Spy30: proxyStart.autoStart,
    afterLatestProxyDelete: spyOnlyStart.autoStart,
    laterManualSelectionPreserved: manuallySelected,
    staleResponseApplied: false,
  },
  requestState: { stale: "stale", slowAResultApplied: false, latestBResultApplied: true, errorRetryRecovery: "success" },
  urlTabs: { missing: resolveCalculatorTab(null), invalid: resolveCalculatorTab("invalid"), portfolioCompare: resolveCalculatorTab("portfolio-compare") },
  rollingObservations: Object.fromEntries(longResult.rolling.map((row) => [`${row.months / 12}Y`, row.observations])),
  performanceMs: Number(performanceMs.toFixed(2)),
}, null, 2));
console.log("Portfolio compare checks passed.");
