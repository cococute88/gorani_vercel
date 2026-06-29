import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function registerTs() {
  const old = require.extensions[".ts"];
  require.extensions[".ts"] = (mod, filename) => {
    const source = readFileSync(filename, "utf8");
    const out = ts.transpileModule(source, {
      compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    mod._compile(out.outputText, filename);
  };
  return () => {
    if (old) require.extensions[".ts"] = old;
  };
}

const restore = registerTs();
const {
  buildAccountGroupPerformance,
  computeBenchmarkSeries,
  benchmarkReturnPct,
  accountGroupOfHolding,
} = require("../lib/dividend-ledger-performance.ts");
restore();

// ---------------------------------------------------------------
// 1) 문서에 원본 Streamlit file reference 기록 확인
// ---------------------------------------------------------------
const doc = readFileSync("docs/DIVIDEND_LEDGER_PERFORMANCE_STREAMLIT_UI_PORT1.md", "utf8");
assert.ok(doc.includes("original/pages_app/9_dividend_ledger.py"), "doc must reference 9_dividend_ledger.py");
assert.ok(doc.includes("original/logic/dividend_performance.py"), "doc must reference dividend_performance.py");
assert.ok(doc.includes("build_performance_result"), "doc must document build_performance_result");

// ---------------------------------------------------------------
// 2~7,9,11) 컴포넌트 정적 검증
// ---------------------------------------------------------------
const comp = readFileSync("components/dividend/DividendAccountPerformanceSection.tsx", "utf8");
const page = readFileSync("components/dividend/DividendPage.tsx", "utf8");

assert.ok(comp.includes("위탁 계좌 성과"), "위탁 계좌 성과 section must exist");
assert.ok(comp.includes("절세 계좌 성과"), "절세 계좌 성과 section must exist");
assert.ok(page.includes("DividendAccountPerformanceSection"), "page must render account performance section");

// SCHD benchmark series 존재 + 파랑 점선
assert.ok(comp.includes('dataKey="schd"'), "계좌 그래프에 SCHD series가 있어야 한다");
assert.ok(comp.includes('COLOR_SCHD = "#3B82F6"'), "SCHD는 파랑(#3B82F6)이어야 한다");
const schdLine = comp.match(/dataKey="schd"[\s\S]*?\/>/);
assert.ok(schdLine && schdLine[0].includes("COLOR_SCHD"), "SCHD line은 파랑을 사용해야 한다");
assert.ok(schdLine && schdLine[0].includes("strokeDasharray"), "SCHD line은 점선이어야 한다");

// S&P 500 series 주황색 점선
assert.ok(comp.includes('COLOR_SP500 = "#F97316"'), "S&P 500은 주황색(#F97316)이어야 한다");
const sp500Line = comp.match(/dataKey="sp500"[\s\S]*?\/>/);
assert.ok(sp500Line && sp500Line[0].includes("COLOR_SP500"), "S&P 500 line은 주황색을 사용해야 한다");
assert.ok(sp500Line && sp500Line[0].includes("strokeDasharray"), "S&P 500 line은 점선이어야 한다");

// 내 포트폴리오 청록 실선 (점선 아님)
assert.ok(comp.includes('COLOR_PORTFOLIO = "#2DD4BF"'), "포트폴리오는 청록(#2DD4BF)이어야 한다");
const portfolioLine = comp.match(/dataKey="portfolio"[\s\S]*?\/>/);
assert.ok(portfolioLine && portfolioLine[0].includes("COLOR_PORTFOLIO"), "포트폴리오 line은 청록을 사용해야 한다");
assert.ok(portfolioLine && !portfolioLine[0].includes("strokeDasharray"), "포트폴리오 line은 실선(점선 아님)이어야 한다");

// 8) sample/mock series 사용 금지 + 10) benchmark 실패 시 fake line 금지
assert.ok(comp.includes('response.source === "sample"'), "sample source는 unavailable 처리해야 한다");
assert.ok(!comp.includes("buildSampleHistory"), "컴포넌트가 sample history를 직접 생성하면 안 된다");

// 9) empty state + 11) source badge
assert.ok(comp.includes("샘플/가짜 그래프는 표시하지 않습니다"), "데이터 부족 empty state가 있어야 한다");
assert.ok(comp.includes("최신 보유 기준 역산"), "백캐스트 source badge가 있어야 한다");
assert.ok(comp.includes("데이터 부족"), "데이터 부족 badge가 있어야 한다");

// ---------------------------------------------------------------
// 계산 로직 단위 검증
// ---------------------------------------------------------------
function holding(over) {
  return {
    id: over.id,
    broker: over.broker ?? "테스트증권",
    productName: over.productName,
    assetType: "ETF",
    principalKRW: over.principalKRW,
    valueKRW: over.valueKRW,
  };
}

const snapshots = [
  {
    id: "1",
    snapshotDate: "2026-01-31",
    sourceFileName: "a",
    totalAssetKRW: 16_200_000,
    totalDebtKRW: 0,
    netAssetKRW: 16_200_000,
    investmentPrincipalKRW: 15_000_000,
    investmentValueKRW: 16_200_000,
    returnAmountKRW: 1_200_000,
    returnPct: 8,
    holdings: [
      holding({ id: "b1", productName: "위탁 SCHD", principalKRW: 10_000_000, valueKRW: 11_000_000 }),
      holding({ id: "t1", productName: "연금저축 미국S&P500", principalKRW: 5_000_000, valueKRW: 5_200_000 }),
    ],
    financeAssets: [],
    createdAt: "",
  },
  {
    id: "2",
    snapshotDate: "2026-02-28",
    sourceFileName: "b",
    totalAssetKRW: 21_000_000,
    totalDebtKRW: 0,
    netAssetKRW: 21_000_000,
    investmentPrincipalKRW: 19_000_000,
    investmentValueKRW: 21_000_000,
    returnAmountKRW: 2_000_000,
    returnPct: 10.5,
    holdings: [
      holding({ id: "b2", productName: "위탁 SCHD", principalKRW: 13_000_000, valueKRW: 14_500_000 }),
      holding({ id: "t2", productName: "연금저축 미국S&P500", principalKRW: 6_000_000, valueKRW: 6_500_000 }),
    ],
    financeAssets: [],
    createdAt: "",
  },
];

// 계좌 분류
assert.equal(accountGroupOfHolding(holding({ id: "x", productName: "위탁 SCHD", principalKRW: 1, valueKRW: 1 })), "위탁");
assert.equal(
  accountGroupOfHolding(holding({ id: "x", productName: "연금저축 미국S&P500", principalKRW: 1, valueKRW: 1 })),
  "절세",
);

// 위탁 계좌 성과
const brokerage = buildAccountGroupPerformance(snapshots, "위탁");
assert.equal(brokerage.available, true);
assert.equal(brokerage.dataSource, "snapshot-history");
assert.equal(brokerage.sampleFallbackUsed, false);
assert.equal(brokerage.points.length, 2);
assert.equal(brokerage.points[0].depositKRW, 10_000_000);
assert.equal(brokerage.points[0].portfolioKRW, 11_000_000);
assert.equal(brokerage.points[1].netInvestmentKRW, 3_000_000);
// 월별 손익 = 14.5M - 11M - 3M = 0.5M
assert.equal(brokerage.points[1].monthlyProfitKRW, 500_000);
assert.equal(brokerage.latest.depositKRW, 13_000_000);
assert.equal(brokerage.latest.portfolioKRW, 14_500_000);

// 절세 계좌 성과
const taxAdv = buildAccountGroupPerformance(snapshots, "절세");
assert.equal(taxAdv.available, true);
assert.equal(taxAdv.points[1].depositKRW, 6_000_000);
assert.equal(taxAdv.points[1].portfolioKRW, 6_500_000);
assert.equal(taxAdv.points[1].netInvestmentKRW, 1_000_000);

// 데이터 부족 → empty (available=false)
const tooFew = buildAccountGroupPerformance([snapshots[0]], "위탁");
assert.equal(tooFew.available, false);
assert.ok(tooFew.unavailableReason.includes("데이터 부족"), "데이터 부족 사유가 명시돼야 한다");

// 벤치마크: KRW 지수(환율 불필요) — computeBenchmarkSeries 의 isUsd=false 경로 검증
const flowPoints = brokerage.points.map((p) => ({ date: p.date, netInvestmentKRW: p.netInvestmentKRW }));
const krwBench = computeBenchmarkSeries({
  points: flowPoints,
  prices: [
    { date: "2026-01-15", close: 100 },
    { date: "2026-02-15", close: 110 },
  ],
  fx: null,
  isUsd: false,
});
assert.equal(krwBench.available, true);
assert.equal(Math.round(krwBench.values[0]), 10_000_000); // 10M / 100 * 100
assert.equal(Math.round(krwBench.latestValue), 14_000_000);

// 벤치마크: USD 지수 (S&P500 / QQQ) — 환율 필요
const usdBench = computeBenchmarkSeries({
  points: flowPoints,
  prices: [
    { date: "2026-01-15", close: 100 },
    { date: "2026-02-15", close: 110 },
  ],
  fx: [
    { date: "2026-01-15", close: 1_300 },
    { date: "2026-02-15", close: 1_400 },
  ],
  isUsd: true,
});
assert.equal(usdBench.available, true);
assert.equal(Math.round(usdBench.values[0]), 10_000_000);

// fake line 금지: 가격이 없으면 available=false, 값은 모두 null
const noPrice = computeBenchmarkSeries({ points: flowPoints, prices: [], fx: null, isUsd: false });
assert.equal(noPrice.available, false);
assert.ok(noPrice.values.every((v) => v === null), "가격 없으면 fake 값 대신 null이어야 한다");

// USD인데 환율 없으면 unavailable
const noFx = computeBenchmarkSeries({
  points: flowPoints,
  prices: [{ date: "2026-01-15", close: 100 }],
  fx: null,
  isUsd: true,
});
assert.equal(noFx.available, false);

// 수익률 계산
assert.equal(benchmarkReturnPct(14_000_000, 13_000_000) !== null, true);
assert.equal(benchmarkReturnPct(null, 13_000_000), null);
assert.equal(benchmarkReturnPct(14_000_000, 0), null);

console.log("Dividend ledger performance UI port checks passed.");
console.log(
  JSON.stringify(
    {
      brokerageMonthlyProfit: brokerage.points[1].monthlyProfitKRW,
      taxAdvLatestPortfolio: taxAdv.latest.portfolioKRW,
      krwBenchLatest: Math.round(krwBench.latestValue),
      usdBenchLatest: Math.round(usdBench.latestValue),
    },
    null,
    2,
  ),
);
