import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { computePortfolioComparison, portfolioSeriesKey } from "../lib/portfolio-compare/engine.ts";
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
  rollingObservations: Object.fromEntries(longResult.rolling.map((row) => [`${row.months / 12}Y`, row.observations])),
  performanceMs: Number(performanceMs.toFixed(2)),
}, null, 2));
console.log("Portfolio compare checks passed.");
