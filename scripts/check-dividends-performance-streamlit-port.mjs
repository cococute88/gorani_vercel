import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

function registerTs() {
  const old = require.extensions[".ts"];
  require.extensions[".ts"] = (mod, filename) => {
    const source = readFileSync(filename, "utf8");
    const out = ts.transpileModule(source, { compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
    mod._compile(out.outputText, filename);
  };
  return () => { if (old) require.extensions[".ts"] = old; };
}
const restore = registerTs();
const { buildDividendPerformanceFromSnapshots } = require("../lib/dividend-performance-from-snapshots.ts");
const { computeSchdEquivalentGoalProgress } = require("../lib/dividend-estimates.ts");
restore();

const perfComponent = readFileSync("components/dividend/DividendPerformanceSection.tsx", "utf8");
const dividendPage = readFileSync("components/dividend/DividendPage.tsx", "utf8");
assert.ok(!perfComponent.includes("샘플 데이터"), "sample badge must not be rendered in performance section");
assert.ok(!dividendPage.includes("DIVIDEND_PERFORMANCE_SERIES"), "dividends page must not use mock performance series");
assert.ok(dividendPage.includes("buildDividendPerformanceFromSnapshots"), "snapshot performance builder must be wired");
assert.ok(perfComponent.includes("샘플 그래프는 표시하지 않습니다"), "empty state must explain no fake chart");
assert.ok(perfComponent.includes("monthlyProfit"), "monthly P/L bar series must exist");
assert.ok(perfComponent.includes("연간 손익"), "annual P/L label must exist");

const snapshots = [
  { id: "1", snapshotDate: "2026-01-31", sourceFileName: "a", totalAssetKRW: 11_000_000, totalDebtKRW: 0, netAssetKRW: 11_000_000, investmentPrincipalKRW: 10_000_000, investmentValueKRW: 11_000_000, returnAmountKRW: 1_000_000, returnPct: 10, holdings: [], financeAssets: [], createdAt: "" },
  { id: "2", snapshotDate: "2026-02-28", sourceFileName: "b", totalAssetKRW: 14_500_000, totalDebtKRW: 0, netAssetKRW: 14_500_000, investmentPrincipalKRW: 13_000_000, investmentValueKRW: 14_500_000, returnAmountKRW: 1_500_000, returnPct: 11.5, holdings: [], financeAssets: [], createdAt: "" },
];
const result = buildDividendPerformanceFromSnapshots(snapshots);
assert.equal(result.sampleFallbackUsed, false);
assert.equal(result.available, true);
assert.equal(result.kpis.cumulativeDepositKRW, 13_000_000);
assert.equal(result.kpis.portfolioValueKRW, 14_500_000);
assert.equal(result.kpis.kospiValueKRW, null);
assert.equal(result.points[1].netInvestment, 3_000_000);
assert.equal(result.points[1].monthlyProfit, 500_000, "월별 손익 = 이번 달 말 평가액 - 지난 달 말 평가액 - 이번 달 순투자금");
assert.equal(result.yearlyProfitKRW[2026], 1_500_000);
assert.equal(buildDividendPerformanceFromSnapshots([snapshots[0]]).available, false);

const targetQty = 3300;
const equivalentShares = 817.4;
const actualShares = 325;
const targetPriceKRW = 50_000;
const progress = computeSchdEquivalentGoalProgress({ targetTicker: "SCHD", targetQty, targetPriceKRW, actualShares, evaluationKRW: equivalentShares * targetPriceKRW });
assert.equal(Number(progress.equivalentShares.toFixed(1)), 817.4);
assert.equal(progress.actualShares, 325);
assert.equal(Number(progress.achievementPct.toFixed(1)), 24.8);
assert.ok(dividendPage.includes("computeActualTargetShares"), "actual SCHD shares helper must be present");
assert.ok(dividendPage.includes("quantityEstimated"), "estimated share flag must be handled");
assert.ok(dividendPage.includes("SCHD 환산"), "goal label must separate equivalent and actual shares");

console.log("Dividends performance Streamlit port checks passed.");
console.log(JSON.stringify({ monthlyProfit: result.points[1].monthlyProfit, achievementPct: Number(progress.achievementPct.toFixed(1)), actualShares: progress.actualShares }, null, 2));
